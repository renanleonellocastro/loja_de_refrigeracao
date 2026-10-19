import { isValidCpf, isValidPhone } from '@rc/contracts';
import { collectFieldErrors } from './field-rules';
import { EMAIL_PATTERN } from './masks';

/** Browser checks with the same rules as the API, written as the person should fix them (docs/DESIGN.md). */

export interface PersonFields {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export interface PersonRules {
  cpfRequired: boolean;
  phoneRequired?: boolean;
}

const CPF_LENGTH = 11;
const NAME_MIN_LENGTH = 3;

/** Message for an email that does not look like something@domain.tld. */
export function emailError(email: string): string | undefined {
  return EMAIL_PATTERN.test(email.trim()) ? undefined : 'Digite um email válido, como nome@exemplo.com.';
}

function nameError(name: string): string | undefined {
  return name.trim().length < NAME_MIN_LENGTH ? 'Informe o nome completo.' : undefined;
}

function phoneError(phone: string, required: boolean): string | undefined {
  const shouldCheck = required || Boolean(phone);
  return shouldCheck && !isValidPhone(phone) ? 'Digite o telefone com DDD, como (19) 99999-9999.' : undefined;
}

function missingDigitsLabel(missing: number): string {
  return missing === 1 ? 'falta 1 número' : `faltam ${missing} números`;
}

function cpfError(cpf: string, required: boolean): string | undefined {
  if (!cpf) return required ? 'Informe o CPF.' : undefined;
  if (cpf.length < CPF_LENGTH) return `CPF incompleto: ${missingDigitsLabel(CPF_LENGTH - cpf.length)}.`;
  return isValidCpf(cpf) ? undefined : 'Esse CPF não existe. Confira os números.';
}

export function validatePerson(values: PersonFields, options: PersonRules): FieldErrors {
  return collectFieldErrors({
    name: () => nameError(values.name),
    email: () => emailError(values.email),
    phone: () => phoneError(values.phone, options.phoneRequired ?? true),
    cpf: () => cpfError(values.cpf, options.cpfRequired),
  });
}

export function validateNewPassword(
  password: string,
  confirmation: string,
  passwordPath: string,
  confirmationPath: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors[passwordPath] = `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (confirmation !== password) errors[confirmationPath] = 'As senhas não são iguais. Digite de novo.';
  return errors;
}
