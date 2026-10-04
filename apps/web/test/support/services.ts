import type {
  RequestMessage,
  ServiceRequest,
  ServiceRequestListItem,
  ServiceType,
} from '~/utils/service-requests';
import { IMAGE } from './shop';

/** Service types and visit requests as the API answers them (packages/contracts/openapi.json). */

export const serviceType = (overrides: Partial<ServiceType> = {}): ServiceType => ({
  id: 1,
  name: 'Conserto de geladeira',
  description: 'Diagnóstico e reparo de geladeiras.',
  estimatedMinutes: 120,
  active: true,
  position: 0,
  ...overrides,
});

export const serviceRequest = (overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  id: 41,
  status: 'REQUESTED',
  statusLabel: 'Solicitado',
  serviceType: { id: 1, name: 'Conserto de geladeira' },
  productKind: 'Geladeira duplex',
  brand: 'Brastemp',
  model: null,
  problem: 'Não gela embaixo desde ontem.',
  address: {
    cep: '13800061',
    street: 'Rua Doutor Ulhoa Cintra',
    number: '91',
    complement: null,
    district: 'Centro',
    city: 'Mogi Mirim',
    state: 'SP',
  },
  windows: [
    { day: '2026-10-08', period: 'AFTERNOON' },
    { day: '2026-10-07', period: 'MORNING' },
  ],
  photos: [{ ...IMAGE, id: 5 }],
  customer: { id: 4, name: 'Carla Cliente', email: 'cliente@castro.dev', phone: '19999998888' },
  appointment: null,
  quoteId: null,
  rejectionReason: null,
  cancellationReason: null,
  canCancel: true,
  createdAt: '2026-10-04T13:00:00.000Z',
  updatedAt: '2026-10-04T13:00:00.000Z',
  ...overrides,
});

export const APPOINTMENT = {
  id: 9,
  employee: { id: 3, name: 'Tiago Técnico' },
  startsAt: '2026-10-07T11:00:00.000Z',
  endsAt: '2026-10-07T13:00:00.000Z',
};

export const requestListItem = (overrides: Partial<ServiceRequestListItem> = {}): ServiceRequestListItem => ({
  id: 41,
  status: 'REQUESTED',
  statusLabel: 'Solicitado',
  serviceType: 'Conserto de geladeira',
  productKind: 'Geladeira duplex',
  customer: { id: 4, name: 'Carla Cliente' },
  scheduledFor: null,
  employee: null,
  createdAt: '2026-10-04T13:00:00.000Z',
  updatedAt: '2026-10-04T13:00:00.000Z',
  ...overrides,
});

export const message = (id: number, mine: boolean, body: string): RequestMessage => ({
  id,
  body,
  author: mine
    ? { id: 4, name: 'Carla Cliente', role: 'CLIENT' }
    : { id: 2, name: 'Marina Gerente', role: 'MANAGER' },
  mine,
  createdAt: '2026-10-04T14:00:00.000Z',
});
