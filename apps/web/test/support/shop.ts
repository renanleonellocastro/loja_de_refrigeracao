import type { Cart, CartProduct, GuestLine } from '~/stores/cart';
import type { CatalogFacets, ProductDetail, ProductSummary } from '~/utils/catalog';
import type { Order, OrderListItem } from '~/utils/orders';

/** Catalog, cart and order answers of the API, shaped like packages/contracts/openapi.json. */

export const IMAGE = {
  width: 1200,
  height: 1200,
  url: '/api/v1/media/abc/960.webp',
  srcset: '/api/v1/media/abc/320.webp 320w, /api/v1/media/abc/960.webp 960w',
};

export const product = (overrides: Partial<ProductSummary> = {}): ProductSummary => ({
  id: 14,
  slug: 'compressor-embraco',
  name: 'Compressor Embraco',
  categoryId: 7,
  categoryName: 'Peças e acessórios',
  brand: 'Embraco',
  model: 'EMIS30HHR',
  condition: 'NEW',
  priceCents: 49900,
  stockAvailable: 8,
  stockMin: null,
  available: true,
  lowStock: false,
  archived: false,
  cover: { ...IMAGE, id: 1, position: 0, isCover: true },
  ...overrides,
});

export const detail = (overrides: Partial<ProductDetail> = {}): ProductDetail => {
  const { cover, ...summary } = product();
  return {
    ...summary,
    description: 'Compressor para geladeiras.',
    images: [cover!, { ...IMAGE, url: '/api/v1/media/def/960.webp', id: 2, position: 1, isCover: false }],
    version: 1,
    archivedAt: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
};

export const FACETS: CatalogFacets = {
  brands: [
    { brand: 'Embraco', count: 1 },
    { brand: 'Consul', count: 3 },
  ],
  categories: [
    { categoryId: 7, name: 'Peças e acessórios', count: 1 },
    { categoryId: 1, name: 'Geladeiras', count: 3 },
  ],
  conditions: [{ condition: 'NEW', count: 9 }],
  price: { minCents: 49900, maxCents: 359900 },
  availability: { available: 11, unavailable: 3 },
};

export const cartProduct = (overrides: Partial<CartProduct> = {}): CartProduct => ({
  id: 14,
  name: 'Compressor Embraco',
  slug: 'compressor-embraco',
  priceCents: 49900,
  stockAvailable: 8,
  cover: IMAGE,
  ...overrides,
});

/** Visitor cart with one product in the given quantity. */
export const guestCart = (quantity: number, overrides: Partial<CartProduct> = {}): GuestLine[] => [
  { productId: overrides.id ?? 14, quantity, product: cartProduct({ stockAvailable: 200, ...overrides }) },
];

export const cart = (
  lines: Array<{
    quantity: number;
    product?: Partial<CartProduct>;
    problem?: 'unavailable' | 'insufficient';
  }>,
): Cart => {
  const items = lines.map((line) => {
    const item = cartProduct(line.product);
    return {
      product: item,
      quantity: line.quantity,
      subtotalCents: item.priceCents * line.quantity,
      problem: line.problem ?? null,
    };
  });
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCents: items.reduce((sum, item) => sum + item.subtotalCents, 0),
    ready: items.length > 0 && items.every((item) => item.problem === null),
  };
};

export const order = (overrides: Partial<Order> = {}): Order => ({
  id: 31,
  number: '2026-000031',
  status: 'PENDING_REVIEW',
  statusLabel: 'Em análise',
  channel: 'ONLINE',
  customer: { id: 4, name: 'Carla Cliente', email: 'cliente@castro.dev', phone: null },
  items: [
    {
      productId: 14,
      productName: 'Compressor Embraco',
      unitPriceCents: 49900,
      quantity: 2,
      subtotalCents: 99800,
    },
  ],
  totalCents: 99800,
  notes: 'Retiro na sexta.',
  events: [
    {
      fromStatus: null,
      toStatus: 'PENDING_REVIEW',
      label: 'Pedido recebido',
      actor: { id: 4, name: 'Carla Cliente' },
      reason: null,
      createdAt: '2026-10-03T15:00:00.000Z',
    },
  ],
  canCancel: true,
  createdAt: '2026-10-03T15:00:00.000Z',
  updatedAt: '2026-10-03T15:00:00.000Z',
  ...overrides,
});

export const orderListItem = (overrides: Partial<OrderListItem> = {}): OrderListItem => ({
  id: 31,
  number: '2026-000031',
  status: 'PENDING_REVIEW',
  statusLabel: 'Em análise',
  channel: 'ONLINE',
  customer: { id: 4, name: 'Carla Cliente' },
  totalCents: 99800,
  itemCount: 2,
  createdAt: '2026-10-03T15:00:00.000Z',
  updatedAt: '2026-10-03T15:00:00.000Z',
  ...overrides,
});

export const orderList = (data: OrderListItem[], total = data.length) => ({
  data,
  meta: {
    page: 1,
    pageSize: 10,
    total,
    counts: { PENDING_REVIEW: 1, READY_FOR_PICKUP: 0, PICKED_UP: 0, CANCELED: 0 },
  },
});
