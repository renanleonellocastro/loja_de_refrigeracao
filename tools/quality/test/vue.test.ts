import { describe, expect, it } from 'vitest';
import { vueScripts } from '../src/vue.js';

describe('vueScripts', () => {
  it('returns both script blocks with their language and line offset', () => {
    const text = [
      '<template><p /></template>',
      '<script>',
      'export default {};',
      '</script>',
      '<script setup lang="ts">',
      'const a = 1;',
      '</script>',
    ];

    const scripts = vueScripts('page.vue', text.join('\n'));

    expect(scripts.map(({ language, lineOffset }) => [language, lineOffset])).toEqual([
      ['js', 1],
      ['ts', 4],
    ]);
  });

  it('falls back to javascript for languages it does not know', () => {
    const [script] = vueScripts('page.vue', '<script lang="coffee">\nx = 1\n</script>');

    expect(script?.language).toBe('js');
  });

  it('returns nothing for a template only component', () => {
    expect(vueScripts('page.vue', '<template><p /></template>')).toEqual([]);
  });
});
