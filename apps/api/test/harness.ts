import type { Role } from '@rc/contracts';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import type { AppContext } from '../src/context.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryMailer } from '../src/infra/mail/mailer.js';
import { createLocalStorage } from '../src/infra/storage/storage.js';
import { hashPassword } from '../src/modules/auth/passwords.js';
import { EMAIL_TOPIC, emailHandler } from '../src/modules/mail/service.js';
import { processOutboxBatch } from '../src/modules/outbox/service.js';
import { insertUser, type NewUser, type UserRow } from '../src/modules/users/service.js';
import { FixedClock } from '../src/shared/clock.js';
import { useTestDatabase } from './database.js';

/** Answers like ViaCEP for 13800061 (the store) and 404 style for 99999999; fails for 00000000. */
export const fakeFetch: typeof globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('00000000')) throw new Error('network down');
  const body = url.includes('13800061')
    ? {
        cep: '13800-061',
        logradouro: 'Rua Doutor Ulhoa Cintra',
        bairro: 'Centro',
        localidade: 'Mogi Mirim',
        uf: 'SP',
      }
    : { erro: 'true' };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
};

export const TEST_PASSWORD = 'Geladeira-Nova-2026';
export const START = new Date('2026-10-05T12:00:00.000Z');

let passwordHashCache: Promise<string> | undefined;
const testPasswordHash = () => (passwordHashCache ??= hashPassword(TEST_PASSWORD));

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...overrides });
}

/** Spins up the real app against a fresh database for the test file. */
export function useTestApp(configOverrides: Record<string, string> = {}) {
  const database = useTestDatabase();
  const mailer = new MemoryMailer();
  const clock = new FixedClock(START);
  const state: { app?: FastifyInstance; ctx?: AppContext } = {};
  let counter = 0;

  beforeAll(async () => {
    const storage = createLocalStorage(mkdtempSync(join(tmpdir(), 'rc-storage-')));
    state.ctx = {
      config: testConfig(configOverrides),
      db: database.db,
      mailer,
      clock,
      storage,
      fetch: fakeFetch,
    };
    state.app = await buildApp(state.ctx);
    await state.app.ready();
  });

  beforeEach(async () => {
    await database.reset();
    mailer.sent.length = 0;
    clock.set(START);
  });

  afterAll(async () => {
    await state.app?.close();
  });

  const harness = {
    get app(): FastifyInstance {
      return state.app!;
    },
    get ctx(): AppContext {
      return state.ctx!;
    },
    get db() {
      return database.db;
    },
    mailer,
    clock,

    async createUser(role: Role = 'CLIENT', overrides: Partial<NewUser> = {}): Promise<UserRow> {
      counter += 1;
      return insertUser(database.db, {
        role,
        name: `Pessoa Teste ${counter}`,
        email: `pessoa${counter}@exemplo.com.br`,
        passwordHash: await testPasswordHash(),
        emailVerifiedAt: START,
        ...overrides,
      });
    },

    async login(user: { email: string }, password = TEST_PASSWORD) {
      const response = await state.app!.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions',
        payload: { email: user.email, password },
      });
      const cookie = response.cookies.find((c) => c.name === 'rc_refresh');
      return {
        response,
        token: response.json<{ accessToken?: string }>().accessToken,
        refresh: cookie?.value,
      };
    },

    /** A bearer header for a new user of the given role. */
    async as(role: Role, overrides: Partial<NewUser> = {}) {
      const user = await harness.createUser(role, overrides);
      const { token } = await harness.login(user);
      return { user, headers: { authorization: `Bearer ${token}` } };
    },

    /** Runs the worker once so queued emails land in the memory mailer. */
    async deliverEmails() {
      return processOutboxBatch(database.db, { [EMAIL_TOPIC]: emailHandler(state.ctx!) }, clock, 100);
    },

    lastEmailTo(address: string) {
      return [...mailer.sent].reverse().find((m) => m.to === address);
    },

    linkToken(text: string): string {
      const match = /\/([A-Za-z0-9_-]{30,})(?:\s|$)/m.exec(text);
      if (!match?.[1]) throw new Error(`No token link in: ${text}`);
      return match[1];
    },
  };
  return harness;
}
