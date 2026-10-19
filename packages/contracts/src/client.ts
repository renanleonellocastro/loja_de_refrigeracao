import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { components, paths } from './generated/api.js';

export type ApiPaths = paths;
export type ApiClient = Client<paths>;
/** Named schemas of the API, for example `ApiSchemas['UserDetail']`. */
export type ApiSchemas = components['schemas'];

export interface ApiClientOptions {
  /** Origin of the API, for example http://localhost:3001 (paths already include /api/v1). */
  baseUrl: string;
  /** Current access token, sent as a bearer token when present. */
  getAccessToken?: () => string | null | undefined;
  fetch?: typeof globalThis.fetch;
}

type AccessTokenReader = NonNullable<ApiClientOptions['getAccessToken']>;

function bearerTokenMiddleware(getAccessToken: AccessTokenReader): Middleware {
  return {
    onRequest({ request }) {
      const token = getAccessToken();
      if (token) request.headers.set('authorization', `Bearer ${token}`);
      return request;
    },
  };
}

/** Typed client generated from the OpenAPI document. Cookies are included for the refresh flow. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: 'include',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  if (options.getAccessToken) client.use(bearerTokenMiddleware(options.getAccessToken));
  return client;
}
