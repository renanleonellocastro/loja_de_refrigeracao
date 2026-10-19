import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, unprocessable } from '../../shared/errors.js';
import type { AccessClaims } from '../auth/service.js';
import { storeImage } from '../media/service.js';
import * as services from '../services/service.js';
import { loadVisible, lockVisible, nextOrFail } from './access.js';
import { notifyCustomer, notifyManagement } from './notices.js';
import type * as repo from './repository.js';
import { nextQuoteStatus, quoteActor, type QuoteAction, type QuotePerson } from './status.js';
import { photoView } from './views.js';

export const MAX_QUOTE_PHOTOS = 6;

type StoredImage = Awaited<ReturnType<typeof storeImage>>;

const PHOTO_ACTIONS: Readonly<Record<QuotePerson, QuoteAction>> = {
  customer: 'customerPhotos',
  staff: 'staffPhotos',
};

const MESSAGE_ACTIONS: Readonly<Record<QuotePerson, QuoteAction>> = {
  customer: 'customerMessage',
  staff: 'staffMessage',
};

export async function photosOf(db: Executor, quoteId: number) {
  return (await services.listMedia(db, 'QUOTE', quoteId)).map(photoView);
}

function assertAcceptsPhotos(quote: repo.QuoteRow, actor: QuotePerson): void {
  if (nextQuoteStatus(quote.status, PHOTO_ACTIONS[actor], actor) !== null) return;
  throw conflict('photos-locked', 'Não é possível enviar fotos', 'Este orçamento não aceita mais fotos.');
}

async function assertRoomForPhotos(db: Executor, quoteId: number, count: number): Promise<void> {
  const existing = await services.listMedia(db, 'QUOTE', quoteId);
  if (existing.length + count <= MAX_QUOTE_PHOTOS) return;
  throw unprocessable(
    'too-many-photos',
    'Fotos demais',
    `Cada orçamento aceita até ${MAX_QUOTE_PHOTOS} fotos.`,
  );
}

/** Stores the images one after the other, before the transaction that links them to the quote. */
async function storeImages(ctx: AppContext, files: Buffer[]): Promise<StoredImage[]> {
  const stored: StoredImage[] = [];
  for (const file of files) stored.push(await storeImage(ctx.storage, file));
  return stored;
}

async function linkPhotos(tx: Executor, quoteId: number, images: StoredImage[]): Promise<void> {
  for (const image of images) await services.insertMedia(tx, 'QUOTE', quoteId, image);
}

/** Photos of the problem: the customer while the quote waits for an answer, management while it is open. */
export async function addPhotos(ctx: AppContext, viewer: AccessClaims, id: number, files: Buffer[]) {
  const quote = await loadVisible(ctx.db, viewer, id);
  assertAcceptsPhotos(quote, quoteActor(viewer.role));
  await assertRoomForPhotos(ctx.db, id, files.length);
  const stored = await storeImages(ctx, files);
  await ctx.db.transaction((tx) => linkPhotos(tx, id, stored));
  return photosOf(ctx.db, id);
}

export async function listQuoteMessages(ctx: AppContext, viewer: AccessClaims, id: number) {
  await loadVisible(ctx.db, viewer, id);
  const rows = await services.listMessages(ctx.db, 'QUOTE', id);
  return rows.map((message) => ({
    id: message.id,
    body: message.body,
    author: { id: message.authorId, name: message.authorName, role: message.authorRole },
    mine: message.authorId === viewer.userId,
    createdAt: message.createdAt,
  }));
}

type MessageNotice = (ctx: AppContext, tx: Executor, quote: repo.QuoteRow, body: string) => Promise<void>;

/** A message is told to the other side of the conversation. */
const MESSAGE_NOTICES: Readonly<Record<QuotePerson, MessageNotice>> = {
  customer: (ctx, tx, quote, body) =>
    notifyManagement(ctx, tx, null, quote.id, {
      subject: `Mensagem do cliente no orçamento nº ${quote.id}`,
      heading: 'O cliente enviou uma mensagem',
      paragraphs: [body],
    }),
  staff: (ctx, tx, quote, body) =>
    notifyCustomer(ctx, tx, quote, {
      subject: `Mensagem sobre seu orçamento nº ${quote.id}`,
      heading: 'A loja enviou uma mensagem',
      paragraphs: [body, 'Responda pelo site para a gente seguir com o seu orçamento.'],
    }),
};

async function recordMessage(ctx: AppContext, tx: Executor, viewer: AccessClaims, id: number, body: string) {
  const quote = await lockVisible(tx, viewer, id);
  const actor = quoteActor(viewer.role);
  nextOrFail(quote, MESSAGE_ACTIONS[actor], actor);
  await services.insertMessage(tx, 'QUOTE', id, viewer.userId, body, ctx.clock.now());
  await MESSAGE_NOTICES[actor](ctx, tx, quote, body);
}

/** Conversation between the store and the customer while the quote is open. */
export async function postQuoteMessage(ctx: AppContext, viewer: AccessClaims, id: number, body: string) {
  return ctx.db.transaction((tx) => recordMessage(ctx, tx, viewer, id, body));
}
