import { GUEST, createApiClient, type Actor, type ApiClient, type ApiSchemas } from '@rc/contracts';
import { defineStore } from 'pinia';
import type { Ref } from 'vue';
import { forgetDay } from '~/utils/offline-day';

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

const MIN_REFRESH_DELAY_SECONDS = 5;
const MILLISECONDS_PER_SECOND = 1000;

interface AuthState {
  user: Ref<SessionUser | null>;
  accessToken: Ref<string | null>;
  /** The last session refresh could not reach the API (no signal), so the session is unknown, not over. */
  unreachable: Ref<boolean>;
}

export interface RestoreOptions {
  onlyWithHint?: boolean;
}

function createAuthState(): AuthState {
  return {
    user: ref<SessionUser | null>(null),
    accessToken: ref<string | null>(null),
    unreachable: ref(false),
  };
}

// Auth endpoints never go through useApi(), whose 401 handling calls back into this store.
function createAuthApi(apiBase: string, accessToken: Ref<string | null>): ApiClient {
  return createApiClient({
    baseUrl: apiBase,
    getAccessToken: () => accessToken.value,
    fetch: (request) => globalThis.fetch(request),
  });
}

/** Starts, renews and ends the session kept in memory, renewing the token shortly before it expires. */
class SessionKeeper {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private refreshing: Promise<boolean> | null = null;
  private restoring: Promise<void> | null = null;
  private readonly state: AuthState;
  private readonly api: ApiClient;

  constructor(state: AuthState, api: ApiClient) {
    this.state = state;
    this.api = api;
  }

  /** Starts a session from any response that signs the user in (login, registration, reset, invitation). */
  apply(session: Session): void {
    this.state.user.value = session.user;
    this.state.accessToken.value = session.accessToken;
    writeHint(true);
    this.schedule(session.expiresIn);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.state.user.value = null;
    this.state.accessToken.value = null;
    this.restoring = null;
    writeHint(false);
  }

  /** Renews the access token with the refresh cookie. Concurrent callers share one request. */
  refresh(): Promise<boolean> {
    this.refreshing ??= withRefreshLock(() => this.renew()).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /**
   * Restores the session once per page load. Public pages only try when this browser signed in before;
   * protected pages always try, since the refresh cookie may exist without the hint.
   */
  restore(options: RestoreOptions = {}): Promise<void> {
    if (this.state.user.value || (options.onlyWithHint && !readHint())) return Promise.resolve();
    this.restoring ??= this.refresh().then(() => undefined);
    return this.restoring;
  }

  async login(email: string, password: string): Promise<SessionUser> {
    const result = await this.api.POST('/api/v1/auth/sessions', { body: { email, password } });
    if (!result.data) throw problemToError(result.response.status, result.error);
    this.apply(result.data);
    return result.data.user;
  }

  async logout(): Promise<void> {
    try {
      await this.api.DELETE('/api/v1/auth/sessions/current');
    } catch {
      // Offline: the local session ends anyway; the cookie expires on its own.
    }
    forgetDay();
    this.clear();
  }

  /** Keeps the name in the menus in sync after the person edits the profile. */
  updateUser(changes: Partial<SessionUser>): void {
    const user = this.state.user.value;
    if (user) this.state.user.value = { ...user, ...changes };
  }

  private schedule(expiresIn: number): void {
    clearTimeout(this.timer);
    const seconds = Math.max(expiresIn - REFRESH_MARGIN_SECONDS, MIN_REFRESH_DELAY_SECONDS);
    this.timer = setTimeout(() => void this.refresh(), seconds * MILLISECONDS_PER_SECOND);
  }

  private async renew(): Promise<boolean> {
    try {
      const { data } = await this.api.POST('/api/v1/auth/sessions/refresh');
      this.state.unreachable.value = false;
      return this.settleRenewal(data);
    } catch {
      // No connection: keep what we have; the next call tries again.
      this.state.unreachable.value = true;
      return false;
    }
  }

  /** A renewed session starts again; a refused one ends here. */
  private settleRenewal(session: Session | undefined): boolean {
    if (!session) {
      this.clear();
      return false;
    }
    this.apply(session);
    return true;
  }
}

function authGetters(state: AuthState) {
  return {
    actor: computed<Actor>(() => state.user.value?.role ?? GUEST),
    signedIn: computed(() => state.user.value !== null),
  };
}

function sessionActions(keeper: SessionKeeper) {
  return {
    apply: keeper.apply.bind(keeper),
    clear: keeper.clear.bind(keeper),
    refresh: keeper.refresh.bind(keeper),
    restore: keeper.restore.bind(keeper),
    login: keeper.login.bind(keeper),
    logout: keeper.logout.bind(keeper),
    updateUser: keeper.updateUser.bind(keeper),
  };
}

/**
 * Signed in user and access token, in memory only (docs/SEGURANCA.md section 1). The refresh token lives in
 * the HttpOnly cookie `rc_refresh`; a page load restores the session through POST /auth/sessions/refresh.
 */
export const useAuthStore = defineStore('auth', () => {
  const state = createAuthState();
  const keeper = new SessionKeeper(
    state,
    createAuthApi(useRuntimeConfig().public.apiBase, state.accessToken),
  );
  return { ...state, ...authGetters(state), ...sessionActions(keeper) };
});
