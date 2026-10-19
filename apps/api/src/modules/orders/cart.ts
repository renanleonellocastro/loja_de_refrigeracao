import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, notFound } from '../../shared/errors.js';
import * as catalog from '../catalog/service.js';
import * as repo from './repository.js';
import { MAX_LINE_QUANTITY } from './schemas.js';

export const MAX_CART_LINES = 50;

type CartProduct = Awaited<ReturnType<typeof catalog.productsForOrder>>[number];
type CartProblem = 'unavailable' | 'insufficient';

interface CartLine {
  productId: number;
  quantity: number;
}

interface CartItem {
  quantity: number;
  subtotalCents: number;
  problem: CartProblem | null;
}

function productsOf(db: Executor, lines: CartLine[]): Promise<CartProduct[]> {
  return catalog.productsForOrder(
    db,
    lines.map((line) => line.productId),
  );
}

// Cart lines cascade with their product, so the product is always found.
function productOf(products: CartProduct[], productId: number): CartProduct {
  return products.find((product) => product.id === productId)!;
}

function isUnavailable(product: CartProduct): boolean {
  return product.archived || product.stockAvailable === 0;
}

function problemOf(product: CartProduct, quantity: number): CartProblem | null {
  if (isUnavailable(product)) return 'unavailable';
  return quantity > product.stockAvailable ? 'insufficient' : null;
}

function cartProductView(product: CartProduct) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    stockAvailable: product.archived ? 0 : product.stockAvailable,
    cover: product.cover,
  };
}

function cartItemView(product: CartProduct, line: CartLine) {
  return {
    product: cartProductView(product),
    quantity: line.quantity,
    subtotalCents: product.priceCents * line.quantity,
    problem: problemOf(product, line.quantity),
  };
}

function cartTotals(items: CartItem[]) {
  return {
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    totalCents: items.reduce((total, item) => total + item.subtotalCents, 0),
    ready: items.length > 0 && items.every((item) => item.problem === null),
  };
}

/** The cart with live prices and stock; lines that cannot be bought are flagged instead of removed. */
export async function cartView(db: Executor, userId: number) {
  const lines = await repo.cartOf(db, userId);
  const products = await productsOf(db, lines);
  const items = lines.map((line) => cartItemView(productOf(products, line.productId), line));
  return { items, ...cartTotals(items) };
}

async function findBuyableProduct(db: Executor, productId: number): Promise<CartProduct> {
  const [product] = await catalog.productsForOrder(db, [productId]);
  if (!product || product.archived) throw notFound('Produto não encontrado.');
  return product;
}

function assertEnoughStock(product: CartProduct, quantity: number): void {
  if (quantity <= product.stockAvailable) return;
  throw conflict(
    'insufficient-stock',
    'Estoque insuficiente',
    `Temos ${product.stockAvailable} unidade(s) disponível(is).`,
    { items: [{ productId: product.id, requested: quantity, available: product.stockAvailable }] },
  );
}

function hasRoomFor(lines: CartLine[], productId: number): boolean {
  return lines.some((line) => line.productId === productId) || lines.length < MAX_CART_LINES;
}

async function assertCartHasRoom(db: Executor, userId: number, productId: number): Promise<void> {
  if (hasRoomFor(await repo.cartOf(db, userId), productId)) return;
  throw conflict(
    'cart-full',
    'Carrinho cheio',
    `O carrinho aceita até ${MAX_CART_LINES} produtos diferentes.`,
  );
}

export async function setQuantity(ctx: AppContext, userId: number, productId: number, quantity: number) {
  const product = await findBuyableProduct(ctx.db, productId);
  assertEnoughStock(product, quantity);
  await assertCartHasRoom(ctx.db, userId, productId);
  await repo.setCartItem(ctx.db, userId, productId, quantity, ctx.clock.now());
  return cartView(ctx.db, userId);
}

export async function removeItem(ctx: AppContext, userId: number, productId: number) {
  await repo.removeCartItem(ctx.db, userId, productId);
  return cartView(ctx.db, userId);
}

/** The line a visitor cart item becomes in the account cart, or null when it cannot be kept. */
function mergedLine(current: CartLine[], item: CartLine, products: CartProduct[]): CartLine | null {
  const product = products.find((candidate) => candidate.id === item.productId);
  if (!product || isUnavailable(product) || !hasRoomFor(current, item.productId)) return null;
  const existing = current.find((line) => line.productId === item.productId);
  const wanted = Math.max(existing?.quantity ?? 0, item.quantity);
  return { productId: item.productId, quantity: Math.min(wanted, product.stockAvailable, MAX_LINE_QUANTITY) };
}

function withLine(current: CartLine[], line: CartLine): CartLine[] {
  return current.some((known) => known.productId === line.productId) ? current : [...current, line];
}

/** Joins the visitor cart kept in the browser into the account cart, capped by the available stock. */
export async function mergeCart(ctx: AppContext, userId: number, items: CartLine[]) {
  let current: CartLine[] = await repo.cartOf(ctx.db, userId);
  const products = await productsOf(ctx.db, items);
  const now = ctx.clock.now();
  for (const item of items) {
    const line = mergedLine(current, item, products);
    if (!line) continue;
    await repo.setCartItem(ctx.db, userId, line.productId, line.quantity, now);
    current = withLine(current, line);
  }
  return cartView(ctx.db, userId);
}
