import type { ApiSchemas } from '@rc/contracts';

/** Staff screens of the catalog (RF-12 to RF-16): product form, photos, stock and categories. */

export type Category = ApiSchemas['Category'];
export type ProductImageItem = ApiSchemas['ProductImage'];
export type StockMovement = ApiSchemas['StockMovement'];
export type ManualMovementType = 'IN' | 'ADJUSTMENT' | 'LOSS';

export const PRODUCTS_PAGE_SIZE = 20;
export const STOCK_PAGE_SIZE = 20;
export const MAX_PRODUCT_PHOTOS = 20;
export const MAX_PHOTOS_PER_UPLOAD = 10;
const MAX_STOCK = 100_000;

export const CONDITION_OPTIONS: SelectOption[] = [
  { value: 'NEW', label: 'Novo' },
  { value: 'USED', label: 'Usado' },
];

export const MOVEMENT_LABELS: Record<StockMovement['type'], string> = {
  IN: 'Entrada',
  ADJUSTMENT: 'Ajuste',
  LOSS: 'Perda',
  RESERVATION: 'Reserva de pedido',
  RELEASE: 'Devolução de reserva',
  SALE: 'Venda',
};

export const MOVEMENT_OPTIONS: Array<SelectOption & { value: ManualMovementType }> = [
  { value: 'IN', label: 'Entrada', description: 'Chegou mercadoria do fornecedor.' },
  { value: 'ADJUSTMENT', label: 'Ajuste', description: 'Corrige a contagem: use negativo para retirar.' },
  { value: 'LOSS', label: 'Perda', description: 'Item quebrado, vencido ou extraviado.' },
];

export type ProductForm = {
  name: string;
  categoryId: string;
  brand: string;
  model: string;
  condition: 'NEW' | 'USED';
  description: string;
  priceCents: number;
  initialStock: string;
  /** Blank uses the default minimum of the store settings. */
  stockMin: string;
};

export function productFormFrom(product: ProductDetail | null): ProductForm {
  return {
    name: product?.name ?? '',
    categoryId: product ? String(product.categoryId) : '',
    brand: product?.brand ?? '',
    model: product?.model ?? '',
    condition: product?.condition ?? 'NEW',
    description: product?.description ?? '',
    priceCents: product?.priceCents ?? 0,
    initialStock: '0',
    stockMin: product && product.stockMin !== null ? String(product.stockMin) : '',
  };
}

function isCount(value: string): boolean {
  return isWholeNumberText(value) && Number(value) <= MAX_STOCK;
}

const PRODUCT_LIMITS = {
  nameMin: 3,
  nameMax: 120,
  brandMax: 60,
  modelMax: 60,
  descriptionMax: 5000,
  priceMaxCents: 100_000_000,
} as const;

function productNameError(name: string): string | undefined {
  const length = name.trim().length;
  if (length < PRODUCT_LIMITS.nameMin) return 'Informe o nome do produto, com pelo menos 3 letras.';
  return length > PRODUCT_LIMITS.nameMax ? 'Use até 120 letras no nome.' : undefined;
}

function tooLongError(text: string, max: number, message: string): string | undefined {
  return text.length > max ? message : undefined;
}

function priceError(priceCents: number): string | undefined {
  if (!(priceCents > 0)) return 'Informe o preço, como R$ 1.250,00.';
  return priceCents > PRODUCT_LIMITS.priceMaxCents ? 'Preço alto demais. Confira o valor.' : undefined;
}

function initialStockError(value: string): string | undefined {
  return isCount(String(value).trim()) ? undefined : 'Use um número inteiro de 0 a 100.000.';
}

function stockMinError(value: string): string | undefined {
  const stockMin = String(value).trim();
  return stockMin && !isCount(stockMin) ? 'Use um número inteiro de 0 a 100.000 ou deixe vazio.' : undefined;
}

function productFieldRules(values: ProductForm): Record<string, FieldRule> {
  return {
    name: () => productNameError(values.name),
    categoryId: () => (values.categoryId ? undefined : 'Escolha a categoria.'),
    brand: () => tooLongError(values.brand.trim(), PRODUCT_LIMITS.brandMax, 'Use até 60 letras na marca.'),
    model: () => tooLongError(values.model.trim(), PRODUCT_LIMITS.modelMax, 'Use até 60 letras no modelo.'),
    description: () =>
      tooLongError(values.description, PRODUCT_LIMITS.descriptionMax, 'Use até 5.000 letras na descrição.'),
    priceCents: () => priceError(values.priceCents),
    stockMin: () => stockMinError(values.stockMin),
  };
}

/** Same rules as the API, checked before sending so the person sees every problem at once. */
export function validateProductForm(values: ProductForm, creating: boolean): FieldErrors {
  const rules = productFieldRules(values);
  if (!creating) return collectFieldErrors(rules);
  return collectFieldErrors({ ...rules, initialStock: () => initialStockError(values.initialStock) });
}

/** Body of PATCH /products/{id}; POST /products adds the initial stock. */
export function productToApi(values: ProductForm) {
  const stockMin = String(values.stockMin).trim();
  return {
    name: values.name.trim(),
    categoryId: Number(values.categoryId),
    brand: values.brand.trim() || null,
    model: values.model.trim() || null,
    condition: values.condition,
    description: values.description.trim(),
    priceCents: values.priceCents,
    stockMin: stockMin ? Number(stockMin) : null,
  };
}

/** The API answers ETag W/"<version>" on the product; PATCH must send it back in If-Match. */
export function ifMatch(version: number): string {
  return `W/"${version}"`;
}

export type MovementForm = { type: ManualMovementType; quantity: string; reason: string };

const MOVEMENT_REASON_MAX_LENGTH = 300;
const SIGNED_INTEGER_PATTERN = /^-?\d+$/;

function movementQuantityError(type: ManualMovementType, text: string): string | undefined {
  const quantity = Number(text);
  if (!SIGNED_INTEGER_PATTERN.test(text) || Math.abs(quantity) > MAX_STOCK) {
    return 'Informe um número inteiro, como 5.';
  }
  if (type === 'ADJUSTMENT') {
    return quantity === 0 ? 'Informe uma quantidade diferente de zero (negativa para retirar).' : undefined;
  }
  return quantity <= 0 ? 'Informe uma quantidade maior que zero.' : undefined;
}

function movementReasonError(type: ManualMovementType, reason: string): string | undefined {
  const trimmed = reason.trim();
  if (type !== 'IN' && !trimmed) return 'Informe o motivo.';
  return trimmed.length > MOVEMENT_REASON_MAX_LENGTH ? 'Use até 300 letras no motivo.' : undefined;
}

export function validateMovement(values: MovementForm): FieldErrors {
  return collectFieldErrors({
    quantity: () => movementQuantityError(values.type, String(values.quantity).trim()),
    reason: () => movementReasonError(values.type, values.reason),
  });
}

/** "+5" or "-2", so entries and exits read at a glance. */
export function signedQuantity(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}

/** Moves the item at `from` to `to`, returning a new list. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
