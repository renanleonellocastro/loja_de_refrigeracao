import { expect, type APIRequestContext } from '@playwright/test';

// Mailpit catches every email the outbox worker sends during the E2E run (infra/compose.yaml, CI service).
const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
// The worker polls the outbox every few seconds, so an email can take a while to arrive.
const DELIVERY_TIMEOUT = 20_000;
// Ids restart with every E2E database, so an earlier local run may have left an email with the same subject in
// Mailpit. Only emails received after this worker started count; the slack absorbs the clock of the container.
const CLOCK_SLACK = 5_000;
const WORKER_START = Date.now() - CLOCK_SLACK;

export interface Email {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

interface Summary {
  readonly ID: string;
  readonly Subject: string;
  readonly Created: string;
}

interface Message {
  readonly Subject: string;
  readonly Text: string;
  readonly HTML: string;
}

async function search(request: APIRequestContext, to: string): Promise<Summary[]> {
  const response = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { messages: Summary[] }).messages;
}

async function findId(request: APIRequestContext, to: string, subject: string): Promise<string | undefined> {
  const fresh = (message: Summary) => Date.parse(message.Created) >= WORKER_START;
  return (await search(request, to)).find((message) => message.Subject === subject && fresh(message))?.ID;
}

/** Waits for the email with exactly this subject sent to this address and returns its content. */
export async function waitForEmail(request: APIRequestContext, to: string, subject: string): Promise<Email> {
  let id: string | undefined;
  await expect
    .poll(async () => (id = await findId(request, to, subject)), {
      message: `email "${subject}" para ${to}`,
      timeout: DELIVERY_TIMEOUT,
    })
    .toBeTruthy();
  const message = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as Message;
  return { subject: message.Subject, text: message.Text, html: message.HTML };
}

/** Path of the first link in the email that starts with this path, so it opens on the site under test. */
export function linkPath(email: Email, path: string): string {
  const found = email.text.match(new RegExp(`https?://[^\\s/]+(${path}[^\\s)>\\]]*)`));
  expect(found, `link ${path} no email "${email.subject}"`).not.toBeNull();
  return found![1]!;
}
