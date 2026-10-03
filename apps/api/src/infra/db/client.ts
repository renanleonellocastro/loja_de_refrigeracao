import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries: the database or an open transaction. */
export type Executor = Database | Transaction;

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
}

// Postgres BIGINT (int8) values used for money fit in a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export function connect(url: string, max = 10): DatabaseHandle {
  const pool = new pg.Pool({ connectionString: url, max });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}

export const MIGRATIONS_FOLDER = new URL('../../../drizzle', import.meta.url).pathname;

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
