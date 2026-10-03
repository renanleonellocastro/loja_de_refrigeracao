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

export function createLocalStorage(root: string): Storage {
  const base = resolve(root);
  const pathFor = (key: string) => {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new InvalidStorageKeyError(key);
    return join(base, key);
  };
  return {
    async put(key, data) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
    },
    async get(key) {
      try {
        return await readFile(pathFor(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async remove(prefix) {
      await rm(pathFor(prefix), { recursive: true, force: true });
    },
  };
}
