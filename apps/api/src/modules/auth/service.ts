import { randomUUID } from 'node:crypto';
import { ROLE_LABELS } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { DAY, MINUTE } from '../../shared/clock.js';
import { AppError, tooManyRequests, unauthorized, unprocessable } from '../../shared/errors.js';
import { normalizeEmail } from '../../shared/text.js';
import { queueEmail } from '../mail/service.js';
import { findActiveUserByEmail, findActiveUserById, updateUser, type UserRow } from '../users/service.js';
import { toUserSummary, type UserSummary } from '../users/schemas.js';
import { hashPassword, matchesPassword, passwordProblem, verifyPassword } from './passwords.js';
import * as repo from './repository.js';
import { generateOpaqueToken, hashToken, signAccessToken } from './tokens.js';

export const LOGIN_WINDOW = 15 * MINUTE;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;
export const RESET_TTL = 30 * MINUTE;
export const INVITATION_TTL = 7 * DAY;
export const EMAIL_VERIFICATION_TTL = DAY;

const MILLISECONDS_PER_SECOND = 1000;

const RESET_PASSWORD_PATH = '/redefinir-senha';
const DEFINE_PASSWORD_PATH = '/definir-senha';
const CONFIRM_EMAIL_PATH = '/confirmar-email';

// A real hash so unknown emails cost the same time as wrong passwords.
const dummyHash = hashPassword('unknown-account-placeholder');

export interface ClientMeta {
  ip: string;
  userAgent?: string | undefined;
}

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: UserSummary;
}

interface RefreshGrant {
  readonly token: string;
  readonly expiresAt: Date;
}

interface SessionOpening {
  readonly userId: number;
  readonly familyId: string;
  readonly meta: ClientMeta;
  readonly refresh: RefreshGrant;
  readonly now: Date;
}

type RefreshOutcome = { readonly error: AppError } | { readonly session: IssuedSession };

type NewAuthToken = Pick<Parameters<typeof repo.insertAuthToken>[1], 'userId' | 'purpose' | 'payload'>;

interface LinkOwner {
  readonly record: repo.AuthTokenRow;
  readonly user: UserRow;
}

/** What differs between the password links: the token purpose and what happens once the password is set. */
interface PasswordLink {
  readonly purpose: 'PASSWORD_RESET' | 'INVITATION';
  afterPasswordSet(tx: Executor, user: UserRow): Promise<unknown>;
}

interface PasswordRedemption {
  readonly token: string;
  readonly password: string;
  readonly meta: ClientMeta;
}

interface PasswordReplacement {
  readonly user: UserRow;
  readonly passwordHash: string;
  readonly sessionId: string;
}

const invalidCredentials = () =>
  new AppError(401, 'invalid-credentials', 'Email ou senha incorretos', 'Confira os dados e tente de novo.');

const tooManyLoginAttempts = () =>
  tooManyRequests(
    LOGIN_WINDOW / MILLISECONDS_PER_SECOND,
    'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.',
  );

const sessionExpired = () => unauthorized('Sua sessão expirou. Entre novamente.');

const reusedRefreshToken = () => unauthorized('Por segurança, entre novamente.');

const invalidLink = () =>
  new AppError(410, 'link-expired', 'Link inválido ou vencido', 'Peça um novo link e tente de novo.');

const emailTaken = () =>
  new AppError(409, 'email-taken', 'Email já cadastrado', 'Este email já pertence a outra conta.');

const wrongCurrentPassword = () =>
  unprocessable('wrong-password', 'Senha atual incorreta', 'A senha atual não confere.', {
    errors: [{ path: 'currentPassword', message: 'A senha atual não confere.' }],
  });

function grantRefreshToken(ctx: AppContext, now: Date): RefreshGrant {
  const expiresAt = new Date(now.getTime() + ctx.config.REFRESH_TOKEN_TTL_DAYS * DAY);
  return { token: generateOpaqueToken(), expiresAt };
}

