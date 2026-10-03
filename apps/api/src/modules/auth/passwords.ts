import { hash, verify } from '@node-rs/argon2';

// Argon2id with the OWASP recommended minimum (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Common leaked passwords and obvious local choices; checked case insensitively. */
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  '12341234',
  '11223344',
  'password',
  'password1',
  'senha123',
  'senha1234',
  'senhasenha',
  'qwerty123',
  'qwertyuiop',
  'abc12345',
  'iloveyou',
  'admin123',
  'administrador',
  'brasil123',
  'mudar123',
  'mudarsenha',
  'refrigeracao',
  'castro123',
  'mogimirim',
  'geladeira',
  'flamengo',
  'corinthians',
  'palmeiras',
  'saopaulo',
]);

/** Returns a message in Portuguese when the password is not acceptable, otherwise null. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (password.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'Essa senha é muito comum. Escolha outra.';
  if (email && lower === email.trim().toLowerCase()) return 'A senha não pode ser igual ao email.';
  return null;
}
