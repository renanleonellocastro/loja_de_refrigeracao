import type { ApiSchemas } from '@rc/contracts';
import { FALLBACK_STORE, type StorePublic } from '~/utils/store';
import { appointment } from './agenda';

/** Store data as GET /api/v1/store answers it, open by default. */
export const storeData = (overrides: Partial<StorePublic> = {}): StorePublic => ({
  ...FALLBACK_STORE,
  openNow: true,
  ...overrides,
});

type Dashboard = ApiSchemas['Dashboard'];
type Management = NonNullable<Dashboard['management']>;

/** Management dashboard as GET /api/v1/dashboard answers it. */
export const managementDashboard = (overrides: Partial<Management> = {}): Dashboard => ({
  date: '2026-10-05',
  employee: null,
  management: {
    ordersByStatus: { PENDING_REVIEW: 2, READY_FOR_PICKUP: 0, PICKED_UP: 5, CANCELED: 1 },
    openServiceRequests: { REQUESTED: 3, AWAITING_CUSTOMER: 1 },
    quotesAwaitingAnswer: 4,
    reportsAwaitingApproval: 1,
    serviceRevenueMonthCents: 123_456,
    agendaToday: [
      { employee: { id: 3, name: 'Tiago Técnico' }, appointments: [appointment(), appointment({ id: 10 })] },
    ],
    lowStock: {
      total: 3,
      items: [
        { id: 7, slug: 'geladeira', name: 'Geladeira Frost Free', stockAvailable: 0, stockMin: 2 },
        { id: 8, slug: 'bebedouro', name: 'Bebedouro de coluna', stockAvailable: 1, stockMin: 2 },
      ],
    },
    ...overrides,
  },
});
