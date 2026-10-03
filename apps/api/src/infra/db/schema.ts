import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Column names are mapped to snake_case by the `casing` option of the Drizzle client and config.
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const money = () => bigint({ mode: 'number' });

export const roleEnum = pgEnum('role', ['ADMIN', 'MANAGER', 'EMPLOYEE', 'CLIENT']);
export const authTokenPurposeEnum = pgEnum('auth_token_purpose', [
  'PASSWORD_RESET',
  'INVITATION',
  'EMAIL_VERIFICATION',
]);
export const productConditionEnum = pgEnum('product_condition', ['NEW', 'USED']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'IN',
  'ADJUSTMENT',
  'LOSS',
  'RESERVATION',
  'RELEASE',
  'SALE',
]);
export const orderChannelEnum = pgEnum('order_channel', ['ONLINE', 'COUNTER']);
export const orderStatusEnum = pgEnum('order_status', [
  'PENDING_REVIEW',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'CANCELED',
]);
export const serviceRequestStatusEnum = pgEnum('service_request_status', [
  'REQUESTED',
  'AWAITING_CUSTOMER',
  'APPROVED',
  'SCHEDULED',
  'AWAITING_COMPLETION_APPROVAL',
  'COMPLETED',
  'REJECTED',
  'CANCELED',
]);
export const dayPeriodEnum = pgEnum('day_period', ['MORNING', 'AFTERNOON']);
export const quoteStatusEnum = pgEnum('quote_status', [
  'REQUESTED',
  'ANSWERED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELED',
]);
export const reportStatusEnum = pgEnum('service_report_status', ['SUBMITTED', 'APPROVED', 'REWORK']);
export const threadTypeEnum = pgEnum('thread_type', ['SERVICE_REQUEST', 'QUOTE']);
export const mediaOwnerEnum = pgEnum('media_owner', ['SERVICE_REQUEST', 'SERVICE_REPORT', 'QUOTE']);

export const users = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    role: roleEnum().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    cpf: text(),
    phone: text(),
    passwordHash: text(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    privacyAcceptedAt: timestamp({ withTimezone: true }),
    privacyVersion: text(),
    /** Name, email, phone and CPF lowercased without accents, for search (see shared/text.ts). */
    searchText: text().notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_active_unique')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex('users_cpf_active_unique')
      .on(t.cpf)
      .where(sql`${t.deletedAt} is null and ${t.cpf} is not null`),
    index('users_role_idx').on(t.role),
    index('users_search_trgm_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const addresses = pgTable('addresses', {
  userId: integer()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cep: text().notNull(),
  street: text().notNull(),
  number: text().notNull(),
  complement: text(),
  district: text().notNull(),
  city: text().notNull(),
  state: text().notNull(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid().notNull(),
    refreshTokenHash: text().notNull().unique(),
    userAgent: text(),
    ip: text(),
    createdAt: createdAt(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    rotatedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_family_idx').on(t.familyId)],
);

export const authTokens = pgTable(
  'auth_tokens',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: authTokenPurposeEnum().notNull(),
    tokenHash: text().notNull().unique(),
    payload: jsonb().$type<Record<string, string>>(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('auth_tokens_user_purpose_idx').on(t.userId, t.purpose)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    email: text().notNull(),
    ip: text().notNull(),
    succeeded: boolean().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('login_attempts_email_idx').on(t.email, t.createdAt),
    index('login_attempts_ip_idx').on(t.ip, t.createdAt),
  ],
);

export const categories = pgTable('categories', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  position: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = pgTable(
  'products',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    categoryId: integer()
      .notNull()
      .references(() => categories.id),
    brand: text(),
    model: text(),
    condition: productConditionEnum().notNull().default('NEW'),
    description: text().notNull().default(''),
    priceCents: money().notNull(),
    stockAvailable: integer().notNull().default(0),
    stockMin: integer(),
    searchText: text().notNull().default(''),
    archivedAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('products_stock_non_negative', sql`${t.stockAvailable} >= 0`),
    check('products_price_non_negative', sql`${t.priceCents} >= 0`),
    index('products_category_idx').on(t.categoryId),
    index('products_search_trgm_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    position: integer().notNull().default(0),
    isCover: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('product_images_product_idx').on(t.productId, t.position)],
);

export const orders = pgTable(
  'orders',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer()
      .notNull()
      .references(() => users.id),
    channel: orderChannelEnum().notNull(),
    status: orderStatusEnum().notNull(),
    totalCents: money().notNull(),
    createdById: integer()
      .notNull()
      .references(() => users.id),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_customer_idx').on(t.customerId),
    index('orders_status_idx').on(t.status, t.createdAt),
  ],
);

export const orderItems = pgTable('order_items', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer()
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer()
    .notNull()
    .references(() => products.id),
  productName: text().notNull(),
  unitPriceCents: money().notNull(),
  quantity: integer().notNull(),
});

export const orderEvents = pgTable(
  'order_events',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatusEnum(),
    toStatus: orderStatusEnum().notNull(),
    actorId: integer().references(() => users.id),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId)],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: stockMovementTypeEnum().notNull(),
    quantity: integer().notNull(),
    reason: text(),
    authorId: integer().references(() => users.id),
    orderId: integer().references(() => orders.id),
    createdAt: createdAt(),
  },
  (t) => [index('stock_movements_product_idx').on(t.productId, t.createdAt)],
);

