import { z } from 'zod';
import { imageSchema } from '../media/schemas.js';

const person = z.object({ id: z.number().int(), name: z.string() });

export const appointmentSchema = z
  .object({
    id: z.number().int(),
    startsAt: z.date(),
    endsAt: z.date(),
    version: z.number().int(),
    employee: person,
    request: z.object({
      id: z.number().int(),
      status: z.string(),
      statusLabel: z.string(),
      serviceType: z.string(),
      productKind: z.string(),
      brand: z.string().nullable(),
      model: z.string().nullable(),
      problem: z.string(),
      customer: person.extend({ phone: z.string().nullable() }),
      address: z.object({
        street: z.string(),
        number: z.string(),
        complement: z.string().nullable(),
        district: z.string(),
        city: z.string(),
        state: z.string(),
        cep: z.string(),
      }),
    }),
    report: z
      .object({
        status: z.enum(['SUBMITTED', 'APPROVED', 'REWORK']),
        defectFound: z.boolean(),
        defectDescription: z.string().nullable(),
        repairDescription: z.string(),
        submittedAt: z.date(),
        amountCents: z.number().int().nullable(),
        reworkComment: z.string().nullable(),
        approvedAt: z.date().nullable(),
        photos: z.array(imageSchema.extend({ id: z.number().int() })),
      })
      .nullable(),
  })
  .meta({ id: 'Appointment' });

export const rangeQuerySchema = z
  .object({
    from: z.coerce.date({ error: 'Data inicial inválida.' }),
    to: z.coerce.date({ error: 'Data final inválida.' }),
    employeeId: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => q.to > q.from, { error: 'A data final deve ser depois da inicial.', path: ['to'] })
  .refine((q) => q.to.getTime() - q.from.getTime() <= 62 * 86_400_000, {
    error: 'Consulte no máximo 62 dias por vez.',
    path: ['to'],
  });

export const appointmentCreationSchema = z.object({
  serviceRequestId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  startsAt: z.coerce.date({ error: 'Horário inválido.' }),
  endsAt: z.coerce.date({ error: 'Horário inválido.' }).optional(),
});

export const appointmentUpdateSchema = z.object({
  employeeId: z.number().int().positive().optional(),
  startsAt: z.coerce.date({ error: 'Horário inválido.' }).optional(),
  endsAt: z.coerce.date({ error: 'Horário inválido.' }).optional(),
});

export const reportInputSchema = z
  .object({
    defectFound: z.boolean(),
    defectDescription: z.string().trim().max(2000).optional(),
    repairDescription: z.string().trim().min(5, { error: 'Descreva o que foi feito.' }).max(2000),
  })
  .superRefine((value, ctx) => {
    if (value.defectFound && !value.defectDescription) {
      ctx.addIssue({
        code: 'custom',
        path: ['defectDescription'],
        message: 'Descreva o defeito encontrado.',
      });
    }
  });

export const reportApprovalSchema = z.object({
  amountCents: z.number().int().min(0, { error: 'Informe o valor do serviço.' }).max(100_000_000),
});

export const reworkSchema = z.object({
  comment: z.string().trim().min(5, { error: 'Explique o que precisa ser ajustado.' }).max(1000),
});

export const availabilitySchema = z.array(
  z.object({
    employee: person,
    busy: z.array(z.object({ appointmentId: z.number().int(), startsAt: z.date(), endsAt: z.date() })),
  }),
);
