import type { AddressSnapshot } from './schema.js';
import type { Illustration } from './seed.js';

/**
 * Sample activity of the development database: customers with orders, service requests and quotes in
 * every state, so each screen and the user manual show real content. Days are relative to the day the
 * seed runs (negative is in the past) and hours are store hours in São Paulo.
 */

const MOGI_MIRIM = { city: 'Mogi Mirim', state: 'SP', complement: null };

export interface SampleCustomer {
  name: string;
  email: string;
  phone: string;
  address: AddressSnapshot;
}

/** The sample client of the base data; the activity seed only gives it an address. */
export const BASE_CUSTOMER_EMAIL = 'cliente@castro.dev';
export const STAFF_EMAIL = { manager: 'gerente@castro.dev', employee: 'tecnico@castro.dev' } as const;

export const SAMPLE_CUSTOMERS: SampleCustomer[] = [
  {
    name: 'Ana Cliente',
    email: BASE_CUSTOMER_EMAIL,
    phone: '19999990004',
    address: { ...MOGI_MIRIM, cep: '13800061', street: 'Rua Padre Roque', number: '412', district: 'Centro' },
  },
  {
    name: 'João Pereira',
    email: 'joao.pereira@castro.dev',
    phone: '19999990005',
    address: {
      ...MOGI_MIRIM,
      cep: '13806300',
      street: 'Rua Doutor José Alves',
      number: '87',
      district: 'Jardim Santa Helena',
    },
  },
  {
    name: 'Maria Souza',
    email: 'maria.souza@castro.dev',
    phone: '19999990006',
    address: {
      ...MOGI_MIRIM,
      cep: '13801005',
      street: 'Rua Chico de Paula',
      number: '230',
      district: 'Centro',
    },
  },
  {
    name: 'Lúcia Andrade',
    email: 'lucia.andrade@castro.dev',
    phone: '19999990007',
    address: {
      ...MOGI_MIRIM,
      cep: '13803420',
      street: 'Avenida Pedro Botesi',
      number: '1500',
      complement: 'Apto 32',
      district: 'Jardim Linda Chaib',
    },
  },
  {
    name: 'José Ribeiro (Bar do Zé)',
    email: 'bar.do.ze@castro.dev',
    phone: '19999990008',
    address: {
      ...MOGI_MIRIM,
      cep: '13805040',
      street: 'Rua Santa Cruz',
      number: '55',
      district: 'Vila Bianchi',
    },
  },
];

export type OrderStatus = 'PENDING_REVIEW' | 'READY_FOR_PICKUP' | 'PICKED_UP' | 'CANCELED';

export interface SampleOrder {
  customer: string;
  channel: 'ONLINE' | 'COUNTER';
  status: OrderStatus;
  day: number;
  items: Array<{ product: string; quantity: number }>;
  notes?: string;
  cancelReason?: string;
}

/** One order per status and channel. Products must have stock in SAMPLE_PRODUCTS. */
export const SAMPLE_ORDERS: SampleOrder[] = [
  {
    customer: BASE_CUSTOMER_EMAIL,
    channel: 'ONLINE',
    status: 'PENDING_REVIEW',
    day: 0,
    items: [{ product: 'Ar Condicionado Split Inverter Springer Midea 12000 BTUs', quantity: 1 }],
    notes: 'Quero agendar a instalação junto.',
  },
  {
    customer: 'joao.pereira@castro.dev',
    channel: 'ONLINE',
    status: 'PENDING_REVIEW',
    day: -1,
    items: [{ product: 'Bebedouro Esmaltec de Mesa', quantity: 1 }],
  },
  {
    customer: 'maria.souza@castro.dev',
    channel: 'ONLINE',
    status: 'READY_FOR_PICKUP',
    day: -2,
    items: [
      { product: 'Bebedouro de Coluna Libell Press Flex', quantity: 1 },
      { product: 'Compressor Embraco 1/4 HP', quantity: 1 },
    ],
  },
  {
    customer: 'lucia.andrade@castro.dev',
    channel: 'ONLINE',
    status: 'PICKED_UP',
    day: -9,
    items: [{ product: 'Lavadora Brastemp 12 kg', quantity: 1 }],
  },
  {
    customer: 'joao.pereira@castro.dev',
    channel: 'ONLINE',
    status: 'CANCELED',
    day: -6,
    items: [{ product: 'Freezer Horizontal Metalfrio 419L', quantity: 1 }],
    cancelReason: 'Comprei um modelo maior.',
  },
  {
    customer: 'bar.do.ze@castro.dev',
    channel: 'COUNTER',
    status: 'PICKED_UP',
    day: -3,
    items: [{ product: 'Compressor Embraco 1/4 HP', quantity: 2 }],
    notes: 'Pago no Pix.',
  },
  {
    customer: BASE_CUSTOMER_EMAIL,
    channel: 'ONLINE',
    status: 'PICKED_UP',
    day: -30,
    items: [{ product: 'Geladeira Brastemp Frost Free Duplex 375L', quantity: 1 }],
  },
];

