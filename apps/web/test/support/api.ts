import { vi } from 'vitest';

/** Answer of a mocked endpoint: a status and JSON body, or an error to simulate no connection. */
export type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;
type Handler = (request: Request) => Reply;

export interface RecordedCall {
  key: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

export interface ApiMock {
  calls: RecordedCall[];
  /** Registers answers for "METHOD /path"; several answers are used in order and the last one repeats. */
  on: (key: string, ...replies: Array<Reply | Handler>) => ApiMock;
  called: (key: string) => RecordedCall[];
}

/** Replaces fetch with a small router so components talk to a fake API. Unknown routes answer 404. */
export function mockApi(): ApiMock {
  const routes = new Map<string, Array<Reply | Handler>>();
  const calls: RecordedCall[] = [];

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}`;
    const text = await request.clone().text();
    calls.push({ key, url, headers: request.headers, body: text ? JSON.parse(text) : undefined });
    const queue = routes.get(key);
    const entry = queue ? (queue.length > 1 ? queue.shift()! : queue[0]!) : { status: 404, body: {} };
    const reply = typeof entry === 'function' ? entry(request) : entry;
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    const body = status === 204 ? null : JSON.stringify(reply.body ?? {});
    return new Response(body, { status, headers: { 'content-type': 'application/json', ...reply.headers } });
  });

  const mock: ApiMock = {
    calls,
    on(key, ...replies) {
      routes.set(key, replies);
      return mock;
    },
    called: (key) => calls.filter((call) => call.key === key),
  };
  return mock;
}

export const problem = (status: number, detail: string, extra: Record<string, unknown> = {}) => ({
  status,
  body: {
    type: `https://refrigeracaocastro.com.br/problemas/${extra.code ?? 'erro'}`,
    title: detail,
    status,
    detail,
    ...extra,
  },
});

export const CLIENT_USER = {
  id: 4,
  name: 'Carla Cliente',
  email: 'cliente@castro.dev',
  role: 'CLIENT' as const,
};
export const MANAGER_USER = {
  id: 2,
  name: 'Marina Gerente',
  email: 'gerente@castro.dev',
  role: 'MANAGER' as const,
};

export const session = (user = CLIENT_USER) => ({ accessToken: `token-${user.id}`, expiresIn: 900, user });

export const PROFILE = {
  ...CLIENT_USER,
  phone: '19999998888',
  cpf: null,
  address: {
    cep: '13800061',
    street: 'Rua Doutor Ulhoa Cintra',
    number: '91',
    complement: null,
    district: 'Centro',
    city: 'Mogi Mirim',
    state: 'SP',
  },
  emailVerified: true,
  pendingInvitation: false,
  createdAt: '2026-10-03T15:00:00.000Z',
};

/** Fills the input labeled `label` anywhere in the document (dialogs render in a portal). */
export async function fill(label: string, value: string): Promise<void> {
  const element = [...document.querySelectorAll('label')].find((item) =>
    item.textContent?.replace('*', '').trim().startsWith(label),
  );
  if (!element) throw new Error(`No field labeled ${label}`);
  const input = document.getElementById(element.htmlFor) as HTMLInputElement | HTMLSelectElement;
  input.value = value;
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Clicks the button whose text is exactly `text`, anywhere in the document. */
export function click(text: string, index = 0): void {
  const buttons = [...document.querySelectorAll('button')].filter(
    (item) => item.textContent?.trim() === text,
  );
  if (!buttons[index]) throw new Error(`No button ${text}`);
  buttons[index].click();
}

/** Submits the form that contains the button `text`. */
export function submit(text: string): void {
  const forms = [...document.querySelectorAll('button')]
    .filter((item) => item.textContent?.trim() === text)
    .map((item) => item.form ?? item.closest('form'))
    .filter((form) => form !== null);
  if (!forms[0]) throw new Error(`No form submitted by ${text}`);
  forms[0].dispatchEvent(new Event('submit', { cancelable: true }));
}
