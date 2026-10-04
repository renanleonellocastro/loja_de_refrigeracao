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
  return /^\d+$/.test(value) && Number(value) <= MAX_STOCK;
}

/** Same rules as the API, checked before sending so the person sees every problem at once. */
export function validateProductForm(values: ProductForm, creating: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (name.length < 3) errors.name = 'Informe o nome do produto, com pelo menos 3 letras.';
  else if (name.length > 120) errors.name = 'Use até 120 letras no nome.';
  if (!values.categoryId) errors.categoryId = 'Escolha a categoria.';
  if (values.brand.trim().length > 60) errors.brand = 'Use até 60 letras na marca.';
  if (values.model.trim().length > 60) errors.model = 'Use até 60 letras no modelo.';
  if (values.description.length > 5000) errors.description = 'Use até 5.000 letras na descrição.';
  if (!(values.priceCents > 0)) errors.priceCents = 'Informe o preço, como R$ 1.250,00.';
  else if (values.priceCents > 100_000_000) errors.priceCents = 'Preço alto demais. Confira o valor.';
  if (creating && !isCount(String(values.initialStock).trim())) {
    errors.initialStock = 'Use um número inteiro de 0 a 100.000.';
  }
  const stockMin = String(values.stockMin).trim();
  if (stockMin && !isCount(stockMin))
    errors.stockMin = 'Use um número inteiro de 0 a 100.000 ou deixe vazio.';
  return errors;
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

export function validateMovement(values: MovementForm): FieldErrors {
  const errors: FieldErrors = {};
  const text = String(values.quantity).trim();
  const quantity = Number(text);
  if (!/^-?\d+$/.test(text) || Math.abs(quantity) > MAX_STOCK) {
    errors.quantity = 'Informe um número inteiro, como 5.';
  } else if (values.type === 'ADJUSTMENT' && quantity === 0) {
    errors.quantity = 'Informe uma quantidade diferente de zero (negativa para retirar).';
  } else if (values.type !== 'ADJUSTMENT' && quantity <= 0) {
    errors.quantity = 'Informe uma quantidade maior que zero.';
  }
  if (values.type !== 'IN' && !values.reason.trim()) errors.reason = 'Informe o motivo.';
  else if (values.reason.trim().length > 300) errors.reason = 'Use até 300 letras no motivo.';
  return errors;
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
