import type { ApiSchemas, Permission, Role } from '@rc/contracts';

/** Staff screens for people (docs/DESIGN.md section 4): customers, employees and managers share components. */

export type DirectoryKind = 'CLIENT' | 'EMPLOYEE' | 'MANAGER';
export type UserListItem = ApiSchemas['UserListItem'];
export type UserDetail = ApiSchemas['UserDetail'];

export interface DirectoryConfig {
  kind: DirectoryKind;
  /** Roles shown by this screen; the managers list also brings the super user. */
  roles: readonly Role[];
  path: string;
  title: string;
  /** Lowercase noun for buttons and messages, for example "cliente". */
  noun: string;
  /** Noun with its article, for confirmation titles: "este cliente". */
  thisNoun: string;
  /** Who can register a new person on this screen. */
  createPermission: Permission;
  /** The team signs in with a CPF on record; customers may leave it blank. */
  cpfRequired: boolean;
  emptyTitle: string;
  emptyText: string;
}

export const DIRECTORIES: Record<DirectoryKind, DirectoryConfig> = {
  CLIENT: {
    kind: 'CLIENT',
    roles: ['CLIENT'],
    path: '/clientes',
    title: 'Clientes',
    noun: 'cliente',
    thisNoun: 'este cliente',
    createPermission: 'users.create',
    cpfRequired: false,
    emptyTitle: 'Nenhum cliente por aqui ainda',
    emptyText: 'Quando alguém criar uma conta ou for cadastrado no balcão, aparece nesta lista.',
  },
  EMPLOYEE: {
    kind: 'EMPLOYEE',
    roles: ['EMPLOYEE'],
    path: '/colaboradores',
    title: 'Colaboradores',
    noun: 'colaborador',
    thisNoun: 'este colaborador',
    createPermission: 'employees.manage',
    cpfRequired: true,
    emptyTitle: 'Nenhum colaborador cadastrado',
    emptyText: 'Cadastre os técnicos da loja para distribuir as visitas da agenda.',
  },
  MANAGER: {
    kind: 'MANAGER',
    roles: ['MANAGER', 'ADMIN'],
    path: '/gerentes',
    title: 'Gerentes',
    noun: 'gerente',
    thisNoun: 'este gerente',
    createPermission: 'managers.manage',
    cpfRequired: true,
    emptyTitle: 'Nenhum gerente cadastrado',
    emptyText: 'Cadastre quem cuida dos pedidos, orçamentos e da agenda da equipe.',
  },
};

export const USERS_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

export type PersonForm = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  address: AddressForm;
};

export function personFromUser(user: UserDetail | null): PersonForm {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    cpf: user?.cpf ?? '',
    address: addressFromApi(user?.address),
  };
}

/** Same rules as the API: customers need a phone to schedule visits, the team needs a CPF. */
export function validatePersonForm(values: PersonForm, kind: DirectoryKind): FieldErrors {
  const cpfRequired = DIRECTORIES[kind].cpfRequired;
  return {
    ...validatePerson(values, { cpfRequired, phoneRequired: kind === 'CLIENT' }),
    ...validateAddress(values.address, false),
  };
}

/** Body shared by POST /users and PATCH /users/{id}. */
export function personToApi(values: PersonForm) {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone || null,
    cpf: values.cpf || null,
    address: addressToApi(values.address),
  };
}

/** Audit resource types recorded by the API, in the words of the store. */
export const AUDIT_RESOURCES: Record<string, string> = {
  user: 'Usuários',
  product: 'Produtos',
  category: 'Categorias',
  order: 'Pedidos',
  serviceRequest: 'Solicitações de serviço',
  appointment: 'Agendamentos',
  quote: 'Orçamentos',
  serviceType: 'Tipos de serviço',
  store: 'Configurações da loja',
};

const AUDIT_VERBS: Record<string, string> = {
  create: 'Cadastro',
  update: 'Alteração',
  delete: 'Exclusão',
  cancel: 'Cancelamento',
  approve: 'Aprovação',
  reject: 'Recusa',
  answer: 'Resposta',
  stock: 'Ajuste de estoque',
  reorder: 'Nova ordem',
  deactivate: 'Desativação',
  unarchive: 'Reativação',
};

/** "product.update" becomes "Alteração"; unknown actions keep their code so nothing is hidden. */
export function auditActionLabel(action: string): string {
  const verb = action.split('.').pop()!;
  return AUDIT_VERBS[verb] ?? action;
}

export function auditResourceLabel(resourceType: string): string {
  return AUDIT_RESOURCES[resourceType] ?? resourceType;
}

/** Pretty JSON for the before and after panels; empty values read as a dash. */
export function prettyJson(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value, null, 2);
}

