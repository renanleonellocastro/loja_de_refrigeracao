import type { CepAddress, CepCache } from './cep.js';

/** Enough for the CEPs of a busy day without letting memory grow unbounded. */
const DEFAULT_CEP_CACHE_LIMIT = 500;

/** An in memory cache that drops its oldest entry when full (a Map keeps insertion order). */
export function createMemoryCepCache(limit = DEFAULT_CEP_CACHE_LIMIT): CepCache {
  const addresses = new Map<string, CepAddress>();
  const dropOldest = () => addresses.delete(addresses.keys().next().value as string);
  return {
    find: (cep) => addresses.get(cep),
    remember(cep, address) {
      if (addresses.size >= limit) dropOldest();
      addresses.set(cep, address);
    },
  };
}
