import { and, asc, count, desc, eq, ilike, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { Role } from '@rc/contracts';
import type { Executor } from '../../infra/db/client.js';
import {
  addresses,
  authTokens,
  cartItems,
  notifications,
  orders,
  quotes,
  serviceRequests,
  sessions,
  users,
  type AddressSnapshot,
} from '../../infra/db/schema.js';
import { normalizeText } from '../../shared/text.js';

export type UserRow = typeof users.$inferSelect;
export type AddressRow = typeof addresses.$inferSelect;

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
  deletedAt?: Date | null;
}

export function userSearchText(user: {
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
}) {
  return normalizeText([user.name, user.email, user.phone ?? '', user.cpf ?? ''].join(' '));
}

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

export async function findActiveUserByCpf(db: Executor, cpf: string): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.cpf, cpf), isNull(users.deletedAt)))
    .limit(1);
  return row;
}

export async function insertUser(db: Executor, user: NewUser): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values({ ...user, searchText: userSearchText(user) })
    .returning();
  return row!;
}

export async function updateUser(
  db: Executor,
  id: number,
  changes: Partial<NewUser>,
  now: Date,
): Promise<UserRow> {
  const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const merged = { ...current!, ...changes };
  const [row] = await db
    .update(users)
    .set({ ...changes, searchText: userSearchText(merged), updatedAt: now })
    .where(eq(users.id, id))
    .returning();
  return row!;
}

export async function findAddress(db: Executor, userId: number): Promise<AddressRow | undefined> {
  const [row] = await db.select().from(addresses).where(eq(addresses.userId, userId)).limit(1);
  return row;
}

export async function saveAddress(db: Executor, userId: number, address: AddressSnapshot | null, now: Date) {
  if (address === null) {
    await db.delete(addresses).where(eq(addresses.userId, userId));
    return;
  }
  await db
    .insert(addresses)
    .values({ userId, ...address, updatedAt: now })
    .onConflictDoUpdate({ target: addresses.userId, set: { ...address, updatedAt: now } });
}

export interface UserSearch {
  roles: Role[];
  q?: string | undefined;
  limit: number;
  offset: number;
}

export async function searchUsers(db: Executor, search: UserSearch) {
  const conditions: SQL[] = [inArray(users.role, search.roles), isNull(users.deletedAt)];
  if (search.q) conditions.push(ilike(users.searchText, `%${normalizeText(search.q).replace(/[%_]/g, '')}%`));
  const where = and(...conditions);
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(asc(users.name), asc(users.id))
      .limit(search.limit)
      .offset(search.offset),
    db.select({ value: count() }).from(users).where(where),
  ]);
  return { rows, total: totals[0]!.value };
}

/** Personal data of a user for the LGPD export. */
export async function exportUserData(db: Executor, userId: number) {
  const [userOrders, requests, userQuotes] = await Promise.all([
    db.select().from(orders).where(eq(orders.customerId, userId)).orderBy(desc(orders.createdAt)),
    db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.customerId, userId))
      .orderBy(desc(serviceRequests.createdAt)),
    db.select().from(quotes).where(eq(quotes.customerId, userId)).orderBy(desc(quotes.createdAt)),
  ]);
  return { orders: userOrders, serviceRequests: requests, quotes: userQuotes };
}

/** Removes personal data while keeping orders and services for the store records (decision D8). */
export async function anonymizeUser(db: Executor, userId: number, now: Date): Promise<void> {
  await db.delete(addresses).where(eq(addresses.userId, userId));
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
  await db.delete(notifications).where(eq(notifications.userId, userId));
  await db.delete(authTokens).where(eq(authTokens.userId, userId));
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  await db
    .update(users)
    .set({
      name: 'Conta removida',
      email: `removido-${userId}@anonimo.invalid`,
      cpf: null,
      phone: null,
      passwordHash: null,
      searchText: '',
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}
