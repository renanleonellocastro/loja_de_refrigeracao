import { GUEST, createApiClient, type Actor, type ApiSchemas } from '@rc/contracts';
import { defineStore } from 'pinia';

export type Session = ApiSchemas['Session'];
export type SessionUser = ApiSchemas['UserSummary'];

/** Remembers in this browser that someone signed in, so guests do not ask the API for a session on every page. */
export const SIGNED_IN_HINT = 'rc-signed-in';
/** Seconds before the access token expires when it is renewed in the background. */
export const REFRESH_MARGIN_SECONDS = 60;

function writeHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT, '1');
    else localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    // Storage blocked: the session still works, it is just restored on protected pages only.
  }
}

function readHint(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_HINT) === '1';
  } catch {
    return false;
  }
}

/** Serializes refreshes across tabs: two tabs rotating the same refresh token at once would end the session. */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request('rc-refresh', task) : task();
}

/**
 * Signed in user and access token, in memory only (docs/SEGURANCA.md section 1). The refresh token lives in
 * the HttpOnly cookie `rc_refresh`; a page load restores the session through POST /auth/sessions/refresh.
 */
export const useAuthStore = defineStore('auth', () => {
  const config = useRuntimeConfig();
  const user = ref<SessionUser | null>(null);
  const accessToken = ref<string | null>(null);

  const actor = computed<Actor>(() => user.value?.role ?? GUEST);
  const signedIn = computed(() => user.value !== null);

  // Auth endpoints never go through useApi(), whose 401 handling calls back into this store.
  const api = createApiClient({
    baseUrl: config.public.apiBase,
    getAccessToken: () => accessToken.value,
    fetch: (request) => globalThis.fetch(request),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshing: Promise<boolean> | null = null;
  let restoring: Promise<void> | null = null;

  function schedule(expiresIn: number): void {
    clearTimeout(timer);
    const seconds = Math.max(expiresIn - REFRESH_MARGIN_SECONDS, 5);
    timer = setTimeout(() => void refresh(), seconds * 1000);
  }

  /** Starts a session from any response that signs the user in (login, registration, reset, invitation). */
  function apply(session: Session): void {
    user.value = session.user;
    accessToken.value = session.accessToken;
    writeHint(true);
    schedule(session.expiresIn);
  }

  function clear(): void {
    clearTimeout(timer);
    user.value = null;
    accessToken.value = null;
    restoring = null;
    writeHint(false);
  }

  /** Renews the access token with the refresh cookie. Concurrent callers share one request. */
  function refresh(): Promise<boolean> {
    refreshing ??= withRefreshLock(async () => {
      try {
        const { data } = await api.POST('/api/v1/auth/sessions/refresh');
        if (data) {
          apply(data);
          return true;
        }
        clear();
        return false;
      } catch {
        // No connection: keep what we have; the next call tries again.
        return false;
      }
    }).finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  /**
   * Restores the session once per page load. Public pages only try when this browser signed in before;
   * protected pages always try, since the refresh cookie may exist without the hint.
   */
  function restore(options: { onlyWithHint?: boolean } = {}): Promise<void> {
    if (user.value || (options.onlyWithHint && !readHint())) return Promise.resolve();
    restoring ??= refresh().then(() => undefined);
    return restoring;
  }

  async function login(email: string, password: string): Promise<SessionUser> {
    const result = await api.POST('/api/v1/auth/sessions', { body: { email, password } });
    if (!result.data) throw problemToError(result.response.status, result.error);
    apply(result.data);
    return result.data.user;
  }

  async function logout(): Promise<void> {
    try {
      await api.DELETE('/api/v1/auth/sessions/current');
    } catch {
      // Offline: the local session ends anyway; the cookie expires on its own.
    }
    clear();
  }

  /** Keeps the name in the menus in sync after the person edits the profile. */
  function updateUser(changes: Partial<SessionUser>): void {
    if (user.value) user.value = { ...user.value, ...changes };
  }

  return { user, accessToken, actor, signedIn, apply, clear, refresh, restore, login, logout, updateUser };
});