function insertSessionRow(db: Executor, opening: SessionOpening) {
  return repo.insertSession(db, {
    userId: opening.userId,
    familyId: opening.familyId,
    refreshTokenHash: hashToken(opening.refresh.token),
    userAgent: opening.meta.userAgent,
    ip: opening.meta.ip,
    createdAt: opening.now,
    expiresAt: opening.refresh.expiresAt,
  });
}

function signSessionAccessToken(ctx: AppContext, user: UserRow, sessionId: string, now: Date) {
  const claims = { userId: user.id, role: user.role, sessionId };
  return signAccessToken(claims, ctx.config.JWT_SECRET, ctx.config.ACCESS_TOKEN_TTL_SECONDS, now);
}

export async function startSession(
  ctx: AppContext,
  db: Executor,
  user: UserRow,
  meta: ClientMeta,
  familyId: string = randomUUID(),
): Promise<IssuedSession> {
  const now = ctx.clock.now();
  const refresh = grantRefreshToken(ctx, now);
  const session = await insertSessionRow(db, { userId: user.id, familyId, meta, refresh, now });
  return {
    accessToken: await signSessionAccessToken(ctx, user, session.id, now),
    expiresIn: ctx.config.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    user: toUserSummary(user),
  };
}

async function assertLoginAllowed(ctx: AppContext, email: string, ip: string): Promise<void> {
  const since = new Date(ctx.clock.now().getTime() - LOGIN_WINDOW);
  const [failuresByEmail, failuresByIp] = await Promise.all([
    repo.countFailedAttempts(ctx.db, { email }, since),
    repo.countFailedAttempts(ctx.db, { ip }, since),
  ]);
  if (failuresByEmail >= MAX_FAILURES_PER_EMAIL || failuresByIp >= MAX_FAILURES_PER_IP) {
    throw tooManyLoginAttempts();
  }
}

/** The account the credentials open, or undefined; unknown emails still pay for a password check. */
async function findAuthenticatedUser(db: Executor, email: string, password: string) {
  const user = await findActiveUserByEmail(db, email);
  const isValid = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);
  return user?.passwordHash && isValid ? user : undefined;
}

export async function login(
  ctx: AppContext,
  input: { email: string; password: string },
  meta: ClientMeta,
): Promise<IssuedSession> {
  const email = normalizeEmail(input.email);
  await assertLoginAllowed(ctx, email, meta.ip);
  const user = await findAuthenticatedUser(ctx.db, email, input.password);
  await repo.recordLoginAttempt(ctx.db, email, meta.ip, user !== undefined, ctx.clock.now());
  if (!user) throw invalidCredentials();
  return startSession(ctx, ctx.db, user, meta);
}

async function revokeFamilyWith(tx: Executor, session: repo.SessionRow, now: Date, error: AppError) {
  await repo.revokeFamily(tx, session.familyId, now);
  return { error };
}

async function rotateSession(
  ctx: AppContext,
  tx: Executor,
  refreshToken: string,
  meta: ClientMeta,
): Promise<RefreshOutcome> {
  const now = ctx.clock.now();
  const session = await repo.findSessionByTokenHash(tx, hashToken(refreshToken));
  if (!session || session.revokedAt || session.expiresAt <= now) return { error: sessionExpired() };
  if (session.rotatedAt) return revokeFamilyWith(tx, session, now, reusedRefreshToken());
  const user = await findActiveUserById(tx, session.userId);
  if (!user) return revokeFamilyWith(tx, session, now, sessionExpired());
  await repo.markSessionRotated(tx, session.id, now);
  return { session: await startSession(ctx, tx, user, meta, session.familyId) };
}

/** Rotates the refresh token. Reusing an already rotated token revokes the whole family (theft detection). */
export async function refresh(ctx: AppContext, refreshToken: string | undefined, meta: ClientMeta) {
  if (!refreshToken) throw sessionExpired();
  // Revocations must commit, so the transaction returns the failure instead of throwing inside it.
  const outcome = await ctx.db.transaction((tx) => rotateSession(ctx, tx, refreshToken, meta));
  if ('error' in outcome) throw outcome.error;
  return outcome.session;
}

