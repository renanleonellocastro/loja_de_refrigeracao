// Shared by the local stacks (E2E and load test): drops and recreates a throwaway database, then migrates it
// and loads the development seed. The name must carry a marker so a typo never wipes the development database.
import pg from 'pg';
import { connect, runMigrations } from '../src/infra/db/client.js';
import { seedDevelopment } from '../src/infra/db/seed.js';

async function recreate(databaseUrl: string, marker: string): Promise<void> {
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes(marker)) {
    throw new Error(`Refusing to recreate "${name}": the database name must contain "${marker}".`);
  }
  const maintenance = new URL(databaseUrl);
  maintenance.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: maintenance.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
}

/** Recreates the database, migrates it and loads the development seed. */
export async function prepareSeededDatabase(databaseUrl: string, marker: string): Promise<void> {
  await recreate(databaseUrl, marker);
  const database = connect(databaseUrl, 1);
  await runMigrations(database.db);
  await seedDevelopment(database.db);
  await database.close();
}
