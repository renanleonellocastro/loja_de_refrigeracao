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
import { hashPassword, passwordProblem, verifyPassword } from './passwords.js';
import * as repo from './repository.js';
import { generateOpaqueToken, hashToken, signAccessToken } from './tokens.js';

export const LOGIN_WINDOW = 15 * MINUTE;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;
export const RESET_TTL = 30 * MINUTE;
export const INVITATION_TTL = 7 * DAY;
export const EMAIL_VERIFICATION_TTL = DAY;

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

export async function startSession(
  ctx: AppContext,
  db: Executor,
  user: UserRow,
  meta: ClientMeta,
  familyId: string = randomUUID(),
): Promise<IssuedSession> {
  const now = ctx.clock.now();
  const refreshToken = generateOpaqueToken();
  const refreshExpiresAt = new Date(now.getTime() + ctx.config.REFRESH_TOKEN_TTL_DAYS * DAY);
  const session = await repo.insertSession(db, {
    userId: user.id,
    familyId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent: meta.userAgent,
    ip: meta.ip,
    createdAt: now,
    expiresAt: refreshExpiresAt,
  });
  const accessToken = await signAccessToken(
    { userId: user.id, role: user.role, sessionId: session.id },
    ctx.config.JWT_SECRET,
    ctx.config.ACCESS_TOKEN_TTL_SECONDS,
    now,
  );
  return {
    accessToken,
    expiresIn: ctx.config.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshExpiresAt,
    user: toUserSummary(user),
  };
}

const invalidCredentials = () =>
  new AppError(401, 'invalid-credentials', 'Email ou senha incorretos', 'Confira os dados e tente de novo.');

export async function login(
  ctx: AppContext,
  input: { email: string; password: string },
  meta: ClientMeta,
): Promise<IssuedSession> {
  const email = normalizeEmail(input.email);
  const since = new Date(ctx.clock.now().getTime() - LOGIN_WINDOW);
  const [byEmail, byIp] = await Promise.all([
    repo.countFailedAttempts(ctx.db, { email }, since),
    repo.countFailedAttempts(ctx.db, { ip: meta.ip }, since),
  ]);
  if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
    throw tooManyRequests(
      LOGIN_WINDOW / 1000,
      'Muitas tentativas de login. Aguarde 15 minutos e tente de novo.',
    );
  }

  const user = await findActiveUserByEmail(ctx.db, email);
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password);
  if (!user || !user.passwordHash || !valid) {
    await repo.recordLoginAttempt(ctx.db, email, meta.ip, false, ctx.clock.now());
    throw invalidCredentials();
  }
  await repo.recordLoginAttempt(ctx.db, email, meta.ip, true, ctx.clock.now());
  return startSession(ctx, ctx.db, user, meta);
}

/** Rotates the refresh token. Reusing an already rotated token revokes the whole family (theft detection). */
export async function refresh(ctx: AppContext, refreshToken: string | undefined, meta: ClientMeta) {
  const expired = () => unauthorized('Sua sessão expirou. Entre novamente.');
  if (!refreshToken) throw expired();
  // Revocations must commit, so the transaction returns the failure instead of throwing inside it.
  const outcome = await ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const session = await repo.findSessionByTokenHash(tx, hashToken(refreshToken));
    if (!session || session.revokedAt || session.expiresAt <= now) return { error: expired() };
    if (session.rotatedAt) {
      await repo.revokeFamily(tx, session.familyId, now);
      return { error: unauthorized('Por segurança, entre novamente.') };
    }
    const user = await findActiveUserById(tx, session.userId);
    if (!user) {
      await repo.revokeFamily(tx, session.familyId, now);
      return { error: expired() };
    }
    await repo.markSessionRotated(tx, session.id, now);
    return { session: await startSession(ctx, tx, user, meta, session.familyId) };
  });
  if (outcome.error) throw outcome.error;
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

/** Always succeeds from the caller's point of view, so account existence never leaks. */
export async function requestPasswordReset(ctx: AppContext, rawEmail: string): Promise<void> {
  const user = await findActiveUserByEmail(ctx.db, normalizeEmail(rawEmail));
  if (!user) return;
  const token = generateOpaqueToken();
  await ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    await repo.expireUserTokens(tx, user.id, 'PASSWORD_RESET', now);
    await repo.insertAuthToken(tx, {
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + RESET_TTL),
    });
    await queueEmail(tx, user.email, 'passwordReset', {
      name: user.name,
      link: link(ctx, '/redefinir-senha', token),
    });
  });
}

