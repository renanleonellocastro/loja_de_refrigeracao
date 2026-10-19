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

function serviceNameError(name: string): string | undefined {
  const { nameMin, nameMax } = SERVICE_TYPE_LIMITS;
  const length = name.trim().length;
  if (length < nameMin) return `Informe o nome do serviço, com pelo menos ${nameMin} letras.`;
  return length > nameMax ? `Use até ${nameMax} letras no nome.` : undefined;
}

function serviceDescriptionError(description: string): string | undefined {
  const { descriptionMax } = SERVICE_TYPE_LIMITS;
  return description.trim().length > descriptionMax
    ? `Use até ${descriptionMax} caracteres na descrição.`
    : undefined;
}

function estimatedMinutesError(value: string): string | undefined {
  const { minutesMin, minutesMax } = SERVICE_TYPE_LIMITS;
  const minutes = String(value).trim();
  const isInRange = Number(minutes) >= minutesMin && Number(minutes) <= minutesMax;
  return isWholeNumberText(minutes) && isInRange
    ? undefined
    : `Use um número inteiro de ${minutesMin} a ${minutesMax} minutos.`;
}

/** Same rules as the API, so most mistakes show up before the request. */
export function validateServiceTypeForm(values: ServiceTypeForm): FieldErrors {
  return collectFieldErrors({
    name: () => serviceNameError(values.name),
    description: () => serviceDescriptionError(values.description),
    estimatedMinutes: () => estimatedMinutesError(values.estimatedMinutes),
  });
}

export function serviceTypeFormToApi(values: ServiceTypeForm) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    estimatedMinutes: Number(String(values.estimatedMinutes).trim()),
  };
}
