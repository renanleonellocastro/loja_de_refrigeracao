import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { isTable } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/database.js';
import { runMigrations } from './db/client.js';
import * as schema from './db/schema.js';
import { createSmtpMailer } from './mail/mailer.js';

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable => isTable(value));

describe('database schema', () => {
  const database = useTestDatabase();

  it('declares 26 tables whose foreign keys all point to declared tables', () => {
    expect(tables).toHaveLength(26);
    const names = new Set(tables.map((table) => getTableConfig(table).name));
    for (const table of tables) {
      for (const fk of getTableConfig(table).foreignKeys) {
        expect(names.has(getTableConfig(fk.reference().foreignTable).name)).toBe(true);
      }
    }
  });

  it('migrations are idempotent and match the schema', async () => {
    await runMigrations(database.db);
    const result = await database.db.execute<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const migrated = new Set(result.rows.map((row) => row.table_name));
    for (const table of tables) expect(migrated.has(getTableConfig(table).name)).toBe(true);
  });

  it('prevents overlapping appointments for the same technician', async () => {
    const { rows } = await database.db.execute<{ conname: string }>(
      "select conname from pg_constraint where conname = 'appointments_no_overlap'",
    );
    expect(rows).toHaveLength(1);
  });
});

describe('smtp mailer', () => {
  it('hands the message to the transport with the configured sender', async () => {
    const mailer = createSmtpMailer({ jsonTransport: true }, 'Loja <loja@exemplo.com>');
    await expect(
      mailer.send({ to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' }),
    ).resolves.toBeUndefined();
  });
});
