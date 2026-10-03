import { describe, expect, it, vi } from 'vitest';
import hydrated from '~/plugins/hydrated.client';

describe('hydrated plugin', () => {
  it('marks the document once the app resolves', async () => {
    const hooks: Record<string, () => void> = {};
    const nuxtApp = { hook: vi.fn((name: string, fn: () => void) => (hooks[name] = fn)) };
    await (hydrated as unknown as (app: typeof nuxtApp) => unknown)(nuxtApp);
    document.documentElement.removeAttribute('data-hydrated');
    hooks['app:suspense:resolve']!();
    expect(document.documentElement.dataset.hydrated).toBe('true');
  });
});
