import type { AppContext } from '../../context.js';
import { storageKeysInUse } from './repository.js';

/**
 * Removes stored photos that no product image or media row references anymore.
 * Runs after the commit: files are not transactional, and keys are content addressed and shared.
 */
export async function removeUnusedKeys(ctx: AppContext, keys: string[]): Promise<void> {
  const unique = [...new Set(keys)];
  const inUse = await storageKeysInUse(ctx.db, unique);
  for (const key of unique) {
    if (!inUse.has(key)) await ctx.storage.remove(key);
  }
}
