import pg from 'pg';
import { connect, runMigrations } from '../src/infra/db/client.js';

export const TEMPLATE_DB = 'rc_test_template';

export function adminUrl(): string {
  return process.env.TEST_DATABASE_URL ?? 'postgres://castro:castro@localhost:5433/castro';
}

export function urlFor(database: string): string {
  const url = new URL(adminUrl());
  url.pathname = `/${database}`;
  return url.toString();
}

/** Builds a migrated template database once; each test file clones it (see test/database.ts). */
export default async function setup(): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEMPLATE_DB}`);
  await admin.end();

  const template = connect(urlFor(TEMPLATE_DB), 1);
  await runMigrations(template.db);
  await template.close();
}
