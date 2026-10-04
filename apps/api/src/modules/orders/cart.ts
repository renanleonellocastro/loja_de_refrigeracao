import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, notFound } from '../../shared/errors.js';
import * as catalog from '../catalog/service.js';
import * as repo from './repository.js';

export const MAX_CART_LINES = 50;

/** The cart with live prices and stock; lines that cannot be bought are flagged instead of removed. */
export async function cartView(db: Executor, userId: number) {
  const lines = await repo.cartOf(db, userId);
  const products = await catalog.productsForOrder(
    db,
    lines.map((l) => l.productId),
  );
  const items = lines.flatMap((line) => {
    // Cart lines cascade with their product, so the product is always found.
    const product = products.find((p) => p.id === line.productId)!;
    const problem =
      product.archived || product.stockAvailable === 0
        ? ('unavailable' as const)
        : line.quantity > product.stockAvailable
          ? ('insufficient' as const)
          : null;
    return [
      {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          priceCents: product.priceCents,
          stockAvailable: product.archived ? 0 : product.stockAvailable,
          cover: product.cover,
        },
        quantity: line.quantity,
        subtotalCents: product.priceCents * line.quantity,
        problem,
      },
    ];
  });
  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    totalCents: items.reduce((total, item) => total + item.subtotalCents, 0),
    ready: items.length > 0 && items.every((item) => item.problem === null),
  };
}

export async function setQuantity(ctx: AppContext, userId: number, productId: number, quantity: number) {
  const [product] = await catalog.productsForOrder(ctx.db, [productId]);
  if (!product || product.archived) throw notFound('Produto não encontrado.');
  if (quantity > product.stockAvailable) {
    throw conflict(
      'insufficient-stock',
      'Estoque insuficiente',
      `Temos ${product.stockAvailable} unidade(s) disponível(is).`,
      {
        items: [{ productId, requested: quantity, available: product.stockAvailable }],
      },
    );
  }
  const lines = await repo.cartOf(ctx.db, userId);
  if (!lines.some((l) => l.productId === productId) && lines.length >= MAX_CART_LINES) {
    throw conflict(
      'cart-full',
      'Carrinho cheio',
      `O carrinho aceita até ${MAX_CART_LINES} produtos diferentes.`,
    );
  }
  await repo.setCartItem(ctx.db, userId, productId, quantity, ctx.clock.now());
  return cartView(ctx.db, userId);
}

export async function removeItem(ctx: AppContext, userId: number, productId: number) {
  await repo.removeCartItem(ctx.db, userId, productId);
  return cartView(ctx.db, userId);
}

/** Joins the visitor cart kept in the browser into the account cart, capped by the available stock. */
export async function mergeCart(
  ctx: AppContext,
  userId: number,
  items: Array<{ productId: number; quantity: number }>,
) {
  const current = await repo.cartOf(ctx.db, userId);
  const products = await catalog.productsForOrder(
    ctx.db,
    items.map((i) => i.productId),
  );
  const now = ctx.clock.now();
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || product.archived || product.stockAvailable === 0) continue;
    const existing = current.find((line) => line.productId === item.productId);
    if (!existing && current.length >= MAX_CART_LINES) continue;
    const quantity = Math.min(Math.max(existing?.quantity ?? 0, item.quantity), product.stockAvailable, 99);
    await repo.setCartItem(ctx.db, userId, item.productId, quantity, now);
    if (!existing) current.push({ productId: item.productId, quantity });
  }
  return cartView(ctx.db, userId);
}
