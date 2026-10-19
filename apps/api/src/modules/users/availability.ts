import type { Executor } from '../../infra/db/client.js';
import { conflict } from '../../shared/errors.js';
import * as users from './service.js';

const emailTaken = () =>
  conflict(
    'email-taken',
    'Email já cadastrado',
    'Já existe uma conta com este email. Tente entrar ou recuperar a senha.',
    { errors: [{ path: 'email', message: 'Este email já está cadastrado.' }] },
  );

const cpfTaken = () =>
  conflict('cpf-taken', 'CPF já cadastrado', 'Já existe uma conta com este CPF.', {
    errors: [{ path: 'cpf', message: 'Este CPF já está cadastrado.' }],
  });

function isTakenByOther(taken: users.UserRow | undefined, exceptId: number | undefined): boolean {
  return taken !== undefined && taken.id !== exceptId;
}

async function assertEmailAvailable(db: Executor, email: string | undefined, exceptId?: number) {
  if (!email) return;
  if (isTakenByOther(await users.findActiveUserByEmail(db, email), exceptId)) throw emailTaken();
}

async function assertCpfAvailable(db: Executor, cpf: string | null | undefined, exceptId?: number) {
  if (!cpf) return;
  if (isTakenByOther(await users.findActiveUserByCpf(db, cpf), exceptId)) throw cpfTaken();
}

/** Email and CPF identify one active account each; the account being edited may keep its own. */
export async function assertAvailable(
  db: Executor,
  email: string | undefined,
  cpf: string | null | undefined,
  exceptId?: number,
): Promise<void> {
  await assertEmailAvailable(db, email, exceptId);
  await assertCpfAvailable(db, cpf, exceptId);
}
