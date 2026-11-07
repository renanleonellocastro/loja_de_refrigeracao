import { mount } from '@vue/test-utils';
import { createSSRApp, defineComponent, h, nextTick, ref, withDirectives } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it } from 'vitest';
import { applyDynamicStyle, dynamicStyleDirective, type DynamicStyle } from '~/utils/dynamic-style';
import dynamicStylePlugin from '~/plugins/dynamic-style';

function probe(style: () => DynamicStyle) {
  return defineComponent({
    setup: () => () => withDirectives(h('span'), [[dynamicStyleDirective, style()]]),
  });
}

describe('applyDynamicStyle', () => {
  it('sets new declarations and removes the ones that are gone', () => {
    const element = document.createElement('span');
    applyDynamicStyle(element, { width: '40%', 'background-color': 'red' }, {});
    applyDynamicStyle(element, { width: '50%' }, { width: '40%', 'background-color': 'red' });
    expect(element.style.width).toBe('50%');
    expect(element.style.backgroundColor).toBe('');
  });
});

describe('v-dynamic-style', () => {
  it('writes through the CSSOM when mounted and when the value changes', async () => {
    const width = ref('10%');
    const wrapper = mount(probe(() => ({ width: width.value })));
    expect((wrapper.element as HTMLElement).style.width).toBe('10%');
    width.value = '70%';
    await nextTick();
    expect((wrapper.element as HTMLElement).style.width).toBe('70%');
  });

  it('treats a missing previous value as empty', () => {
    const element = document.createElement('span');
    const binding = { value: { width: '5%' }, oldValue: null } as never;
    dynamicStyleDirective.updated!(element, binding, null as never, null as never);
    expect(element.style.width).toBe('5%');
  });

  it('renders no style attribute on the server', async () => {
    const app = createSSRApp(probe(() => ({ width: '30%' })));
    expect(await renderToString(app)).toBe('<span></span>');
  });

  it('is registered by the plugin', async () => {
    const directives: Record<string, unknown> = {};
    const nuxtApp = { vueApp: { directive: (name: string, value: unknown) => (directives[name] = value) } };
    await (dynamicStylePlugin as unknown as (app: typeof nuxtApp) => unknown)(nuxtApp);
    expect(directives['dynamic-style']).toBe(dynamicStyleDirective);
  });
});
