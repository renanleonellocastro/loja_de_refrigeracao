import { BRAZILIAN_STATES, ROLES, digits, isValidCep, isValidCpf, isValidPhone } from '@rc/contracts';
import { z } from 'zod';
import { orderStatusEnum, serviceRequestStatusEnum } from '../../infra/db/schema.js';
import { emailSchema } from '../../shared/schemas.js';

export const userSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    role: z.enum(ROLES),
  })
  .meta({ id: 'UserSummary' });

export type UserSummary = z.infer<typeof userSummarySchema>;

export function toUserSummary(user: {
  id: number;
  name: string;
  email: string;
  role: (typeof ROLES)[number];
}) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

const nameSchema = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .min(3, { error: 'Informe o nome completo.' })
  .max(120, { error: 'Nome longo demais.' });

export const cpfSchema = z.string().transform(digits).refine(isValidCpf, { error: 'CPF inválido.' });

export const phoneSchema = z
  .string()
  .transform(digits)
  .refine(isValidPhone, { error: 'Telefone inválido. Use DDD e número.' });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

// Input only: schemas with transforms are not registered as named components (they differ as input and output).
export const addressSchema = z.object({
  cep: z.string().transform(digits).refine(isValidCep, { error: 'CEP inválido.' }),
  street: z.string().trim().min(2, { error: 'Informe a rua.' }).max(150),
  number: z.string().trim().min(1, { error: 'Informe o número.' }).max(20),
  complement: optionalText(80),
  district: z.string().trim().min(2, { error: 'Informe o bairro.' }).max(80),
  city: z.string().trim().min(2, { error: 'Informe a cidade.' }).max(80),
  state: z.enum(BRAZILIAN_STATES, { error: 'UF inválida.' }),
});

/** Response shape (no transforms: response schemas are encoded, not parsed). */
export const addressViewSchema = z
  .object({
    cep: z.string(),
    street: z.string(),
    number: z.string(),
    complement: z.string().nullable(),
    district: z.string(),
    city: z.string(),
    state: z.string(),
  })
  .meta({ id: 'Address' });

export const customerRegistrationSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(1, { error: 'Informe a senha.' }).max(256),
  cpf: cpfSchema.nullable().optional(),
  address: addressSchema.nullable().optional(),
  acceptPrivacy: z.literal(true, { error: 'É preciso aceitar a política de privacidade.' }),
});

export const STAFF_CREATABLE_ROLES = ['CLIENT', 'EMPLOYEE', 'MANAGER'] as const;

export const userCreationSchema = z
  .object({
    role: z.enum(STAFF_CREATABLE_ROLES),
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema.nullable().optional(),
    cpf: cpfSchema.nullable().optional(),
    address: addressSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role !== 'CLIENT' && !value.cpf) {
      ctx.addIssue({ code: 'custom', path: ['cpf'], message: 'CPF é obrigatório para a equipe.' });
    }
  });

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.nullable().optional(),
  cpf: cpfSchema.nullable().optional(),
  address: addressSchema.nullable().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const accountDeletionSchema = z.object({
  password: z.string().min(1, { error: 'Confirme com sua senha.' }).max(256),
});

export const userDetailSchema = z
  .object({
    id: z.number().int(),
    role: z.enum(ROLES),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    cpf: z.string().nullable(),
    address: addressViewSchema.nullable(),
    emailVerified: z.boolean(),
    pendingInvitation: z.boolean(),
    createdAt: z.date(),
  })
  .meta({ id: 'UserDetail' });

/** Number of recent orders, service requests or appointments shown on a user detail. */
export const RECENT_ACTIVITY_LIMIT = 5;

export const userWithActivitySchema = userDetailSchema
  .extend({
    recentOrders: z
      .array(
        z.object({
          id: z.number().int(),
          number: z.string(),
          status: z.enum(orderStatusEnum.enumValues),
          totalCents: z.number().int(),
          createdAt: z.date(),
        }),
      )
      .describe('Últimos pedidos do cliente (vazio para a equipe ou sem permissão de gerenciar pedidos)'),
    recentServiceRequests: z
      .array(
        z.object({
          id: z.number().int(),
          status: z.enum(serviceRequestStatusEnum.enumValues),
          serviceType: z.string(),
          productKind: z.string(),
          createdAt: z.date(),
        }),
      )
      .describe('Últimas solicitações de serviço do cliente (vazio sem permissão de gerenciar solicitações)'),
    recentAppointments: z
      .array(
        z.object({
          id: z.number().int(),
          startsAt: z.date(),
          endsAt: z.date(),
          status: z.enum(serviceRequestStatusEnum.enumValues),
          serviceType: z.string(),
          customerName: z.string(),
        }),
      )
      .describe('Últimos atendimentos do colaborador (vazio para os demais papéis)'),
  })
  .meta({ id: 'UserWithActivity' });

export const userListItemSchema = z
  .object({
    id: z.number().int(),
    role: z.enum(ROLES),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    cpf: z.string().nullable(),
    createdAt: z.date(),
  })
  .meta({ id: 'UserListItem' });

export const userListQuerySchema = z.object({
  role: z.enum(ROLES),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const cepQuerySchema = z.object({
  cep: z.string().transform(digits).refine(isValidCep, { error: 'CEP inválido.' }),
});

export const cepLookupSchema = z
  .object({
    cep: z.string(),
    street: z.string(),
    district: z.string(),
    city: z.string(),
    state: z.string(),
  })
  .meta({ id: 'CepLookup' });