export async function logout(ctx: AppContext, refreshToken: string | undefined, sessionId?: string) {
  const now = ctx.clock.now();
  if (refreshToken) {
    const session = await repo.findSessionByTokenHash(ctx.db, hashToken(refreshToken));
    if (session) await repo.revokeFamily(ctx.db, session.familyId, now);
  }
  if (sessionId) await repo.revokeSession(ctx.db, sessionId, now);
}

function link(ctx: AppContext, path: string, token: string): string {
  return `${ctx.config.APP_ORIGIN}${path}/${token}`;
}

/** Replaces older unused tokens of the same purpose with a new one and returns the token for the link. */
async function issueAuthToken(ctx: AppContext, db: Executor, grant: NewAuthToken, ttl: number) {
  const token = generateOpaqueToken();
  const now = ctx.clock.now();
  await repo.expireUserTokens(db, grant.userId, grant.purpose, now);
  const expiresAt = new Date(now.getTime() + ttl);
  await repo.insertAuthToken(db, { ...grant, tokenHash: hashToken(token), expiresAt });
  return token;
}

async function sendPasswordResetLink(ctx: AppContext, tx: Executor, user: UserRow): Promise<void> {
  const grant = { userId: user.id, purpose: 'PASSWORD_RESET' } as const;
  const token = await issueAuthToken(ctx, tx, grant, RESET_TTL);
  await queueEmail(tx, user.email, 'passwordReset', {
    name: user.name,
    link: link(ctx, RESET_PASSWORD_PATH, token),
  });
}

/** Always succeeds from the caller's point of view, so account existence never leaks. */
export async function requestPasswordReset(ctx: AppContext, rawEmail: string): Promise<void> {
  const user = await findActiveUserByEmail(ctx.db, normalizeEmail(rawEmail));
  if (!user) return;
  await ctx.db.transaction((tx) => sendPasswordResetLink(ctx, tx, user));
}

/** Creates an invitation link so a user registered by the staff defines their own password. */
export async function inviteUser(ctx: AppContext, db: Executor, user: UserRow): Promise<void> {
  const grant = { userId: user.id, purpose: 'INVITATION' } as const;
  const token = await issueAuthToken(ctx, db, grant, INVITATION_TTL);
  await queueEmail(db, user.email, 'invitation', {
    name: user.name,
    roleLabel: ROLE_LABELS[user.role],
    link: link(ctx, DEFINE_PASSWORD_PATH, token),
  });
}

/** Rejects a password the policy does not accept, pointing the form at the password field. */
export function assertStrongPassword(password: string, email: string): void {
  const problem = passwordProblem(password, email);
  if (problem) {
    throw unprocessable('weak-password', 'Senha fraca', problem, {
      errors: [{ path: 'password', message: problem }],
    });
  }
}

async function findLinkOwner(
  tx: Executor,
  token: string,
  purpose: repo.AuthTokenPurpose,
  now: Date,
): Promise<LinkOwner> {
  const record = await repo.findUsableAuthToken(tx, hashToken(token), purpose, now);
  const user = record ? await findActiveUserById(tx, record.userId) : undefined;
  if (!record || !user) throw invalidLink();
  return { record, user };
}

const notifyPasswordChanged = (tx: Executor, user: UserRow) =>
  queueEmail(tx, user.email, 'passwordChanged', { name: user.name });

const PASSWORD_RESET_LINK: PasswordLink = {
  purpose: 'PASSWORD_RESET',
  afterPasswordSet: notifyPasswordChanged,
};

// The invited person chooses the first password, so there is no change to warn about.
const INVITATION_LINK: PasswordLink = {
  purpose: 'INVITATION',
  afterPasswordSet: async () => undefined,
};

