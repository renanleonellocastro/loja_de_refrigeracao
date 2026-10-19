import type { Ref } from 'vue';

/** Unread count of the badge, or undefined when the API cannot answer: the page itself reports problems. */
async function readUnreadCount(api: Api): Promise<number | undefined> {
  try {
    const page = await unwrap(api.GET('/api/v1/me/notifications', { params: { query: { pageSize: 1 } } }));
    return page.meta.unread;
  } catch {
    return undefined;
  }
}

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
    const unread = await readUnreadCount(api);
    if (unread !== undefined) count.value = unread;
  }

  return { count, refresh };
}