/** Creates an invitation link so a user registered by the staff defines their own password. */
export async function inviteUser(ctx: AppContext, db: Executor, user: UserRow): Promise<void> {
  const token = generateOpaqueToken();
  const now = ctx.clock.now();
  await repo.expireUserTokens(db, user.id, 'INVITATION', now);
  await repo.insertAuthToken(db, {
    userId: user.id,
    purpose: 'INVITATION',
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + INVITATION_TTL),
  });
  await queueEmail(db, user.email, 'invitation', {
    name: user.name,
    roleLabel: ROLE_LABELS[user.role],
    link: link(ctx, '/definir-senha', token),
  });
}

function assertPassword(password: string, email: string): void {
  const problem = passwordProblem(password, email);
  if (problem) {
    throw unprocessable('weak-password', 'Senha fraca', problem, {
      errors: [{ path: 'password', message: problem }],
    });
  }
}

const invalidLink = () =>
  new AppError(410, 'link-expired', 'Link inválido ou vencido', 'Peça um novo link e tente de novo.');

/** Shared by password reset and invitation: sets the password, ends other sessions and signs the user in. */
async function redeemPasswordToken(
  ctx: AppContext,
  token: string,
  purpose: 'PASSWORD_RESET' | 'INVITATION',
  password: string,
  meta: ClientMeta,
): Promise<IssuedSession> {
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const record = await repo.findUsableAuthToken(tx, hashToken(token), purpose, now);
    const user = record ? await findActiveUserById(tx, record.userId) : undefined;
    if (!record || !user) throw invalidLink();
    assertPassword(password, user.email);
    await updateUser(
      tx,
      user.id,
      { passwordHash: await hashPassword(password), emailVerifiedAt: user.emailVerifiedAt ?? now },
      now,
    );
    await repo.markAuthTokenUsed(tx, record.id, now);
    await repo.revokeUserSessions(tx, user.id, now);
    if (purpose === 'PASSWORD_RESET') {
      await queueEmail(tx, user.email, 'passwordChanged', { name: user.name });
    }
    return startSession(ctx, tx, user, meta);
  });
}

export const resetPassword = (ctx: AppContext, token: string, password: string, meta: ClientMeta) =>
  redeemPasswordToken(ctx, token, 'PASSWORD_RESET', password, meta);

export const acceptInvitation = (ctx: AppContext, token: string, password: string, meta: ClientMeta) =>
  redeemPasswordToken(ctx, token, 'INVITATION', password, meta);

export async function changePassword(
  ctx: AppContext,
  auth: { userId: number; sessionId: string },
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await findActiveUserById(ctx.db, auth.userId);
  if (!user) throw unauthorized();
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw unprocessable('wrong-password', 'Senha atual incorreta', 'A senha atual não confere.', {
      errors: [{ path: 'currentPassword', message: 'A senha atual não confere.' }],
    });
  }
  assertPassword(input.newPassword, user.email);
  const passwordHash = await hashPassword(input.newPassword);
  await ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const current = await repo.findSessionById(tx, auth.sessionId);
    await updateUser(tx, user.id, { passwordHash }, now);
    await repo.revokeUserSessions(tx, user.id, now, current?.familyId);
    await queueEmail(tx, user.email, 'passwordChanged', { name: user.name });
  });
}

/** Sends a confirmation link to a new email; the address only changes after the link is opened. */
export async function requestEmailChange(ctx: AppContext, db: Executor, user: UserRow, newEmail: string) {
  const token = generateOpaqueToken();
  const now = ctx.clock.now();
  await repo.expireUserTokens(db, user.id, 'EMAIL_VERIFICATION', now);
  await repo.insertAuthToken(db, {
    userId: user.id,
    purpose: 'EMAIL_VERIFICATION',
    tokenHash: hashToken(token),
    payload: { email: newEmail },
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL),
  });
  await queueEmail(db, newEmail, 'emailVerification', {
    name: user.name,
    link: link(ctx, '/confirmar-email', token),
  });
}

export async function confirmEmail(ctx: AppContext, token: string): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const record = await repo.findUsableAuthToken(tx, hashToken(token), 'EMAIL_VERIFICATION', now);
    const user = record ? await findActiveUserById(tx, record.userId) : undefined;
    const email = record?.payload?.email;
    if (!record || !user || !email) throw invalidLink();
    const taken = await findActiveUserByEmail(tx, email);
    if (taken && taken.id !== user.id) {
      throw new AppError(409, 'email-taken', 'Email já cadastrado', 'Este email já pertence a outra conta.');
    }
    await updateUser(tx, user.id, { email, emailVerifiedAt: now }, now);
    await repo.markAuthTokenUsed(tx, record.id, now);
  });
}

// Public surface used by other modules.
export { hashPassword, passwordProblem, verifyPassword } from './passwords.js';
export type { AccessClaims } from './tokens.js';
