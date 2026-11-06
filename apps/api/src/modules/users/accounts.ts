import { can, type Permission, type Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import type { AddressSnapshot } from '../../infra/db/schema.js';
import { conflict, forbidden, notFound, unauthorized, unprocessable } from '../../shared/errors.js';
import { pageOf, toLimitOffset } from '../../shared/pagination.js';
import { recordAudit, type AuditEntry } from '../audit/service.js';
import * as auth from '../auth/service.js';
import { hashPassword, matchesPassword, type AccessClaims } from '../auth/service.js';
import { queueEmail } from '../mail/service.js';
import { recentActivity } from './activity.js';
import { assertAvailable, withAvailabilityGuard } from './availability.js';
import { detailOf, toListItem, type UserDetail } from './detail.js';
import * as users from './service.js';
import type { ProfileUpdate, STAFF_CREATABLE_ROLES } from './schemas.js';

export const PRIVACY_POLICY_VERSION = '2026-10-03';

export type { UserDetail } from './detail.js';

type AddressInput = AddressSnapshot | null | undefined;

type StaffCreatableRole = (typeof STAFF_CREATABLE_ROLES)[number];

/** Who did it and from where, the part every audit entry of this module shares. */
interface AuditOrigin {
  readonly actorId: number;
  readonly ip: string;
}

type UserAuditChange = Pick<AuditEntry, 'action' | 'before' | 'after'> & { readonly resourceId: number };

/** Which permission lets someone see or manage users of a given role. */
const READ_PERMISSION: Record<Role, Permission> = {
  CLIENT: 'customers.read',
  EMPLOYEE: 'employees.read',
  MANAGER: 'managers.manage',
  ADMIN: 'managers.manage',
};

const CREATE_PERMISSION: Record<StaffCreatableRole, Permission> = {
  CLIENT: 'users.create',
  EMPLOYEE: 'employees.manage',
  MANAGER: 'managers.manage',
};

/** Listing managers also lists the super user, who is a manager for the store. */
const LISTED_ROLES: Partial<Record<Role, Role[]>> = { MANAGER: ['MANAGER', 'ADMIN'] };

const adminNotDeletable = () =>
  conflict(
    'cannot-delete-admin',
    'Não é possível excluir',
    'O super usuário não pode ser excluído por aqui.',
  );

const cpfRequired = () =>
  unprocessable('cpf-required', 'CPF obrigatório', 'CPF é obrigatório para a equipe.', {
    errors: [{ path: 'cpf', message: 'CPF é obrigatório para a equipe.' }],
  });

const wrongPassword = () =>
  unprocessable('wrong-password', 'Senha incorreta', 'A senha não confere.', {
    errors: [{ path: 'password', message: 'A senha não confere.' }],
  });

function recordUserAudit(tx: Executor, origin: AuditOrigin, change: UserAuditChange): Promise<void> {
  return recordAudit(tx, { ...origin, resourceType: 'user', ...change });
}

async function saveOptionalAddress(tx: Executor, userId: number, address: AddressInput, now: Date) {
  if (address) await users.saveAddress(tx, userId, address, now);
}

export interface CustomerRegistration {
  name: string;
  email: string;
  phone: string;
  password: string;
  cpf?: string | null | undefined;
  address?: AddressInput;
}

type HashedRegistration = CustomerRegistration & { readonly passwordHash: string };

function customerRow(registration: HashedRegistration, now: Date): users.NewUser {
  return {
    role: 'CLIENT',
    name: registration.name,
    email: registration.email,
    phone: registration.phone,
    cpf: registration.cpf ?? null,
    passwordHash: registration.passwordHash,
    privacyAcceptedAt: now,
    privacyVersion: PRIVACY_POLICY_VERSION,
  };
}

async function insertCustomer(
  ctx: AppContext,
  tx: Executor,
  registration: HashedRegistration,
  meta: auth.ClientMeta,
) {
  await assertAvailable(tx, registration.email, registration.cpf);
  const now = ctx.clock.now();
  const user = await users.insertUser(tx, customerRow(registration, now));
  await saveOptionalAddress(tx, user.id, registration.address, now);
  await queueEmail(tx, user.email, 'welcome', { name: user.name, email: user.email });
  return auth.startSession(ctx, tx, user, meta);
}

/** Self registration (UC Cadastrar Cliente): signs the customer in and sends the welcome email. */
export async function registerCustomer(ctx: AppContext, input: CustomerRegistration, meta: auth.ClientMeta) {
  auth.assertStrongPassword(input.password, input.email);
  const passwordHash = await hashPassword(input.password);
  return withAvailabilityGuard(() =>
    ctx.db.transaction((tx) => insertCustomer(ctx, tx, { ...input, passwordHash }, meta)),
  );
}

export interface UserCreation {
  role: StaffCreatableRole;
  name: string;
  email: string;
  phone?: string | null | undefined;
  cpf?: string | null | undefined;
  address?: AddressInput;
}

function invitedUserRow(input: UserCreation): users.NewUser {
  return {
    role: input.role,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    cpf: input.cpf ?? null,
  };
}

async function insertInvitedUser(ctx: AppContext, tx: Executor, input: UserCreation, origin: AuditOrigin) {
  await assertAvailable(tx, input.email, input.cpf);
  const now = ctx.clock.now();
  const user = await users.insertUser(tx, invitedUserRow(input));
  await saveOptionalAddress(tx, user.id, input.address, now);
  await auth.inviteUser(ctx, tx, user);
  const detail = await detailOf(tx, user);
  await recordUserAudit(tx, origin, { action: 'user.create', resourceId: user.id, after: detail });
  return detail;
}

/** Registration by the staff: the person receives an invitation to define the password (decision D4). */
export async function createUser(ctx: AppContext, actor: AccessClaims, input: UserCreation, ip: string) {
  if (!can(actor.role, CREATE_PERMISSION[input.role])) {
    throw forbidden('Somente o super usuário cadastra a equipe.');
  }
  return withAvailabilityGuard(() =>
    ctx.db.transaction((tx) => insertInvitedUser(ctx, tx, input, { actorId: actor.userId, ip })),
  );
}

export async function listUsers(
  ctx: AppContext,
  actorRole: Role,
  query: { role: Role; q?: string | undefined; page: number; pageSize: number },
) {
  if (!can(actorRole, READ_PERMISSION[query.role])) throw forbidden();
  const roles = LISTED_ROLES[query.role] ?? [query.role];
  const { rows, total } = await users.searchUsers(ctx.db, { roles, q: query.q, ...toLimitOffset(query) });
  return pageOf(rows.map(toListItem), query, total);
}

async function visibleUser(ctx: AppContext, actorRole: Role, id: number): Promise<users.UserRow> {
  const user = await users.findActiveUserById(ctx.db, id);
  if (!user || !can(actorRole, READ_PERMISSION[user.role])) throw notFound('Usuário não encontrado.');
  return user;
}

export async function getUser(ctx: AppContext, actorRole: Role, id: number) {
  const user = await visibleUser(ctx, actorRole, id);
  return { ...(await detailOf(ctx.db, user)), ...(await recentActivity(ctx, actorRole, user)) };
}

async function applyChanges(tx: Executor, user: users.UserRow, changes: ProfileUpdate, now: Date) {
  if (user.role !== 'CLIENT' && changes.cpf === null) throw cpfRequired();
  const { address, ...fields } = changes;
  const updated = Object.keys(fields).length > 0 ? await users.updateUser(tx, user.id, fields, now) : user;
  if (address !== undefined) await users.saveAddress(tx, user.id, address, now);
  return updated;
}

async function updateAudited(
  ctx: AppContext,
  tx: Executor,
  edit: { readonly user: users.UserRow; readonly changes: ProfileUpdate },
  origin: AuditOrigin,
) {
  await assertAvailable(tx, edit.changes.email, edit.changes.cpf, edit.user.id);
  const before = await detailOf(tx, edit.user);
  const updated = await applyChanges(tx, edit.user, edit.changes, ctx.clock.now());
  const after = await detailOf(tx, updated);
  await recordUserAudit(tx, origin, { action: 'user.update', resourceId: edit.user.id, before, after });
  return after;
}

/** Super user edit of any account, including the email (no confirmation needed). */
export async function adminUpdateUser(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  changes: ProfileUpdate,
  ip: string,
) {
  const user = await visibleUser(ctx, actor.role, id);
  return ctx.db.transaction((tx) => updateAudited(ctx, tx, { user, changes }, { actorId: actor.userId, ip }));
}

async function anonymizeAudited(ctx: AppContext, tx: Executor, user: users.UserRow, origin: AuditOrigin) {
  const before = await detailOf(tx, user);
  await users.anonymizeUser(tx, user.id, ctx.clock.now());
  await recordUserAudit(tx, origin, { action: 'user.delete', resourceId: user.id, before });
}

export async function deleteUser(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  ip: string,
): Promise<void> {
  const user = await visibleUser(ctx, actor.role, id);
  if (user.role === 'ADMIN') throw adminNotDeletable();
  await ctx.db.transaction((tx) => anonymizeAudited(ctx, tx, user, { actorId: actor.userId, ip }));
}

async function self(ctx: AppContext, userId: number): Promise<users.UserRow> {
  const user = await users.findActiveUserById(ctx.db, userId);
  if (!user) throw unauthorized();
  return user;
}

export async function getProfile(ctx: AppContext, userId: number): Promise<UserDetail> {
  return detailOf(ctx.db, await self(ctx, userId));
}

/** Own profile edit. A new email only applies after confirmation through the link sent to it. */
export async function updateProfile(ctx: AppContext, userId: number, changes: ProfileUpdate) {
  const user = await self(ctx, userId);
  const { email, ...rest } = changes;
  const emailChanged = email !== undefined && email !== user.email.toLowerCase();
  return ctx.db.transaction(async (tx) => {
    await assertAvailable(tx, emailChanged ? email : undefined, rest.cpf, user.id);
    const updated = await applyChanges(tx, user, rest, ctx.clock.now());
    if (emailChanged) await auth.requestEmailChange(ctx, tx, updated, email);
    return { profile: await detailOf(tx, updated), emailVerificationPending: emailChanged };
  });
}

export async function exportOwnData(ctx: AppContext, userId: number) {
  const user = await self(ctx, userId);
  const profile = await detailOf(ctx.db, user);
  const related = await users.exportUserData(ctx.db, userId);
  return {
    exportedAt: ctx.clock.now(),
    privacy: { acceptedAt: user.privacyAcceptedAt, version: user.privacyVersion },
    profile,
    ...related,
  };
}

async function anonymizeOwnAccount(ctx: AppContext, tx: Executor, user: users.UserRow, ip: string) {
  await users.anonymizeUser(tx, user.id, ctx.clock.now());
  await recordUserAudit(tx, { actorId: user.id, ip }, { action: 'account.delete', resourceId: user.id });
}

export async function deleteOwnAccount(ctx: AppContext, actor: AccessClaims, password: string, ip: string) {
  const user = await self(ctx, actor.userId);
  if (user.role !== 'CLIENT') throw forbidden('Contas da equipe são removidas pelo super usuário.');
  if (!(await matchesPassword(user.passwordHash, password))) throw wrongPassword();
  await ctx.db.transaction((tx) => anonymizeOwnAccount(ctx, tx, user, ip));
}
