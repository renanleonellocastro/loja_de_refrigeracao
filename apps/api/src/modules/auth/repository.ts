import { and, count, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { authTokens, loginAttempts, sessions } from '../../infra/db/schema.js';

export type SessionRow = typeof sessions.$inferSelect;
export type AuthTokenRow = typeof authTokens.$inferSelect;
export type AuthTokenPurpose = AuthTokenRow['purpose'];

export async function insertSession(db: Executor, values: typeof sessions.$inferInsert): Promise<SessionRow> {
  const [row] = await db.insert(sessions).values(values).returning();
  return row!;
}

export async function findSessionByTokenHash(db: Executor, hash: string): Promise<SessionRow | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.refreshTokenHash, hash)).limit(1);
  return row;
}

export async function findSessionById(db: Executor, id: string): Promise<SessionRow | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return row;
}

export async function markSessionRotated(db: Executor, id: string, now: Date): Promise<void> {
  await db.update(sessions).set({ rotatedAt: now }).where(eq(sessions.id, id));
}

export async function revokeSession(db: Executor, id: string, now: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
}

export async function revokeFamily(db: Executor, familyId: string, now: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
}

/** Revokes every session of the user, optionally keeping one family (the current device). */
export async function revokeUserSessions(db: Executor, userId: number, now: Date, keepFamilyId?: string) {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (keepFamilyId) conditions.push(ne(sessions.familyId, keepFamilyId));
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(...conditions));
}

export async function recordLoginAttempt(
  db: Executor,
  email: string,
  ip: string,
  succeeded: boolean,
  at: Date,
) {
  await db.insert(loginAttempts).values({ email, ip, succeeded, createdAt: at });
}

export async function countFailedAttempts(db: Executor, by: { email: string } | { ip: string }, since: Date) {
  const target = 'email' in by ? eq(loginAttempts.email, by.email) : eq(loginAttempts.ip, by.ip);
  const rows = await db
    .select({ total: count() })
    .from(loginAttempts)
    .where(and(target, eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, since)));
  return rows[0]!.total;
}

export async function insertAuthToken(db: Executor, values: typeof authTokens.$inferInsert): Promise<void> {
  await db.insert(authTokens).values(values);
}

export async function findUsableAuthToken(
  db: Executor,
  hash: string,
  purpose: AuthTokenPurpose,
  now: Date,
): Promise<AuthTokenRow | undefined> {
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, hash),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return row;
}

export async function markAuthTokenUsed(db: Executor, id: number, now: Date): Promise<void> {
  await db.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, id));
}

/** Invalidates older unused tokens of the same purpose so only the latest link works. */
export async function expireUserTokens(db: Executor, userId: number, purpose: AuthTokenPurpose, now: Date) {
  await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
}
