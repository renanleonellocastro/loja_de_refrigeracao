import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import BaseButton from '~/components/base/Button.vue';
import BaseIconButton from '~/components/base/IconButton.vue';
import BaseSpinner from '~/components/base/Spinner.vue';

describe('BaseButton', () => {
  it('renders a button with variant and size', async () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const wrapper = await mountSuspended(BaseButton, {
          props: { variant, size },
          slots: { default: () => 'Salvar' },
        });
        const button = wrapper.get('button');
        expect(button.attributes('type')).toBe('button');
        expect(button.text()).toBe('Salvar');
      }
    }
  });

  it('emits clicks and supports submit, block and icon', async () => {
    const onClick = vi.fn();
    const wrapper = await mountSuspended(BaseButton, {
      props: { type: 'submit', block: true, onClick },
      slots: { default: () => 'Enviar', icon: () => h('svg', { 'data-icon': '' }) },
    });
    await wrapper.get('button').trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
    expect(wrapper.get('button').attributes('type')).toBe('submit');
    expect(wrapper.get('button').classes()).toContain('w-full');
    expect(wrapper.find('[data-icon]').exists()).toBe(true);
  });

  it('is busy and disabled while loading', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      props: { loading: true },
      slots: { default: () => 'Salvando', icon: () => h('svg', { 'data-icon': '' }) },
    });
    const button = wrapper.get('button');
    expect(button.attributes('aria-busy')).toBe('true');
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-icon]').exists()).toBe(false);
  });

  it('renders a link when given a route', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      props: { to: '/produtos' },
      slots: { default: () => 'Produtos', icon: () => h('svg') },
    });
    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe('/produtos');
    expect(link.attributes('aria-disabled')).toBeUndefined();
  });

  it('marks a disabled link and removes it from the tab order', async () => {
    const wrapper = await mountSuspended(BaseButton, {
      props: { to: '/produtos', disabled: true },
      slots: { default: () => 'Produtos' },
    });
    const link = wrapper.get('a');
    expect(link.attributes('aria-disabled')).toBe('true');
    expect(link.attributes('tabindex')).toBe('-1');
  });
});

describe('BaseIconButton', () => {
  it('has an accessible name and toggled state', async () => {
    for (const variant of ['ghost', 'secondary', 'primary', 'on-brand'] as const) {
      const wrapper = await mountSuspended(BaseIconButton, {
        props: { label: 'Buscar', variant, size: 'sm', pressed: true },
        slots: { default: () => h('svg') },
      });
      const button = wrapper.get('button');
      expect(button.attributes('aria-label')).toBe('Buscar');
      expect(button.attributes('aria-pressed')).toBe('true');
    }
  });

  it('renders a link with a label', async () => {
    const wrapper = await mountSuspended(BaseIconButton, {
      props: { label: 'Notificações', to: '/notificacoes' },
    });
    expect(wrapper.get('a').attributes('aria-label')).toBe('Notificações');
  });
});

describe('BaseSpinner', () => {
  it('is decorative without a label and a status with one', async () => {
    const silent = await mountSuspended(BaseSpinner);
    expect(silent.attributes('aria-hidden')).toBe('true');
    const status = await mountSuspended(BaseSpinner, { props: { label: 'Carregando' } });
    expect(status.attributes('role')).toBe('status');
    expect(status.attributes('aria-label')).toBe('Carregando');
  });
});