export interface SampleMessage {
  from: string;
  body: string;
}

export interface SampleReport {
  status: 'SUBMITTED' | 'APPROVED';
  defectDescription: string;
  repairDescription: string;
  amountCents: number;
  photo: Illustration;
}

export interface SampleVisit {
  day: number;
  startHour: number;
  hours: number;
  report?: SampleReport;
}

export type RequestStatus =
  | 'REQUESTED'
  | 'AWAITING_CUSTOMER'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'AWAITING_COMPLETION_APPROVAL'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELED';

export interface SampleRequest {
  customer: string;
  serviceType: string;
  status: RequestStatus;
  day: number;
  productKind: string;
  brand: string | null;
  model: string | null;
  problem: string;
  windows: Array<{ day: number; period: 'MORNING' | 'AFTERNOON' }>;
  photo?: Illustration;
  messages?: SampleMessage[];
  visit?: SampleVisit;
  /** Index in SAMPLE_QUOTES of the accepted quote that opened the request. */
  quote?: number;
  rejectionReason?: string;
  cancellationReason?: string;
}

export type QuoteStatus = 'REQUESTED' | 'ANSWERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELED';

export interface SampleAnswer {
  amountCents: number;
  /** Days after the answer that the quote stays valid. */
  validDays: number;
  included: string;
  notes?: string;
}

export interface SampleQuote {
  customer: string;
  serviceType: string;
  status: QuoteStatus;
  day: number;
  description: string;
  photo?: Illustration;
  answer?: SampleAnswer;
  declineReason?: string;
  messages?: SampleMessage[];
}

const INSTALLATION_ANSWER: SampleAnswer = {
  amountCents: 45_000,
  validDays: 15,
  included: 'Suporte, até 3 metros de tubulação, dreno e teste de funcionamento.',
  notes: 'Metro adicional de tubulação: R$ 80,00.',
};

/** One quote per status. The ACCEPTED one (index 2) opened the scheduled installation request. */
export const SAMPLE_QUOTES: SampleQuote[] = [
  {
    customer: 'bar.do.ze@castro.dev',
    serviceType: 'Refrigeração comercial',
    status: 'REQUESTED',
    day: 0,
    description:
      'Preciso de orçamento para trocar o motor do expositor de bebidas, que está fazendo barulho.',
    photo: 'refrigeracao-comercial',
  },
  {
    customer: BASE_CUSTOMER_EMAIL,
    serviceType: 'Instalação de ar condicionado',
    status: 'ANSWERED',
    day: -1,
    description: 'Instalação do split de 12000 BTUs que comprei na loja, no quarto do segundo andar.',
    answer: INSTALLATION_ANSWER,
    messages: [{ from: BASE_CUSTOMER_EMAIL, body: 'A parede externa é de tijolo, dá para furar?' }],
  },
  {
    customer: 'lucia.andrade@castro.dev',
    serviceType: 'Instalação de ar condicionado',
    status: 'ACCEPTED',
    day: -8,
    description: 'Instalar um split de 9000 BTUs na sala do apartamento.',
    answer: INSTALLATION_ANSWER,
  },
  {
    customer: 'joao.pereira@castro.dev',
    serviceType: 'Manutenção de ar condicionado',
    status: 'DECLINED',
    day: -12,
    description: 'Limpeza completa de dois splits de 9000 BTUs.',
    answer: {
      amountCents: 36_000,
      validDays: 15,
      included: 'Limpeza das duas unidades internas e externas.',
    },
    declineReason: 'Achei caro para agora, vou esperar o verão.',
  },
  {
    customer: 'maria.souza@castro.dev',
    serviceType: 'Conserto de geladeira',
    status: 'EXPIRED',
    day: -40,
    description: 'Troca da borracha da porta da geladeira Consul.',
    answer: { amountCents: 18_000, validDays: 15, included: 'Borracha nova original e mão de obra.' },
  },
  {
    customer: 'maria.souza@castro.dev',
    serviceType: 'Conserto de lavadora',
    status: 'CANCELED',
    day: -5,
    description: 'Lavadora não centrifuga.',
  },
];

const ANA = BASE_CUSTOMER_EMAIL;
const MANAGER = STAFF_EMAIL.manager;

