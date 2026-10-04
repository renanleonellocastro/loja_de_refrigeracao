import type { Ref } from 'vue';

/** Unread notifications of the signed in person (RF-40), shared by the bell and the notifications page. */
export function useUnreadCount(): { count: Ref<number>; refresh: () => Promise<void> } {
  const count = useState<number>('unread-notifications', () => 0);
  const auth = useAuthStore();
  const api = useApi();

  async function refresh(): Promise<void> {
    if (!auth.signedIn) {
      count.value = 0;
      return;
    }
    try {
      const page = await unwrap(
        api.GET('/api/v1/me/notifications', { params: { query: { unread: true, pageSize: 1 } } }),
      );
      count.value = page.meta.total;
    } catch {
      // The badge is a hint; the page itself reports problems.
    }
  }

  return { count, refresh };
}
