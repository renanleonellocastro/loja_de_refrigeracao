/** Brazilian document and contact validators shared by the API and the web app. */

export function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/** CPF with check digits; rejects repeated sequences like 111.111.111-11. */
export function isValidCpf(value: string): boolean {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
}

/** Landline (10 digits) or mobile (11 digits, starting with 9 after the area code). */
export function isValidPhone(value: string): boolean {
  const phone = digits(value);
  if (!/^[1-9]{2}/.test(phone)) return false;
  return phone.length === 10 || (phone.length === 11 && phone[2] === '9');
}

export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(digits(value));
}

export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
