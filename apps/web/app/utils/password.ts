export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const PASSWORD_MIN_LENGTH = 8;

export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  0: 'Muito fraca',
  1: 'Fraca',
  2: 'Razoável',
  3: 'Boa',
  4: 'Forte',
};

/**
 * Rough strength from length and variety, only to guide the person while typing.
 * The API applies the real policy.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const lengthBonus = password.length >= 12 ? 1 : 0;
  return Math.min(4, Math.max(1, variety - 1 + lengthBonus)) as PasswordStrength;
}
