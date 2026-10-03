import { can, type Permission, type Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import type { AddressSnapshot } from '../../infra/db/schema.js';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../../shared/errors.js';
import { pageOf } from '../../shared/pagination.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/tokens.js';
import * as auth from '../auth/service.js';
import { hashPassword, passwordProblem, verifyPassword } from '../auth/passwords.js';
import { queueEmail } from '../mail/service.js';
import * as users from './service.js';
import type { ProfileUpdate } from './schemas.js';
import { STAFF_CREATABLE_ROLES } from './schemas.js';

export const PRIVACY_POLICY_VERSION = '2026-10-03';

type AddressInput = AddressSnapshot | null | undefined;

/** Which permission lets someone see or manage users of a given role. */
const READ_PERMISSION: Record<Role, Permission> = {
  CLIENT: 'customers.read',
  EMPLOYEE: 'employees.read',
  MANAGER: 'managers.manage',
  ADMIN: 'managers.manage',
};

const CREATE_PERMISSION: Record<(typeof STAFF_CREATABLE_ROLES)[number], Permission> = {
  CLIENT: 'users.create',
  EMPLOYEE: 'employees.manage',
  MANAGER: 'managers.manage',
};

function toDetail(user: users.UserRow, address: users.AddressRow | undefined) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf,
    address: address
      ? {
          cep: address.cep,
          street: address.street,
          number: address.number,
          complement: address.complement,
          district: address.district,
          city: address.city,
          state: address.state,
        }
      : null,
    emailVerified: user.emailVerifiedAt !== null,
    pendingInvitation: user.passwordHash === null,
    createdAt: user.createdAt,
  };
}

export type UserDetail = ReturnType<typeof toDetail>;

async function detailOf(db: Executor, user: users.UserRow): Promise<UserDetail> {
  return toDetail(user, await users.findAddress(db, user.id));
}

async function assertAvailable(
  db: Executor,
  email: string | undefined,
  cpf: string | null | undefined,
  exceptId?: number,
) {
  if (email) {
    const taken = await users.findActiveUserByEmail(db, email);
    if (taken && taken.id !== exceptId) {
      throw conflict(
        'email-taken',
        'Email já cadastrado',
        'Já existe uma conta com este email. Tente entrar ou recuperar a senha.',
        {
          errors: [{ path: 'email', message: 'Este email já está cadastrado.' }],
        },
      );
    }
  }
  if (cpf) {
    const taken = await users.findActiveUserByCpf(db, cpf);
    if (taken && taken.id !== exceptId) {
      throw conflict('cpf-taken', 'CPF já cadastrado', 'Já existe uma conta com este CPF.', {
        errors: [{ path: 'cpf', message: 'Este CPF já está cadastrado.' }],
      });
    }
  }
}

export interface CustomerRegistration {
  name: string;
  email: string;
  phone: string;
  password: string;
  cpf?: string | null | undefined;
  address?: AddressInput;
}

/** Self registration (UC Cadastrar Cliente): signs the customer in and sends the welcome email. */
export async function registerCustomer(ctx: AppContext, input: CustomerRegistration, meta: auth.ClientMeta) {
  const problem = passwordProblem(input.password, input.email);
  if (problem) {
    throw unprocessable('weak-password', 'Senha fraca', problem, {
      errors: [{ path: 'password', message: problem }],
    });
  }
  const passwordHash = await hashPassword(input.password);
  return ctx.db.transaction(async (tx) => {
    await assertAvailable(tx, input.email, input.cpf);
    const now = ctx.clock.now();
    const user = await users.insertUser(tx, {
      role: 'CLIENT',
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpf: input.cpf ?? null,
      passwordHash,
      privacyAcceptedAt: now,
      privacyVersion: PRIVACY_POLICY_VERSION,
    });
    if (input.address) await users.saveAddress(tx, user.id, input.address, now);
    await queueEmail(tx, user.email, 'welcome', { name: user.name, email: user.email });
    return auth.startSession(ctx, tx, user, meta);
  });
}

export interface UserCreation {
  role: (typeof STAFF_CREATABLE_ROLES)[number];
  name: string;
  email: string;
  phone?: string | null | undefined;
  cpf?: string | null | undefined;
  address?: AddressInput;
}

