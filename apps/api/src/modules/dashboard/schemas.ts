import { z } from 'zod';
import { appointmentSchema } from '../agenda/schemas.js';

const lowStockItemSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  stockAvailable: z.number().int(),
  stockMin: z.number().int().describe('Mínimo do produto ou, sem ele, o padrão da loja'),
});

const managementSchema = z.object({
  ordersByStatus: z.object({
    PENDING_REVIEW: z.number().int(),
    READY_FOR_PICKUP: z.number().int(),
    PICKED_UP: z.number().int(),
    CANCELED: z.number().int(),
  }),
  openServiceRequests: z.object({ REQUESTED: z.number().int(), AWAITING_CUSTOMER: z.number().int() }),
  quotesAwaitingAnswer: z.number().int(),
  reportsAwaitingApproval: z.number().int(),
  serviceRevenueMonthCents: z.number().int().describe('Serviços aprovados no mês corrente, em centavos'),
  agendaToday: z.array(
    z.object({
      employee: z.object({ id: z.number().int(), name: z.string() }),
      appointments: z.array(appointmentSchema),
    }),
  ),
  lowStock: z.object({ items: z.array(lowStockItemSchema), total: z.number().int() }),
});

const employeeSchema = z.object({
  visitsToday: z.array(appointmentSchema),
  pendingReports: z.number().int().describe('Visitas até hoje que ainda esperam a finalização'),
});

export const dashboardSchema = z
  .object({
    date: z.string().describe('Dia da loja (America/Sao_Paulo), AAAA-MM-DD'),
    management: managementSchema.nullable().describe('Indicadores da gerência; nulo para o colaborador'),
    employee: employeeSchema.nullable().describe('O dia do colaborador; nulo para a gerência'),
  })
  .meta({ id: 'Dashboard' });
