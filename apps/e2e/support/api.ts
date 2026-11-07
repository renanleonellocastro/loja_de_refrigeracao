import { expect, type APIRequestContext, type APIResponse, type TestInfo } from '@playwright/test';
import { uniqueEmail } from './identity.js';

// The API started by `pnpm --filter @rc/api e2e:stack` with the development seed.
export const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
export const PASSWORD = 'Castro-Dev-2026';
export const ADMIN = 'admin@castro.dev';
export const MANAGER = 'gerente@castro.dev';
export const TECHNICIAN = 'tecnico@castro.dev';

export interface Account {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly token: string;
}

interface Session {
  readonly accessToken: string;
  readonly user: { readonly id: number; readonly name: string; readonly email: string };
}

function accountOf(session: Session): Account {
  return { ...session.user, token: session.accessToken };
}

/** Signs in through the API and returns the account with its access token. */
export async function signInApi(request: APIRequestContext, email: string): Promise<Account> {
  const response = await request.post(`${API}/api/v1/auth/sessions`, { data: { email, password: PASSWORD } });
  expect(response.ok()).toBe(true);
  return accountOf((await response.json()) as Session);
}

/** A new customer, created through the public sign up, that no other test uses. */
export async function newCustomer(
  request: APIRequestContext,
  testInfo: TestInfo,
  name: string,
): Promise<Account> {
  const data = { name, email: uniqueEmail('rf', testInfo), phone: '19999995555', password: PASSWORD };
  const response = await request.post(`${API}/api/v1/customers`, { data: { ...data, acceptPrivacy: true } });
  expect(response.status()).toBe(201);
  return accountOf((await response.json()) as Session);
}

/** Headers for an authenticated call; writes that create records also carry an Idempotency-Key. */
export function as(account: Account, idempotent = false): Record<string, string> {
  const auth = { authorization: `Bearer ${account.token}` };
  return idempotent ? { ...auth, 'idempotency-key': crypto.randomUUID() } : auth;
}

/** Sends a call that must succeed and returns its JSON body. */
export async function call<T>(response: Promise<APIResponse>): Promise<T> {
  const done = await response;
  expect(done.ok(), await done.text()).toBe(true);
  return (await done.json()) as T;
}
