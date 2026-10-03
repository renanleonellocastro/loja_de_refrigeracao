/** Lowercase without accents, collapsed spaces; used for search columns and comparisons. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL friendly identifier: "Geladeira Brastemp 375L" -> "geladeira-brastemp-375l". */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}
