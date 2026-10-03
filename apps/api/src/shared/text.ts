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

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Cents as Brazilian reais for emails and documents: 123456 -> "R$ 1.234,56" (with a non-breaking space). */
export function formatBrl(cents: number): string {
  return BRL.format(cents / 100);
}

/** An ISO calendar date in the Brazilian format: "2026-10-15" -> "15/10/2026". */
export function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}
