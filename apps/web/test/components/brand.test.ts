import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppLogo from '~/components/AppLogo.vue';
import ErrorState from '~/components/ErrorState.vue';
import FrostLines from '~/components/FrostLines.vue';
import ThemeToggle from '~/components/ThemeToggle.vue';
import WhatsAppButton from '~/components/WhatsAppButton.vue';
import IllustrationEmptyBox from '~/components/illustration/EmptyBox.vue';
import IllustrationLock from '~/components/illustration/Lock.vue';
import IllustrationThermometer from '~/components/illustration/Thermometer.vue';
import { useCurrentActor } from '~/composables/useCurrentActor';
import { useOnline } from '~/composables/useOnline';
import { useCartStore } from '~/stores/cart';
import { defineComponent, h } from 'vue';

describe('AppLogo', () => {
  it('has the store name and inlines the full sign', async () => {
    const wrapper = await mountSuspended(AppLogo);
    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toBe('Refrigeração Castro');
    const svg = wrapper.get('svg');
    expect(svg.attributes('aria-hidden')).toBe('true');
    expect(svg.find('title').exists()).toBe(false);
    expect(wrapper.html()).toContain('fill="currentColor"');
  });

  it('renders the symbol with the silver relief', async () => {
    const wrapper = await mountSuspended(AppLogo, { props: { variant: 'symbol', relief: true } });
    expect(wrapper.html()).toContain('-silver');
    expect(wrapper.html()).not.toContain('fill="currentColor"');
  });
});

describe('decorations', () => {
  it('are hidden from assistive technology', async () => {
    for (const component of [FrostLines, IllustrationEmptyBox, IllustrationLock, IllustrationThermometer]) {
      const wrapper = await mountSuspended(component);
      expect(wrapper.attributes('aria-hidden')).toBe('true');
    }
  });
});

describe('WhatsAppButton', () => {
  it('opens WhatsApp in a new tab with a prefilled message', async () => {
    const wrapper = await mountSuspended(WhatsAppButton);
    const href = wrapper.attributes('href')!;
    expect(href).toContain('https://wa.me/551938041658?text=');
    expect(decodeURIComponent(href)).toContain('Vim pelo site');
    expect(wrapper.attributes('target')).toBe('_blank');
    expect(wrapper.attributes('rel')).toContain('noopener');
    expect(wrapper.attributes('aria-label')).toContain('WhatsApp');
  });

  it('accepts another number and message', async () => {
    const wrapper = await mountSuspended(WhatsAppButton, {
      props: { phone: '5511999999999', message: 'Oi' },
    });
    expect(wrapper.attributes('href')).toBe('https://wa.me/5511999999999?text=Oi');
  });
});

describe('ThemeToggle', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('starts from the saved choice, applies and remembers a new one', async () => {
    localStorage.setItem('rc-theme', 'light');
    const wrapper = await mountSuspended(ThemeToggle);
    await flushPromises();
    expect(wrapper.get('legend').text()).toBe('Tema');
    const radios = wrapper.findAll('input[type="radio"]');
    expect(radios.map((r) => (r.element as HTMLInputElement).checked)).toEqual([true, false, false]);
    await radios[1]!.setValue(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('rc-theme')).toBe('dark');
    await radios[2]!.setValue(true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('rc-theme')).toBe('system');
  });

  it('has a brand and a full width version', async () => {
    const wrapper = await mountSuspended(ThemeToggle, { props: { tone: 'brand', block: true } });
    expect(wrapper.classes()).toContain('w-full');
    expect(wrapper.classes()).toContain('bg-white/10');
  });
});

describe('ErrorState', () => {
  it('shows friendly copy per error and a retry when it helps', async () => {
    const cases = [
      ['not-found', 'Erro 404', false],
      ['server', 'Erro no servidor', true],
      ['forbidden', 'Sem permissão', false],
      ['offline', 'Sem conexão', true],
    ] as const;
    for (const [kind, eyebrow, retry] of cases) {
      const wrapper = await mountSuspended(ErrorState, { props: { kind } });
      expect(wrapper.text()).toContain(eyebrow);
      expect(wrapper.find('h1').exists()).toBe(true);
      const button = wrapper.findAll('button').find((b) => b.text() === 'Tentar de novo');
      expect(Boolean(button)).toBe(retry);
      expect(wrapper.get('a[href="/"]').text()).toBe('Voltar ao início');
      const image = wrapper.find('img');
      expect(image.exists()).toBe(kind === 'not-found' || kind === 'offline');
    }
  });

  it('shows the status code of server errors and emits retry', async () => {
    const wrapper = await mountSuspended(ErrorState, {
      props: { kind: 'server', statusCode: 503, headingLevel: 3 },
    });
    expect(wrapper.text()).toContain('Erro 503');
    expect(wrapper.find('h3').exists()).toBe(true);
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});

describe('state composables', () => {
  it('start as guest with an empty cart', async () => {
    const Probe = defineComponent({
      setup: () => {
        const actor = useCurrentActor();
        const cart = useCartStore();
        return () => h('p', `${actor.value}:${cart.count}`);
      },
    });
    const wrapper = await mountSuspended(Probe);
    expect(wrapper.text()).toBe('GUEST:0');
  });

  it('tracks the connection', async () => {
    const Probe = defineComponent({
      setup: () => {
        const online = useOnline();
        return () => h('p', String(online.value));
      },
    });
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const wrapper = await mountSuspended(Probe);
    expect(wrapper.text()).toBe('false');
    spy.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await flushPromises();
    expect(wrapper.text()).toBe('true');
    wrapper.unmount();
    spy.mockRestore();
  });
});
