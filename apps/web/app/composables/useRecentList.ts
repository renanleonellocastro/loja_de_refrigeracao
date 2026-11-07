import type { Ref } from 'vue';

/** How many records each recent list on the profile shows. */
export const RECENT_LIST_SIZE = 3;

type RecentFetcher<T> = (pageSize: number) => Promise<{ data: T[] }>;

/**
 * The first page of one of the customer lists, loaded once on mount. A failure only sets `failed`: the
 * recent lists are a convenience and the page around them keeps working.
 */
export function useRecentList<T>(fetchFirstPage: RecentFetcher<T>) {
  const state = { rows: ref([]) as Ref<T[]>, loading: ref(true), failed: ref(false) };
  onMounted(() => loadInto(state, fetchFirstPage));
  return state;
}

interface RecentListState<T> {
  rows: Ref<T[]>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
}

async function loadInto<T>(state: RecentListState<T>, fetchFirstPage: RecentFetcher<T>): Promise<void> {
  try {
    state.rows.value = (await fetchFirstPage(RECENT_LIST_SIZE)).data;
  } catch {
    state.failed.value = true;
  } finally {
    state.loading.value = false;
  }
}
