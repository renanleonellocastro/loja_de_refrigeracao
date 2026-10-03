import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  Hourglass,
  Inbox,
  MessageCircleQuestion,
  PackageCheck,
  ReceiptText,
  ThumbsDown,
  ThumbsUp,
  TimerOff,
} from 'lucide-vue-next';
import type { Component } from 'vue';

/** Color family of a status badge. Every family has a soft background and a readable foreground. */
export type StatusTone = 'info' | 'progress' | 'warning' | 'success' | 'danger' | 'neutral';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  icon: Component;
}

export const ORDER_STATUSES = ['PENDING_REVIEW', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELED'] as const;
export const SERVICE_REQUEST_STATUSES = [
  'REQUESTED',
  'AWAITING_CUSTOMER',
  'APPROVED',
  'SCHEDULED',
  'AWAITING_COMPLETION_APPROVAL',
  'COMPLETED',
  'REJECTED',
  'CANCELED',
] as const;
export const QUOTE_STATUSES = [
  'REQUESTED',
  'ANSWERED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type StatusKind = 'order' | 'serviceRequest' | 'quote';

/** Labels follow docs/DOMINIO.md section 2. Color and icon are fixed per status across the whole system. */
export const STATUS_META: {
  order: Record<OrderStatus, StatusMeta>;
  serviceRequest: Record<ServiceRequestStatus, StatusMeta>;
  quote: Record<QuoteStatus, StatusMeta>;
} = {
  order: {
    PENDING_REVIEW: { label: 'Em análise', tone: 'info', icon: Hourglass },
    READY_FOR_PICKUP: { label: 'Aguardando retirada', tone: 'warning', icon: PackageCheck },
    PICKED_UP: { label: 'Retirado', tone: 'success', icon: CircleCheck },
    CANCELED: { label: 'Cancelado', tone: 'neutral', icon: Ban },
  },
  serviceRequest: {
    REQUESTED: { label: 'Solicitado', tone: 'info', icon: Inbox },
    AWAITING_CUSTOMER: { label: 'Em conversa', tone: 'warning', icon: MessageCircleQuestion },
    APPROVED: { label: 'Aprovado', tone: 'progress', icon: ThumbsUp },
    SCHEDULED: { label: 'Agendado', tone: 'progress', icon: CalendarClock },
    AWAITING_COMPLETION_APPROVAL: { label: 'Aguardando aprovação', tone: 'warning', icon: ClipboardCheck },
    COMPLETED: { label: 'Concluído', tone: 'success', icon: CalendarCheck },
    REJECTED: { label: 'Recusado', tone: 'danger', icon: CircleX },
    CANCELED: { label: 'Cancelado', tone: 'neutral', icon: Ban },
  },
  quote: {
    REQUESTED: { label: 'Solicitado', tone: 'info', icon: Clock },
    ANSWERED: { label: 'Respondido', tone: 'progress', icon: ReceiptText },
    ACCEPTED: { label: 'Aceito', tone: 'success', icon: CheckCheck },
    DECLINED: { label: 'Recusado', tone: 'danger', icon: ThumbsDown },
    EXPIRED: { label: 'Vencido', tone: 'neutral', icon: TimerOff },
    CANCELED: { label: 'Cancelado', tone: 'neutral', icon: Ban },
  },
};

export function statusMeta(kind: StatusKind, status: string): StatusMeta {
  const table: Record<string, StatusMeta> = STATUS_META[kind];
  return table[status] ?? { label: status, tone: 'neutral', icon: Clock };
}
