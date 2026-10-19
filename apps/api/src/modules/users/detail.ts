import type { Executor } from '../../infra/db/client.js';
import * as users from './service.js';

function addressView(address: users.AddressRow | undefined) {
  if (!address) return null;
  return {
    cep: address.cep,
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    city: address.city,
    state: address.state,
  };
}

function toDetail(user: users.UserRow, address: users.AddressRow | undefined) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf,
    address: addressView(address),
    emailVerified: user.emailVerifiedAt !== null,
    pendingInvitation: user.passwordHash === null,
    createdAt: user.createdAt,
  };
}

export type UserDetail = ReturnType<typeof toDetail>;

/** The account as the profile and the staff screens show it, with its address. */
export async function detailOf(db: Executor, user: users.UserRow): Promise<UserDetail> {
  return toDetail(user, await users.findAddress(db, user.id));
}

/** The row of the user list: identity and contact, without the address. */
export function toListItem(user: users.UserRow) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf,
    createdAt: user.createdAt,
  };
}
