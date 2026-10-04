/** Brazilian input masks and validators. Pure functions, shared by fields, tables and forms. */

export type MaskKind = 'cpf' | 'cnpj' | 'phone' | 'cep' | 'money';

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Applies a pattern where `#` is a digit slot; stops at the last typed digit. */
function applyPattern(digits: string, pattern: string): string {
  let out = '';
  let index = 0;
  for (const char of pattern) {
    if (index >= digits.length) break;
    if (char === '#') {
      out += digits[index];
      index += 1;
    } else {
      out += char;
    }
  }
  return out;
}

export function formatCpf(value: string): string {
  return applyPattern(onlyDigits(value).slice(0, 11), '###.###.###-##');
}

export function formatCnpj(value: string): string {
  return applyPattern(onlyDigits(value).slice(0, 14), '##.###.###/####-##');
}

/** Landlines have 10 digits, mobiles 11 (starting with 9 after the area code). */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const pattern = digits.length === 11 ? '(##) #####-####' : '(##) ####-####';
  return applyPattern(digits, pattern);
}

export function formatCep(value: string): string {
  return applyPattern(onlyDigits(value).slice(0, 8), '#####-###');
}

function checkDigit(digits: string, weights: readonly number[]): number {
  const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function hasRepeatedDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;
  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[9]) && second === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;
  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return digits[2] === '9';
  return digits.length === 10;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formats an integer amount of cents as Brazilian reais, for example 123456 becomes "R$ 1.234,56". */
export function formatMoney(cents: number): string {
  // Intl separates the symbol with a non breaking space; a plain space keeps copy and tests predictable.
  return moneyFormatter.format(cents / 100).replace(/\s/g, ' ');
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

/** Formats an ISO instant as a long date in the store time zone, for example "3 de outubro de 2026". */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Formats an ISO instant as date and time in the store time zone, for example "03/10/2026, 14:30". */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** Reads typed money where every digit enters from the right as cents: "1.234,56" becomes 123456. */
export function parseMoney(value: string): number {
  const digits = onlyDigits(value).replace(/^0+/, '').slice(0, 13);
  return digits === '' ? 0 : Number(digits);
}

export const MASKS: Record<
  Exclude<MaskKind, 'money'>,
  { format: (value: string) => string; inputmode: 'numeric' | 'tel'; placeholder: string; maxLength: number }
> = {
  cpf: { format: formatCpf, inputmode: 'numeric', placeholder: '000.000.000-00', maxLength: 14 },
  cnpj: { format: formatCnpj, inputmode: 'numeric', placeholder: '00.000.000/0000-00', maxLength: 18 },
  phone: { format: formatPhone, inputmode: 'tel', placeholder: '(19) 99999-9999', maxLength: 15 },
  cep: { format: formatCep, inputmode: 'numeric', placeholder: '00000-000', maxLength: 9 },
};

/** Same idea as the API check: something@domain.tld, no spaces. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
