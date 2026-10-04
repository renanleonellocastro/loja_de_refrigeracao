import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import authGuard from '~/middleware/auth.global';
import sessionPlugin from '~/plugins/session.client';
import { SIGNED_IN_HINT, useAuthStore } from '~/stores/auth';
import { useToast } from '~/composables/useToast';
import { CLIENT_USER, MANAGER_USER, mockApi, problem, session } from '../support/api';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const REFRESH = 'POST /api/v1/auth/sessions/refresh';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  useAuthStore().clear();
  useToast().clear();
  navigateMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('auth store', () => {
  it('signs in, remembers the browser and signs out even offline', async () => {
    const api = mockApi().on('POST /api/v1/auth/sessions', { body: session() });
    const auth = useAuthStore();
    const user = await auth.login('cliente@castro.dev', 'Castro-Dev-2026');
    expect(user.name).toBe('Carla Cliente');
    expect(auth.signedIn).toBe(true);
    expect(auth.actor).toBe('CLIENT');
    expect(auth.accessToken).toBe('token-4');
    expect(localStorage.getItem(SIGNED_IN_HINT)).toBe('1');
    expect(api.calls[0]!.body).toEqual({ email: 'cliente@castro.dev', password: 'Castro-Dev-2026' });

    auth.updateUser({ name: 'Carla Nova' });
    expect(auth.user!.name).toBe('Carla Nova');

    api.on('DELETE /api/v1/auth/sessions/current', new TypeError('offline'));
    await auth.logout();
    expect(auth.signedIn).toBe(false);
    expect(auth.actor).toBe('GUEST');
    expect(localStorage.getItem(SIGNED_IN_HINT)).toBeNull();
    auth.updateUser({ name: 'Ninguém' });
    expect(auth.user).toBeNull();
  });

  it('signs out through the API', async () => {
    const api = mockApi().on('DELETE /api/v1/auth/sessions/current', { status: 204 });
    const auth = useAuthStore();
    auth.apply(session());
    await auth.logout();
    expect(api.called('DELETE /api/v1/auth/sessions/current')).toHaveLength(1);
    expect(auth.user).toBeNull();
  });

  it('reports wrong credentials', async () => {
    mockApi().on('POST /api/v1/auth/sessions', problem(401, 'Email ou senha não conferem.'));
    await expect(useAuthStore().login('a@b.co', 'x')).rejects.toThrow('Email ou senha não conferem.');
  });

  it('refreshes once for concurrent callers and renews before the token expires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const api = mockApi().on(REFRESH, { body: { ...session(), expiresIn: 30 } });
    const auth = useAuthStore();
    const [first, second] = await Promise.all([auth.refresh(), auth.refresh()]);
    expect(first && second).toBe(true);
    expect(api.called(REFRESH)).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(api.called(REFRESH)).toHaveLength(2);
  });

  it('serializes refreshes across tabs with the Web Locks API', async () => {
    const request = vi.fn((_name: string, task: () => Promise<boolean>) => task());
    vi.stubGlobal('navigator', { locks: { request } });
    mockApi().on(REFRESH, { body: session() });
    expect(await useAuthStore().refresh()).toBe(true);
    expect(request).toHaveBeenCalledWith('rc-refresh', expect.any(Function));
  });

  it('ends the session when the refresh is refused and keeps it when offline', async () => {
    const auth = useAuthStore();
    auth.apply(session());
    mockApi().on(REFRESH, new TypeError('offline'));
    expect(await auth.refresh()).toBe(false);
    expect(auth.signedIn).toBe(true);
    mockApi().on(REFRESH, problem(401, 'Sessão expirada.'));
    expect(await auth.refresh()).toBe(false);
    expect(auth.signedIn).toBe(false);
  });

  it('restores the session once, only with the hint on public pages', async () => {
    const api = mockApi().on(REFRESH, { body: session(MANAGER_USER) });
    const auth = useAuthStore();
    await auth.restore({ onlyWithHint: true });
    expect(api.calls).toHaveLength(0);
    localStorage.setItem(SIGNED_IN_HINT, '1');
    await Promise.all([auth.restore({ onlyWithHint: true }), auth.restore()]);
    expect(api.calls).toHaveLength(1);
    expect(auth.actor).toBe('MANAGER');
    await auth.restore();
    expect(api.calls).toHaveLength(1);
  });

  it('works when the browser blocks storage', async () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    const api = mockApi();
    const auth = useAuthStore();
    auth.apply(session());
    auth.clear();
    await auth.restore({ onlyWithHint: true });
    expect(api.calls).toHaveLength(0);
  });
});

describe('session plugin', () => {
  it('restores the session in the background when the browser signed in before', async () => {
    localStorage.setItem(SIGNED_IN_HINT, '1');
    const api = mockApi().on(REFRESH, { body: session() });
    await (sessionPlugin as unknown as () => unknown)();
    await flushPromises();
    expect(api.called(REFRESH)).toHaveLength(1);
    expect(useAuthStore().signedIn).toBe(true);
  });
});

describe('auth middleware', () => {
  const to = (permission?: string) =>
    ({ meta: { permission }, fullPath: '/perfil?aba=seguranca' }) as unknown as RouteLocationNormalized;
  const run = (route: RouteLocationNormalized) => authGuard(route, route);

  it('lets public pages through', async () => {
    const api = mockApi();
    expect(await run(to())).toBeUndefined();
    expect(api.calls).toHaveLength(0);
  });

  it('sends guests to sign in and back afterwards', async () => {
    mockApi().on(REFRESH, problem(401, 'Sem sessão.'));
    await run(to('profile.manage'));
    expect(navigateMock).toHaveBeenCalledWith({
      path: '/entrar',
      query: { redirect: '/perfil?aba=seguranca' },
    });
  });

  it('blocks people without the permission and lets the others in', async () => {
    mockApi();
    useAuthStore().apply(session(CLIENT_USER));
    await expect(run(to('customers.read'))).rejects.toMatchObject({ statusCode: 403 });
    expect(await run(to('profile.manage'))).toBeUndefined();
  });
});
