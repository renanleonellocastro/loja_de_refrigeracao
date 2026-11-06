/** Venda no balcão (RF-26): the sale is picked up and paid on the spot, so stock leaves right away. */

export interface PickedCustomer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface CounterLine {
  product: ProductSummary;
  quantity: number;
}

export const COUNTER_SEARCH_SIZE = 12;

/** Largest quantity of a line: the stock on hand, and 99, the API limit per item. */
export function counterLimit(product: ProductSummary): number {
  return Math.max(0, Math.min(product.stockAvailable, 99));
}

export function counterTotal(lines: readonly CounterLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);
}

/** Adds one unit of the product, or a new line; stops at the stock on hand. */
export function addToCounter(lines: readonly CounterLine[], product: ProductSummary): CounterLine[] {
  const existing = lines.find((line) => line.product.id === product.id);
  if (!existing) return [...lines, { product, quantity: 1 }];
  return lines.map((line) =>
    line === existing ? { ...line, quantity: Math.min(counterLimit(product), line.quantity + 1) } : line,
  );
}

/** Products, quantities, customer and notes the staff chose, ready for the API body. */
export interface OrderDraft {
  customerId: number;
  items: Array<{ productId: number; quantity: number }>;
  notes?: string;
}

/** Words that change between a counter sale and an order placed on behalf of a customer. */
export interface BuilderWording {
  heading: string;
  /** Possessive ending of the labels: "da venda" or "do pedido". */
  of: string;
  confirm: string;
}

export const COUNTER_WORDING: BuilderWording = {
  heading: 'Venda',
  of: 'da venda',
  confirm: 'Confirmar venda',
};

export const ON_BEHALF_WORDING: BuilderWording = {
  heading: 'Pedido',
  of: 'do pedido',
  confirm: 'Fechar pedido',
};

export function draftOf(customer: PickedCustomer, lines: readonly CounterLine[], notes: string): OrderDraft {
  const items = lines.map((line) => ({ productId: line.product.id, quantity: line.quantity }));
  const trimmed = notes.trim();
  return trimmed ? { customerId: customer.id, items, notes: trimmed } : { customerId: customer.id, items };
}
