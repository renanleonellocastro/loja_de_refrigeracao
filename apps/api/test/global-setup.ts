import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { connect, runMigrations } from '../src/infra/db/client.js';

declare module 'vitest' {
  export interface ProvidedContext {
    templateDb: string;
  }
}

export function adminUrl(): string {
  return process.env.TEST_DATABASE_URL ?? 'postgres://castro:castro@localhost:5433/castro';
}

export function urlFor(database: string): string {
  const url = new URL(adminUrl());
  url.pathname = `/${database}`;
  return url.toString();
}

async function adminQuery(sql: string): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    await admin.query(sql);
  } finally {
    await admin.end();
  }
}

/**
 * Builds a migrated template database once per run; each test file clones it (see test/database.ts).
 * The name is unique per run so parallel runs (several worktrees, CI shards) never clash.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const templateDb = `rc_tpl_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await adminQuery(`CREATE DATABASE ${templateDb}`);
  const template = connect(urlFor(templateDb), 1);
  await runMigrations(template.db);
  await template.close();
  project.provide('templateDb', templateDb);
  return () => adminQuery(`DROP DATABASE IF EXISTS ${templateDb} WITH (FORCE)`);
}