async function setPasswordFromLink(
  ctx: AppContext,
  tx: Executor,
  passwordLink: PasswordLink,
  redemption: PasswordRedemption,
): Promise<IssuedSession> {
  const now = ctx.clock.now();
  const { record, user } = await findLinkOwner(tx, redemption.token, passwordLink.purpose, now);
  assertStrongPassword(redemption.password, user.email);
  const passwordHash = await hashPassword(redemption.password);
  await updateUser(tx, user.id, { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? now }, now);
  await repo.markAuthTokenUsed(tx, record.id, now);
  await repo.revokeUserSessions(tx, user.id, now);
  await passwordLink.afterPasswordSet(tx, user);
  return startSession(ctx, tx, user, redemption.meta);
}

/** Shared by password reset and invitation: sets the password, ends other sessions and signs the user in. */
function redeemPasswordToken(ctx: AppContext, passwordLink: PasswordLink, redemption: PasswordRedemption) {
  return ctx.db.transaction((tx) => setPasswordFromLink(ctx, tx, passwordLink, redemption));
}

export const resetPassword = (ctx: AppContext, token: string, password: string, meta: ClientMeta) =>
  redeemPasswordToken(ctx, PASSWORD_RESET_LINK, { token, password, meta });

export const acceptInvitation = (ctx: AppContext, token: string, password: string, meta: ClientMeta) =>
  redeemPasswordToken(ctx, INVITATION_LINK, { token, password, meta });

async function replacePassword(ctx: AppContext, tx: Executor, replacement: PasswordReplacement) {
  const { user, passwordHash, sessionId } = replacement;
  const now = ctx.clock.now();
  const current = await repo.findSessionById(tx, sessionId);
  await updateUser(tx, user.id, { passwordHash }, now);
  await repo.revokeUserSessions(tx, user.id, now, current?.familyId);
  await queueEmail(tx, user.email, 'passwordChanged', { name: user.name });
}

export async function changePassword(
  ctx: AppContext,
  auth: { userId: number; sessionId: string },
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await findActiveUserById(ctx.db, auth.userId);
  if (!user) throw unauthorized();
  if (!(await matchesPassword(user.passwordHash, input.currentPassword))) throw wrongCurrentPassword();
  assertStrongPassword(input.newPassword, user.email);
  const passwordHash = await hashPassword(input.newPassword);
  await ctx.db.transaction((tx) =>
    replacePassword(ctx, tx, { user, passwordHash, sessionId: auth.sessionId }),
  );
}

/** Sends a confirmation link to a new email; the address only changes after the link is opened. */
export async function requestEmailChange(ctx: AppContext, db: Executor, user: UserRow, newEmail: string) {
  const grant = { userId: user.id, purpose: 'EMAIL_VERIFICATION', payload: { email: newEmail } } as const;
  const token = await issueAuthToken(ctx, db, grant, EMAIL_VERIFICATION_TTL);
  await queueEmail(db, newEmail, 'emailVerification', {
    name: user.name,
    link: link(ctx, CONFIRM_EMAIL_PATH, token),
  });
}

async function assertEmailFree(tx: Executor, email: string, ownerId: number): Promise<void> {
  const taken = await findActiveUserByEmail(tx, email);
  if (taken && taken.id !== ownerId) throw emailTaken();
}

async function applyEmailChange(ctx: AppContext, tx: Executor, token: string): Promise<void> {
  const now = ctx.clock.now();
  const { record, user } = await findLinkOwner(tx, token, 'EMAIL_VERIFICATION', now);
  const email = record.payload?.email;
  if (!email) throw invalidLink();
  await assertEmailFree(tx, email, user.id);
  await updateUser(tx, user.id, { email, emailVerifiedAt: now }, now);
  await repo.markAuthTokenUsed(tx, record.id, now);
}

export async function confirmEmail(ctx: AppContext, token: string): Promise<void> {
  await ctx.db.transaction((tx) => applyEmailChange(ctx, tx, token));
}

// Public surface used by other modules.
export { hashPassword, matchesPassword, passwordProblem, verifyPassword } from './passwords.js';
export type { AccessClaims } from './tokens.js';
