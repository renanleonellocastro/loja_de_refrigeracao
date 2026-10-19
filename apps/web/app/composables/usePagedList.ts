import type { Ref } from 'vue';

export interface PagedResult<T> {
  data: T[];
  meta: { total: number };
}

type PageFetcher<T> = (page: number) => Promise<PagedResult<T>>;

interface PagedListState<T> {
  page: Ref<number>;
  rows: Ref<T[]>;
  total: Ref<number>;
  loading: Ref<boolean>;
  failed: Ref<boolean>;
}

function createPagedListState<T>(): PagedListState<T> {
  return {
    page: ref(1),
    rows: ref([]) as Ref<T[]>,
    total: ref(0),
    loading: ref(true),
    failed: ref(false),
  };
}

function showPage<T>(state: PagedListState<T>, result: PagedResult<T>): void {
  state.rows.value = result.data;
  state.total.value = result.meta.total;
}

/** Loads the current page; `isNewest` tells whether a newer request started meanwhile, whose answer wins. */
async function loadPageInto<T>(
  state: PagedListState<T>,
  fetchPage: PageFetcher<T>,
  isNewest: () => boolean,
): Promise<void> {
  state.loading.value = true;
  state.failed.value = false;
  try {
    const result = await fetchPage(state.page.value);
    if (isNewest()) showPage(state, result);
  } catch {
    if (isNewest()) state.failed.value = true;
  } finally {
    if (isNewest()) state.loading.value = false;
  }
}

function newestPageLoader<T>(state: PagedListState<T>, fetchPage: PageFetcher<T>): () => Promise<void> {
  let latest = 0;
  return () => {
    const ticket = ++latest;
    return loadPageInto(state, fetchPage, () => ticket === latest);
  };
}

/**
 * State of a paginated list fed by the API: the current page, rows, loading and failure. Only the answer
 * of the newest request is applied, so a slow search never overwrites the results of a newer one.
 */
export function usePagedList<T>(fetchPage: PageFetcher<T>, pageSize: number) {
  const state = createPagedListState<T>();
  const pages = computed(() => Math.ceil(state.total.value / pageSize));
  const load = newestPageLoader(state, fetchPage);

  /** Goes back to the first page after a filter changes; the page watcher loads it. */
  function restart(): void {
    if (state.page.value === 1) void load();
    else state.page.value = 1;
  }

  watch(state.page, load);
  return { ...state, pages, load, restart };
}
