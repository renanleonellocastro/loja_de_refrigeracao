// Public surface of the catalog module for other modules (orders, counter sales, dashboard).
export { defaultStockMin, productSearchText } from './repository.js';
export { insufficientStock, productsForOrder, releaseStock, reserveStock } from './stock.js';
export type { StockLink, StockRequest, UnavailableItem } from './stock.js';
export { isLowStock } from './views.js';
