import type { Ref } from 'vue';

export interface PagedResult<T> {
  data: T[];
  meta: { total: number };
}

/**
 * State of a paginated list fed by the API: the current page, rows, loading and failure. Only the answer
 * of the newest request is applied, so a slow search never overwrites the results of a newer one.
 */
export function usePagedList<T>(fetchPage: (page: number) => Promise<PagedResult<T>>, pageSize: number) {
  const page = ref(1);
  const rows = ref([]) as Ref<T[]>;
  const total = ref(0);
  const loading = ref(true);
  const failed = ref(false);
  const pages = computed(() => Math.ceil(total.value / pageSize));
  let latest = 0;

  async function load(): Promise<void> {
    const ticket = ++latest;
    loading.value = true;
    failed.value = false;
    try {
      const result = await fetchPage(page.value);
      if (ticket !== latest) return;
      rows.value = result.data;
      total.value = result.meta.total;
    } catch {
      if (ticket === latest) failed.value = true;
    } finally {
      if (ticket === latest) loading.value = false;
    }
  }

  /** Goes back to the first page after a filter changes; the page watcher loads it. */
  function restart(): void {
    if (page.value === 1) void load();
    else page.value = 1;
  }

  watch(page, load);

  return { page, rows, total, pages, loading, failed, load, restart };
}
