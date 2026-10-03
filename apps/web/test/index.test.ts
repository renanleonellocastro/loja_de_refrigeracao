import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import IndexPage from '~/pages/index.vue';

describe('home page', () => {
  it('shows the store name', async () => {
    const page = await mountSuspended(IndexPage);
    expect(page.get('h1').text()).toBe('Refrigeração Castro');
  });
});
