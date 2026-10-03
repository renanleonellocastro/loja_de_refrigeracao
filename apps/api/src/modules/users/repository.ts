import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Role } from '@rc/contracts';
import type { Executor } from '../../infra/db/client.js';
import { users } from '../../infra/db/schema.js';

export type UserRow = typeof users.$inferSelect;

export async function findActiveUserByEmail(db: Executor, email: string): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`, isNull(users.deletedAt)))
    .limit(1);
  return row;
}

export async function findActiveUserById(db: Executor, id: number): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return row;
}

export interface NewUser {
  role: Role;
  name: string;
  email: string;
  cpf?: string | null;
  phone?: string | null;
  passwordHash?: string | null;
  emailVerifiedAt?: Date | null;
  privacyAcceptedAt?: Date | null;
  privacyVersion?: string | null;
}

export async function insertUser(db: Executor, user: NewUser): Promise<UserRow> {
  const [row] = await db.insert(users).values(user).returning();
  return row!;
}

export async function updateUser(
  db: Executor,
  id: number,
  changes: Partial<NewUser>,
  now: Date,
): Promise<void> {
  await db
    .update(users)
    .set({ ...changes, updatedAt: now })
    .where(eq(users.id, id));
}
