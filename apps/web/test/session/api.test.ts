import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApi } from '~/composables/useApi';
import { useUnreadCount } from '~/composables/useNotifications';
import { useToast } from '~/composables/useToast';
import { useAuthStore } from '~/stores/auth';
import { unwrap } from '~/utils/api-error';
import { PROFILE, mockApi, problem, session } from '../support/api';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const REFRESH = 'POST /api/v1/auth/sessions/refresh';

afterEach(() => {
  useAuthStore().clear();
  useToast().clear();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
});

describe('useApi', () => {
  it('sends the token and renews it once on 401', async () => {
    const api = mockApi()
      .on('GET /api/v1/me', problem(401, 'Token vencido.'), { body: PROFILE })
      .on(REFRESH, { body: { ...session(), accessToken: 'token-novo' } });
    useAuthStore().apply(session());
    const me = await unwrap(useApi().GET('/api/v1/me'));
    expect(me.name).toBe('Carla Cliente');
    const gets = api.called('GET /api/v1/me');
    expect(gets.map((call) => call.headers.get('authorization'))).toEqual([
      'Bearer token-4',
      'Bearer token-novo',
    ]);
  });

  it('does not refresh calls without a token', async () => {
    const api = mockApi().on('GET /api/v1/me', problem(401, 'Entre primeiro.'));
    await expect(unwrap(useApi().GET('/api/v1/me'))).rejects.toThrow('Entre primeiro.');
    expect(api.called(REFRESH)).toHaveLength(0);
  });

  it('sends the person to sign in when the session cannot be renewed', async () => {
    mockApi()
      .on('GET /api/v1/me', problem(401, 'Token vencido.'))
      .on(REFRESH, problem(401, 'Sessão encerrada.'));
    useAuthStore().apply(session());
    await expect(unwrap(useApi().GET('/api/v1/me'))).rejects.toMatchObject({ status: 401 });
    expect(useToast().toasts.value[0]!.title).toContain('Sua sessão terminou');
    expect(navigateMock).toHaveBeenCalledWith({ path: '/entrar', query: { redirect: '/' } });
  });

  it('keeps the session when renewing fails for lack of connection', async () => {
    mockApi().on('GET /api/v1/me', problem(401, 'Token vencido.')).on(REFRESH, new TypeError('offline'));
    useAuthStore().apply(session());
    await expect(unwrap(useApi().GET('/api/v1/me'))).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore().signedIn).toBe(true);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('useUnreadCount', () => {
  it('counts unread notifications of the signed in person', async () => {
    const api = mockApi().on(
      'GET /api/v1/me/notifications',
      { body: { data: [], meta: { page: 1, pageSize: 1, total: 9, unread: 3 } } },
      problem(500, 'Erro.'),
    );
    const { count, refresh } = useUnreadCount();
    count.value = 5;
    await refresh();
    expect(count.value).toBe(0);
    expect(api.calls).toHaveLength(0);
    useAuthStore().apply(session());
    await refresh();
    expect(count.value).toBe(3);
    await refresh();
    expect(count.value).toBe(3);
  });
});
