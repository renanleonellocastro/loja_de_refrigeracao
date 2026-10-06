import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getTableName, sql } from 'drizzle-orm';
import { isTable } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, inject } from 'vitest';
import { connect, type DatabaseHandle } from '../src/infra/db/client.js';
import * as schema from '../src/infra/db/schema.js';
import { adminUrl, urlFor } from './global-setup.js';

// Reapplied after every truncate so tests start with the real store settings row.
const STORE_DEFAULTS_SQL = readFileSync(
  new URL('../drizzle/0004_store_settings_default.sql', import.meta.url),
  'utf8',
);

const tableNames = Object.values(schema)
  .filter((value) => isTable(value))
  .map((table) => `"${getTableName(table)}"`);

async function admin<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/**
 * Gives the test file its own database cloned from the migrated template.
 * Call `reset()` in beforeEach to start every test from empty tables.
 */
export function useTestDatabase() {
  const name = `rc_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const state: { handle?: DatabaseHandle } = {};

  beforeAll(async () => {
    await admin((client) => client.query(`CREATE DATABASE ${name} TEMPLATE ${inject('templateDb')}`));
    state.handle = connect(urlFor(name), 5);
  });

  afterAll(async () => {
    await state.handle?.close();
    await admin(async (client) => {
      // pool.end() resolves before the sockets close; forcing the drop while they are still open
      // makes Postgres terminate them, and the late 57P01 surfaces as an unhandled error.
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const { rows } = await client.query<{ open: number }>(
          'SELECT count(*)::int AS open FROM pg_stat_activity WHERE datname = $1',
          [name],
        );
        if (rows[0]!.open === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    });
  });

  return {
    get db() {
      if (!state.handle) throw new Error('Database not ready; use it inside tests or hooks.');
      return state.handle.db;
    },
    async reset() {
      await this.db.execute(sql.raw(`TRUNCATE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`));
      await this.db.execute(sql.raw(STORE_DEFAULTS_SQL));
    },
  };
}