/** Registration by the staff: the person receives an invitation to define the password (decision D4). */
export async function createUser(ctx: AppContext, actor: AccessClaims, input: UserCreation, ip: string) {
  if (!can(actor.role, CREATE_PERMISSION[input.role]))
    throw forbidden('Somente o super usuário cadastra a equipe.');
  return ctx.db.transaction(async (tx) => {
    await assertAvailable(tx, input.email, input.cpf);
    const now = ctx.clock.now();
    const user = await users.insertUser(tx, {
      role: input.role,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      cpf: input.cpf ?? null,
    });
    if (input.address) await users.saveAddress(tx, user.id, input.address, now);
    await auth.inviteUser(ctx, tx, user);
    const detail = await detailOf(tx, user);
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'user.create',
      resourceType: 'user',
      resourceId: user.id,
      after: detail,
      ip,
    });
    return detail;
  });
}

export async function listUsers(
  ctx: AppContext,
  actorRole: Role,
  query: { role: Role; q?: string | undefined; page: number; pageSize: number },
) {
  if (!can(actorRole, READ_PERMISSION[query.role])) throw forbidden();
  const roles: Role[] = query.role === 'MANAGER' ? ['MANAGER', 'ADMIN'] : [query.role];
  const { rows, total } = await users.searchUsers(ctx.db, {
    roles,
    q: query.q,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const data = rows.map((u) => ({
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone,
    cpf: u.cpf,
    createdAt: u.createdAt,
  }));
  return pageOf(data, query, total);
}

async function visibleUser(ctx: AppContext, actorRole: Role, id: number): Promise<users.UserRow> {
  const user = await users.findActiveUserById(ctx.db, id);
  if (!user || !can(actorRole, READ_PERMISSION[user.role])) throw notFound('Usuário não encontrado.');
  return user;
}

export async function getUser(ctx: AppContext, actorRole: Role, id: number): Promise<UserDetail> {
  return detailOf(ctx.db, await visibleUser(ctx, actorRole, id));
}

async function applyChanges(tx: Executor, user: users.UserRow, changes: ProfileUpdate, now: Date) {
  if (user.role !== 'CLIENT' && changes.cpf === null) {
    throw unprocessable('cpf-required', 'CPF obrigatório', 'CPF é obrigatório para a equipe.', {
      errors: [{ path: 'cpf', message: 'CPF é obrigatório para a equipe.' }],
    });
  }
  const { address, ...fields } = changes;
  const updated = Object.keys(fields).length > 0 ? await users.updateUser(tx, user.id, fields, now) : user;
  if (address !== undefined) await users.saveAddress(tx, user.id, address, now);
  return updated;
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
  return ctx.db.transaction(async (tx) => {
    await assertAvailable(tx, changes.email, changes.cpf, user.id);
    const before = await detailOf(tx, user);
    const updated = await applyChanges(tx, user, changes, ctx.clock.now());
    const after = await detailOf(tx, updated);
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'user.update',
      resourceType: 'user',
      resourceId: id,
      before,
      after,
      ip,
    });
    return after;
  });
}

export async function deleteUser(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  ip: string,
): Promise<void> {
  const user = await visibleUser(ctx, actor.role, id);
  if (user.role === 'ADMIN') {
    throw conflict(
      'cannot-delete-admin',
      'Não é possível excluir',
      'O super usuário não pode ser excluído por aqui.',
    );
  }
  await ctx.db.transaction(async (tx) => {
    const before = await detailOf(tx, user);
    await users.anonymizeUser(tx, id, ctx.clock.now());
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'user.delete',
      resourceType: 'user',
      resourceId: id,
      before,
      ip,
    });
  });
}

async function self(ctx: AppContext, userId: number): Promise<users.UserRow> {
  const user = await users.findActiveUserById(ctx.db, userId);
  if (!user) throw new AppError(401, 'unauthorized', 'Não autenticado', 'Faça login para continuar.');
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

export async function deleteOwnAccount(ctx: AppContext, actor: AccessClaims, password: string, ip: string) {
  const user = await self(ctx, actor.userId);
  if (user.role !== 'CLIENT') throw forbidden('Contas da equipe são removidas pelo super usuário.');
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw unprocessable('wrong-password', 'Senha incorreta', 'A senha não confere.', {
      errors: [{ path: 'password', message: 'A senha não confere.' }],
    });
  }
  await ctx.db.transaction(async (tx) => {
    await users.anonymizeUser(tx, user.id, ctx.clock.now());
    await recordAudit(tx, {
      actorId: user.id,
      action: 'account.delete',
      resourceType: 'user',
      resourceId: user.id,
      ip,
    });
  });
}