/** Start or end of a calendar day in the store time zone, as the API filter expects. */
export function dayBoundary(date: string, end: boolean): string | undefined {
  if (!date) return undefined;
  return `${date}T${end ? '23:59:59.999' : '00:00:00.000'}-03:00`;
}

/** Weekdays as the API keys them (0 is Sunday), listed from Monday like the store calendar. */
export const WEEKDAYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: '1', label: 'Segunda' },
  { key: '2', label: 'Terça' },
  { key: '3', label: 'Quarta' },
  { key: '4', label: 'Quinta' },
  { key: '5', label: 'Sexta' },
  { key: '6', label: 'Sábado' },
  { key: '0', label: 'Domingo' },
];

export interface DayHoursForm {
  open: boolean;
  opens: string;
  closes: string;
}

export type StoreSettings = ApiSchemas['StoreSettings'];

export type StoreForm = {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: AddressForm;
  openingHours: Record<string, DayHoursForm>;
  notificationEmails: string;
  defaultStockMin: string;
};

export function storeFormFrom(settings: StoreSettings): StoreForm {
  const openingHours: Record<string, DayHoursForm> = {};
  for (const { key } of WEEKDAYS) {
    const day = settings.openingHours[key];
    openingHours[key] = day
      ? { open: true, opens: day.opens, closes: day.closes }
      : { open: false, opens: '09:00', closes: '18:00' };
  }
  return {
    name: settings.name,
    phone: settings.phone,
    whatsapp: settings.whatsapp ?? '',
    email: settings.email,
    address: addressFromApi(settings.address),
    openingHours,
    notificationEmails: settings.notificationEmails.join('\n'),
    defaultStockMin: String(settings.defaultStockMin),
  };
}

/** One email per line or separated by commas; blank lines are ignored. */
export function parseEmailList(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_NOTIFICATION_EMAILS = 10;

export function validateStoreForm(values: StoreForm): FieldErrors {
  const errors: FieldErrors = { ...validateAddress(values.address, true) };
  if (values.name.trim().length < 3) errors.name = 'Informe o nome da loja.';
  if (!isValidPhone(values.phone)) errors.phone = 'Digite o telefone com DDD, como (19) 3804-1658.';
  if (values.whatsapp && !isValidPhone(values.whatsapp)) {
    errors.whatsapp = 'Digite o WhatsApp com DDD, como (19) 99999-9999.';
  }
  if (!EMAIL_PATTERN.test(values.email.trim()))
    errors.email = 'Digite um email válido, como nome@exemplo.com.';
  for (const { key, label } of WEEKDAYS) {
    const day = values.openingHours[key]!;
    if (!day.open) continue;
    if (!TIME_PATTERN.test(day.opens))
      errors[`openingHours.${key}.opens`] = `Informe quando abre na ${label}.`;
    else if (!TIME_PATTERN.test(day.closes)) {
      errors[`openingHours.${key}.closes`] = `Informe quando fecha na ${label}.`;
    } else if (day.closes <= day.opens) {
      errors[`openingHours.${key}.closes`] = 'O fechamento precisa ser depois da abertura.';
    }
  }
  const emails = parseEmailList(values.notificationEmails);
  const wrong = emails.find((email) => !EMAIL_PATTERN.test(email));
  if (wrong) errors.notificationEmails = `Confira o email ${wrong}.`;
  else if (emails.length > MAX_NOTIFICATION_EMAILS) {
    errors.notificationEmails = `Use até ${MAX_NOTIFICATION_EMAILS} emails.`;
  }
  // Number inputs hand back numbers through v-model, so read the value as text first.
  const stock = String(values.defaultStockMin).trim();
  if (!/^\d+$/.test(stock) || Number(stock) > 1000) {
    errors.defaultStockMin = 'Use um número inteiro de 0 a 1000.';
  }
  return errors;
}

export function storeFormToApi(values: StoreForm) {
  const openingHours: Record<string, { opens: string; closes: string } | null> = {};
  for (const { key } of WEEKDAYS) {
    const day = values.openingHours[key]!;
    openingHours[key] = day.open ? { opens: day.opens, closes: day.closes } : null;
  }
  return {
    name: values.name.trim(),
    phone: values.phone,
    whatsapp: values.whatsapp || null,
    email: values.email.trim(),
    address: addressToApi(values.address)!,
    openingHours: openingHours as Record<
      '0' | '1' | '2' | '3' | '4' | '5' | '6',
      { opens: string; closes: string } | null
    >,
    notificationEmails: parseEmailList(values.notificationEmails),
    defaultStockMin: Number(values.defaultStockMin),
  };
}