export const cartItems = pgTable(
  'cart_items',
  {
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.productId] }),
    check('cart_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

export const serviceTypes = pgTable('service_types', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull().unique(),
  description: text().notNull().default(''),
  estimatedMinutes: integer().notNull().default(60),
  active: boolean().notNull().default(true),
  position: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface AddressSnapshot {
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
}

export const quotes = pgTable(
  'quotes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer()
      .notNull()
      .references(() => users.id),
    serviceTypeId: integer()
      .notNull()
      .references(() => serviceTypes.id),
    description: text().notNull(),
    status: quoteStatusEnum().notNull().default('REQUESTED'),
    amountCents: money(),
    validUntil: date({ mode: 'string' }),
    included: text(),
    notes: text(),
    answeredById: integer().references(() => users.id),
    answeredAt: timestamp({ withTimezone: true }),
    decidedAt: timestamp({ withTimezone: true }),
    declineReason: text(),
    createdById: integer()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('quotes_customer_idx').on(t.customerId),
    index('quotes_status_idx').on(t.status, t.createdAt),
  ],
);

export const serviceRequests = pgTable(
  'service_requests',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    customerId: integer()
      .notNull()
      .references(() => users.id),
    serviceTypeId: integer()
      .notNull()
      .references(() => serviceTypes.id),
    productKind: text().notNull(),
    brand: text(),
    model: text(),
    problem: text().notNull(),
    address: jsonb().$type<AddressSnapshot>().notNull(),
    status: serviceRequestStatusEnum().notNull().default('REQUESTED'),
    quoteId: integer().references(() => quotes.id),
    createdById: integer()
      .notNull()
      .references(() => users.id),
    rejectionReason: text(),
    cancellationReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('service_requests_customer_idx').on(t.customerId),
    index('service_requests_status_idx').on(t.status, t.createdAt),
  ],
);

export const availabilityWindows = pgTable(
  'availability_windows',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    serviceRequestId: integer()
      .notNull()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    period: dayPeriodEnum().notNull(),
  },
  (t) => [uniqueIndex('availability_windows_unique').on(t.serviceRequestId, t.day, t.period)],
);

export const messages = pgTable(
  'messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    threadType: threadTypeEnum().notNull(),
    threadId: integer().notNull(),
    authorId: integer()
      .notNull()
      .references(() => users.id),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('messages_thread_idx').on(t.threadType, t.threadId, t.createdAt)],
);

export const media = pgTable(
  'media',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    ownerType: mediaOwnerEnum().notNull(),
    ownerId: integer().notNull(),
    storageKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('media_owner_idx').on(t.ownerType, t.ownerId)],
);

export const appointments = pgTable(
  'appointments',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    serviceRequestId: integer()
      .notNull()
      .unique()
      .references(() => serviceRequests.id, { onDelete: 'cascade' }),
    employeeId: integer()
      .notNull()
      .references(() => users.id),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    version: integer().notNull().default(1),
    createdById: integer()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('appointments_time_order', sql`${t.endsAt} > ${t.startsAt}`),
    index('appointments_employee_idx').on(t.employeeId, t.startsAt),
  ],
);

export const serviceReports = pgTable('service_reports', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  appointmentId: integer()
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  status: reportStatusEnum().notNull().default('SUBMITTED'),
  defectFound: boolean().notNull(),
  defectDescription: text(),
  repairDescription: text().notNull(),
  submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  amountCents: money(),
  approvedById: integer().references(() => users.id),
  approvedAt: timestamp({ withTimezone: true }),
  reworkComment: text(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    link: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt)],
);

export const outbox = pgTable(
  'outbox',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    topic: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    availableAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    attempts: integer().notNull().default(0),
    lastError: text(),
    processedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('outbox_pending_idx')
      .on(t.availableAt)
      .where(sql`${t.processedAt} is null`),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    actorId: integer().references(() => users.id),
    action: text().notNull(),
    resourceType: text().notNull(),
    resourceId: text(),
    before: jsonb(),
    after: jsonb(),
    ip: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
  ],
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    route: text().notNull(),
    requestHash: text().notNull(),
    responseStatus: integer().notNull(),
    responseBody: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export interface OpeningHours {
  /** 0 = Sunday ... 6 = Saturday; null = closed. Times as HH:MM. */
  [weekday: string]: { opens: string; closes: string } | null;
}

export const storeSettings = pgTable(
  'store_settings',
  {
    id: integer().primaryKey().default(1),
    name: text().notNull(),
    legalName: text().notNull(),
    cnpj: text().notNull(),
    phone: text().notNull(),
    whatsapp: text(),
    email: text().notNull(),
    address: jsonb().$type<AddressSnapshot>().notNull(),
    openingHours: jsonb().$type<OpeningHours>().notNull(),
    notificationEmails: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    defaultStockMin: integer().notNull().default(1),
    updatedAt: updatedAt(),
  },
  (t) => [check('store_settings_singleton', sql`${t.id} = 1`)],
);
