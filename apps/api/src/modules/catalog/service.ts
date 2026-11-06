// Public surface of the catalog module for other modules (orders, counter sales, dashboard, retention).
export { defaultStockMin, lowStockProducts, productSearchText } from './repository.js';
export { insufficientStock, productsForOrder, releaseStock, reserveStock } from './stock.js';
export type { StockLink, StockRequest, UnavailableItem } from './stock.js';
export { isLowStock } from './views.js';
export { removeUnusedKeys } from './storage-cleanup.js';
