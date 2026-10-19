import { createApiClient, type ApiClient } from '@rc/contracts';

export type Api = ApiClient;

type AuthStore = ReturnType<typeof useAuthStore>;

/** What a call needs to renew the session after a 401: the auth store and what to do when it is over. */
interface SessionRenewal {
  auth: Pick<AuthStore, 'refresh' | 'signedIn' | 'accessToken'>;
  onExpired: () => Promise<void>;
}

function expiredSessionHandler(auth: Pick<AuthStore, 'clear'>): () => Promise<void> {
  const route = useRoute();
  const toast = useToast();
  return async () => {
    auth.clear();
    toast.info({ title: 'Sua sessão terminou. Entre de novo para continuar.' });
    await navigateTo({ path: '/entrar', query: { redirect: route.fullPath } });
  };
}

function isRenewable(request: Request, response: Response): boolean {
  return response.status === 401 && request.headers.has('authorization');
}

async function retryWithRenewedToken(
  retry: Request,
  response: Response,
  renewal: SessionRenewal,
): Promise<Response> {
  if (!(await renewal.auth.refresh())) {
    // A refused refresh signs out; a network failure keeps the session for the next try.
    if (!renewal.auth.signedIn) await renewal.onExpired();
    return response;
  }
  retry.headers.set('authorization', `Bearer ${renewal.auth.accessToken}`);
  return globalThis.fetch(retry);
}

function renewingFetch(
  renewal: SessionRenewal,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const request = new Request(input, init);
    const retry = request.clone();
    const response = await globalThis.fetch(request);
    return isRenewable(request, response) ? retryWithRenewedToken(retry, response, renewal) : response;
  };
}

/**
 * Typed API client of the signed in person. Sends the access token, renews it once when the API answers 401
 * and repeats the call; when the session cannot be renewed, sends the person to sign in again.
 * Use with unwrap(): `const me = await unwrap(api.GET('/api/v1/me'))`.
 */
export function useApi(): Api {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const renewal: SessionRenewal = { auth, onExpired: expiredSessionHandler(auth) };
  return createApiClient({
    baseUrl: config.public.apiBase,
    getAccessToken: () => auth.accessToken,
    fetch: renewingFetch(renewal),
  });
}
