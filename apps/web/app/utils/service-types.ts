import type { ServiceType } from './service-requests';

/** Limits of the API (apps/api services module, serviceTypeInputSchema). */
export const SERVICE_TYPE_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  descriptionMax: 500,
  minutesMin: 15,
  minutesMax: 1440,
} as const;

/** A type alias (not an interface) so it fits the Record constraint of useForm. */
export type ServiceTypeForm = {
  name: string;
  description: string;
  /** Text of the number input; converted on submit. */
  estimatedMinutes: string;
};

export function serviceTypeFormFrom(type?: ServiceType): ServiceTypeForm {
  return {
    name: type?.name ?? '',
    description: type?.description ?? '',
    estimatedMinutes: String(type?.estimatedMinutes ?? 60),
  };
}

/** Same rules as the API, so most mistakes show up before the request. */
export function validateServiceTypeForm(values: ServiceTypeForm): FieldErrors {
  const { nameMin, nameMax, descriptionMax, minutesMin, minutesMax } = SERVICE_TYPE_LIMITS;
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (name.length < nameMin) errors.name = `Informe o nome do serviço, com pelo menos ${nameMin} letras.`;
  else if (name.length > nameMax) errors.name = `Use até ${nameMax} letras no nome.`;
  if (values.description.trim().length > descriptionMax) {
    errors.description = `Use até ${descriptionMax} caracteres na descrição.`;
  }
  const minutes = String(values.estimatedMinutes).trim();
  if (!/^\d+$/.test(minutes) || Number(minutes) < minutesMin || Number(minutes) > minutesMax) {
    errors.estimatedMinutes = `Use um número inteiro de ${minutesMin} a ${minutesMax} minutos.`;
  }
  return errors;
}

export function serviceTypeFormToApi(values: ServiceTypeForm) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    estimatedMinutes: Number(String(values.estimatedMinutes).trim()),
  };
}