/** One service request per status, with visits for the employee today and on the next days. */
export const SAMPLE_REQUESTS: SampleRequest[] = [
  {
    customer: ANA,
    serviceType: 'Conserto de geladeira',
    status: 'REQUESTED',
    day: 0,
    productKind: 'Geladeira',
    brand: 'Consul',
    model: 'CRM39',
    problem: 'A parte de baixo parou de gelar e o freezer está formando muito gelo.',
    windows: [
      { day: 1, period: 'MORNING' },
      { day: 2, period: 'AFTERNOON' },
    ],
    photo: 'geladeira',
  },
  {
    customer: 'joao.pereira@castro.dev',
    serviceType: 'Manutenção de ar condicionado',
    status: 'AWAITING_CUSTOMER',
    day: -1,
    productKind: 'Ar condicionado split',
    brand: 'LG',
    model: null,
    problem: 'O aparelho está pingando água dentro do quarto.',
    windows: [{ day: 3, period: 'MORNING' }],
    photo: 'ar-condicionado',
    messages: [
      { from: 'joao.pereira@castro.dev', body: 'Pode ser em qualquer manhã desta semana.' },
      { from: MANAGER, body: 'Qual é a capacidade do aparelho em BTUs e a que altura ele está instalado?' },
    ],
  },
  {
    customer: 'maria.souza@castro.dev',
    serviceType: 'Conserto de lavadora',
    status: 'APPROVED',
    day: -1,
    productKind: 'Lavadora',
    brand: 'Electrolux',
    model: 'LT12F',
    problem: 'Não centrifuga e faz barulho no fim do ciclo.',
    windows: [
      { day: 2, period: 'MORNING' },
      { day: 4, period: 'AFTERNOON' },
    ],
    messages: [
      { from: MANAGER, body: 'Aprovado. Vamos marcar a visita em um dos períodos que você indicou.' },
    ],
  },
  {
    customer: 'lucia.andrade@castro.dev',
    serviceType: 'Instalação de ar condicionado',
    status: 'SCHEDULED',
    day: -6,
    productKind: 'Ar condicionado split',
    brand: 'Gree',
    model: 'GWC09QA',
    problem: 'Instalação do orçamento aceito: split de 9000 BTUs na sala.',
    windows: [{ day: 0, period: 'AFTERNOON' }],
    quote: 2,
    visit: { day: 0, startHour: 14, hours: 4 },
  },
  {
    customer: 'bar.do.ze@castro.dev',
    serviceType: 'Refrigeração comercial',
    status: 'SCHEDULED',
    day: -2,
    productKind: 'Expositor refrigerado',
    brand: 'Metalfrio',
    model: 'VB40',
    problem: 'O expositor não chega na temperatura e a porta está suando.',
    windows: [{ day: 1, period: 'MORNING' }],
    photo: 'refrigeracao-comercial',
    visit: { day: 1, startHour: 8, hours: 3 },
  },
  {
    customer: 'bar.do.ze@castro.dev',
    serviceType: 'Conserto de bebedouro',
    status: 'AWAITING_COMPLETION_APPROVAL',
    day: -4,
    productKind: 'Bebedouro de coluna',
    brand: 'Libell',
    model: null,
    problem: 'A água não sai gelada.',
    windows: [{ day: -1, period: 'MORNING' }],
    visit: {
      day: -1,
      startHour: 9,
      hours: 1,
      report: {
        status: 'SUBMITTED',
        defectDescription: 'Termostato travado.',
        repairDescription: 'Troca do termostato e limpeza do reservatório.',
        amountCents: 12_000,
        photo: 'bebedouro',
      },
    },
  },
  {
    customer: ANA,
    serviceType: 'Conserto de geladeira',
    status: 'COMPLETED',
    day: -12,
    productKind: 'Geladeira',
    brand: 'Brastemp',
    model: 'BRM44',
    problem: 'Geladeira desligando sozinha.',
    windows: [{ day: -9, period: 'AFTERNOON' }],
    visit: {
      day: -9,
      startHour: 14,
      hours: 2,
      report: {
        status: 'APPROVED',
        defectDescription: 'Relé de partida do compressor queimado.',
        repairDescription: 'Troca do relé e do protetor térmico; geladeira testada por uma hora.',
        amountCents: 22_000,
        photo: 'geladeira',
      },
    },
  },
  {
    customer: 'maria.souza@castro.dev',
    serviceType: 'Conserto de geladeira',
    status: 'REJECTED',
    day: -7,
    productKind: 'Frigobar',
    brand: null,
    model: null,
    problem: 'Frigobar de 1998 não liga mais.',
    windows: [{ day: -5, period: 'MORNING' }],
    rejectionReason: 'Não há mais peças para esse modelo. Podemos indicar um usado revisado da loja.',
  },
  {
    customer: 'joao.pereira@castro.dev',
    serviceType: 'Conserto de lavadora',
    status: 'CANCELED',
    day: -10,
    productKind: 'Lava e seca',
    brand: 'Samsung',
    model: null,
    problem: 'Erro na tela ao iniciar a secagem.',
    windows: [{ day: -8, period: 'AFTERNOON' }],
    cancellationReason: 'O aparelho voltou a funcionar depois de desligar da tomada.',
  },
];
