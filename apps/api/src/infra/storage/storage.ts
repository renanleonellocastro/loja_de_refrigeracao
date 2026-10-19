import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/** Where uploaded files live. Local disk today; an S3 compatible adapter can implement the same port. */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** Removes a key and everything under it. */
  remove(prefix: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/._-]*$/;

export class InvalidStorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${key}`);
    this.name = 'InvalidStorageKeyError';
  }
}

function pathIn(base: string, key: string): string {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new InvalidStorageKeyError(key);
  return join(base, key);
}

async function writeCreatingFolders(path: string, data: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function readIfExists(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export function createLocalStorage(root: string): Storage {
  const base = resolve(root);
  return {
    put: async (key, data) => writeCreatingFolders(pathIn(base, key), data),
    get: async (key) => readIfExists(pathIn(base, key)),
    remove: async (prefix) => rm(pathIn(base, prefix), { recursive: true, force: true }),
  };
}
