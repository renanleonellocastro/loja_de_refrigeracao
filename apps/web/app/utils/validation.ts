import { isValidCpf, isValidPhone } from '@rc/contracts';

/** Browser checks with the same rules as the API, written as the person should fix them (docs/DESIGN.md). */

export interface PersonFields {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export function validatePerson(
  values: PersonFields,
  options: { cpfRequired: boolean; phoneRequired?: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 3) errors.name = 'Informe o nome completo.';
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Digite um email válido, como nome@exemplo.com.';
  const phoneRequired = options.phoneRequired ?? true;
  if ((phoneRequired || values.phone) && !isValidPhone(values.phone)) {
    errors.phone = 'Digite o telefone com DDD, como (19) 99999-9999.';
  }
  if (options.cpfRequired && !values.cpf) errors.cpf = 'Informe o CPF.';
  else if (values.cpf && values.cpf.length < 11) {
    const missing = 11 - values.cpf.length;
    errors.cpf = `CPF incompleto: ${missing === 1 ? 'falta 1 número' : `faltam ${missing} números`}.`;
  } else if (values.cpf && !isValidCpf(values.cpf)) errors.cpf = 'Esse CPF não existe. Confira os números.';
  return errors;
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
