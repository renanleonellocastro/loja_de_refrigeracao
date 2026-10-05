import { FALLBACK_STORE, type StorePublic } from '~/utils/store';

/**
 * Store data from GET /api/v1/store (address, contacts, hours, "aberto agora"), loaded once per page view and
 * shared by the header, footer and pages. When the API cannot answer, the site keeps working with the data
 * the store settings start with.
 */
export function useStoreInfo(): ComputedRef<StorePublic> {
  const api = useApi();
  const { data } = useAsyncData('store', () => unwrap(api.GET('/api/v1/store')).catch(() => null));
  return computed(() => data.value ?? FALLBACK_STORE);
}
