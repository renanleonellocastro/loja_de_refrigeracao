import { mkdtempSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InvalidStorageKeyError, createLocalStorage } from './storage.js';

describe('local storage', () => {
  const root = mkdtempSync(join(tmpdir(), 'rc-storage-test-'));
  const storage = createLocalStorage(root);

  it('stores, reads and removes by prefix', async () => {
    await storage.put('abc/320.webp', Buffer.from('a'));
    await storage.put('abc/640.webp', Buffer.from('b'));
    expect((await storage.get('abc/640.webp'))?.toString()).toBe('b');
    await storage.remove('abc');
    expect(await storage.get('abc/320.webp')).toBeNull();
  });

  it('refuses keys that could escape the root', async () => {
    for (const key of ['../etc/passwd', '/abs', 'a/../../b', 'Upper.webp']) {
      await expect(storage.put(key, Buffer.from('x'))).rejects.toBeInstanceOf(InvalidStorageKeyError);
    }
  });

  it('propagates unexpected read errors', async () => {
    await mkdir(join(root, 'folder'), { recursive: true });
    await expect(storage.get('folder')).rejects.toMatchObject({ code: 'EISDIR' });
  });
});
