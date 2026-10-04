/**
 * Endpoints documented in docs/API.md that are not in the generated OpenAPI yet (notifications and store
 * settings, milestone M8). They follow the openapi-typescript shape so the typed client accepts them; once the
 * API publishes them, `pnpm --filter @rc/contracts generate` brings the real types and this file goes away.
 */

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  /** Path inside the site, for example /minha-conta/pedidos/12. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface OpeningPeriod {
  opens: string;
  closes: string;
}

export interface StoreAddress {
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
}

export interface StoreSettings {
  name: string;
  legalName: string;
  cnpj: string;
  phone: string;
  whatsapp: string | null;
  email: string;
  address: StoreAddress;
  /** Keys 0 (Sunday) to 6 (Saturday); null means closed. */
  openingHours: Record<string, OpeningPeriod | null>;
  notificationEmails: string[];
  defaultStockMin: number;
}

interface PageOf<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

type NoParameters = { query?: never; header?: never; path?: never; cookie?: never };

interface Operation<Query, Path, Body, Result> {
  parameters: {
    query?: Query;
    header?: never;
    path: Path;
    cookie?: never;
  };
  requestBody: [Body] extends [never] ? never : { content: { 'application/json': Body } };
  responses: {
    200: { headers: Record<string, unknown>; content: { 'application/json': Result } };
    204: { headers: Record<string, unknown>; content?: never };
    default: { headers: Record<string, unknown>; content: { 'application/json': unknown } };
  };
}

interface PathItem {
  parameters: NoParameters;
  get?: never;
  put?: never;
  post?: never;
  delete?: never;
  options?: never;
  head?: never;
  patch?: never;
  trace?: never;
}

export interface ExtraPaths {
  '/api/v1/me/notifications': Omit<PathItem, 'get'> & {
    get: Operation<{ unread?: boolean; page?: number; pageSize?: number }, never, never, PageOf<NotificationItem>>;
  };
  '/api/v1/me/notifications/{id}/read': Omit<PathItem, 'post'> & {
    post: Operation<never, { id: number }, never, never>;
  };
  '/api/v1/me/notifications/read-all': Omit<PathItem, 'post'> & {
    post: Operation<never, never, never, never>;
  };
  '/api/v1/store/settings': Omit<PathItem, 'get'> & {
    get: Operation<never, never, never, StoreSettings>;
  };
  '/api/v1/store': Omit<PathItem, 'patch'> & {
    patch: Operation<never, never, Partial<StoreSettings>, StoreSettings>;
  };
}
