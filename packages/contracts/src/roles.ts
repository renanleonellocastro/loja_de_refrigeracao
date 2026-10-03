export const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

/** A visitor who is not signed in. */
export const GUEST = 'GUEST' as const;
export type Actor = Role | typeof GUEST;
export const ACTORS: readonly Actor[] = [GUEST, ...ROLES];

export const ROLE_LABELS: Record<Actor, string> = {
  GUEST: 'Visitante',
  CLIENT: 'Cliente',
  EMPLOYEE: 'Colaborador',
  MANAGER: 'Gerente',
  ADMIN: 'Super usuário',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
