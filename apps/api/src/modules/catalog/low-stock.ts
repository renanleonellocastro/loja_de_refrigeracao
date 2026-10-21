import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import * as notifications from '../notifications/service.js';
import * as repo from './repository.js';

const LOW_STOCK_NOTICE_TYPE = 'product.lowStock';

const managementProductPath = (id: number) => `/produtos/gerenciar/${id}`;

/** A signed change already applied to the available quantity of a product. */
export interface StockChange {
  productId: number;
  delta: number;
}

/** True only for the change that takes the quantity from the minimum or above to below it. */
export function crossesMinimum(before: number, after: number, minimum: number): boolean {
  return before >= minimum && after < minimum;
}

function lowStockNotice(product: repo.ProductRow, minimum: number): notifications.Notice {
  return {
    type: LOW_STOCK_NOTICE_TYPE,
    subject: `Estoque baixo: ${product.name}`,
    paragraphs: [
      `Restam ${product.stockAvailable} unidade(s), abaixo do mínimo de ${minimum}.`,
      'Registre a entrada no estoque quando a reposição chegar.',
    ],
    path: managementProductPath(product.id),
    actionLabel: 'Ver produto',
  };
}

function crossedNow(product: repo.ProductRow, delta: number, minimum: number): boolean {
  const after = product.stockAvailable;
  return product.archivedAt === null && crossesMinimum(after - delta, after, minimum);
}

/**
 * Tells the management about each active product that the changes just took below its
 * minimum, inside the caller's transaction. Products already low stay quiet, so the
 * alert goes out once per crossing and not on every later movement.
 */
export async function announceLowStock(
  ctx: AppContext,
  db: Executor,
  changes: StockChange[],
  exceptUserId: number | null,
): Promise<void> {
  if (changes.length === 0) return;
  const storeMin = await repo.defaultStockMin(db);
  const deltaOf = new Map(changes.map((change) => [change.productId, change.delta]));
  for (const product of await repo.findProductsByIds(db, [...deltaOf.keys()])) {
    const minimum = product.stockMin ?? storeMin;
    if (crossedNow(product, deltaOf.get(product.id)!, minimum)) {
      await notifications.notifyManagement(ctx, db, exceptUserId, lowStockNotice(product, minimum));
    }
  }
}
