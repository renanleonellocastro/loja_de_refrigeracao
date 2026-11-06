import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { enqueue, type OutboxHandler } from '../outbox/service.js';
import { storeContact } from '../store/service.js';
import { storeFooter } from './footer.js';
import { templates, type Email, type StoreFooter, type TemplateName } from './templates.js';

export const EMAIL_TOPIC = 'email.send';

type TemplateData<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];

/** What the generic notice email needs; other modules build it without knowing the templates. */
export type NoticeEmail = TemplateData<'notice'>;

/** Queues a transactional email; it is sent by the worker after the transaction commits. */
export function queueEmail<T extends TemplateName>(
  db: Executor,
  to: string,
  template: T,
  data: TemplateData<T>,
) {
  return enqueue(db, EMAIL_TOPIC, { to, template, data });
}

type Renderer = (data: unknown, footer: StoreFooter) => Email;

function rendererFor(template: unknown): Renderer {
  const render = templates[template as TemplateName] as Renderer | undefined;
  if (!render) throw new Error(`Unknown email template ${String(template)}`);
  return render;
}

/** Sends queued emails; the footer is read per email so store settings changes apply at once. */
export function emailHandler(ctx: Pick<AppContext, 'mailer' | 'config' | 'db'>): OutboxHandler {
  return async (payload) => {
    const render = rendererFor(payload.template);
    const footer = storeFooter(await storeContact(ctx.db), ctx.config.APP_ORIGIN);
    const email = render(payload.data, footer);
    await ctx.mailer.send({ to: String(payload.to), ...email });
  };
}
