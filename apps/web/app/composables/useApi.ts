import { createApiClient, type ApiClientWith } from '@rc/contracts';
import type { ExtraPaths } from '~/utils/api-extra';

export type Api = ApiClientWith<ExtraPaths>;

/**
 * Typed API client of the signed in person. Sends the access token, renews it once when the API answers 401
 * and repeats the call; when the session cannot be renewed, sends the person to sign in again.
 * Use with unwrap(): `const me = await unwrap(api.GET('/api/v1/me'))`.
 */
export function useApi(): Api {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const route = useRoute();
  const toast = useToast();

  async function expired(): Promise<void> {
    auth.clear();
    toast.info({ title: 'Sua sessão terminou. Entre de novo para continuar.' });
    await navigateTo({ path: '/entrar', query: { redirect: route.fullPath } });
  }

  async function send(request: Request): Promise<Response> {
    const retry = request.clone();
    const response = await globalThis.fetch(request);
    if (response.status !== 401 || !request.headers.has('authorization')) return response;
    if (!(await auth.refresh())) {
      // A refused refresh signs out; a network failure keeps the session for the next try.
      if (!auth.signedIn) await expired();
      return response;
    }
    retry.headers.set('authorization', `Bearer ${auth.accessToken}`);
    return globalThis.fetch(retry);
  }

  return createApiClient({
    baseUrl: config.public.apiBase,
    getAccessToken: () => auth.accessToken,
    fetch: send,
  }) as unknown as Api;
}
