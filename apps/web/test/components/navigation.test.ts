import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { Pencil } from 'lucide-vue-next';
import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import BaseBreadcrumbs from '~/components/base/Breadcrumbs.vue';
import BaseMenu from '~/components/base/Menu.vue';
import BasePagination from '~/components/base/Pagination.vue';
import BaseTabs from '~/components/base/Tabs.vue';

describe('BaseBreadcrumbs', () => {
  it('links ancestors and marks the current page', async () => {
    const wrapper = await mountSuspended(BaseBreadcrumbs, {
      props: {
        items: [{ label: 'Início', to: '/' }, { label: 'Produtos', to: '/produtos' }, { label: 'Filtro' }],
      },
    });
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Você está em');
    expect(wrapper.findAll('a').map((a) => a.text())).toEqual(['Início', 'Produtos']);
    expect(wrapper.get('[aria-current="page"]').text()).toBe('Filtro');
  });
});

describe('BasePagination', () => {
  it('moves between pages and disables the ends', async () => {
    const wrapper = await mountSuspended(BasePagination, {
      props: { total: 10, page: 1, 'onUpdate:page': (value: number) => wrapper.setProps({ page: value }) },
    });
    expect(wrapper.get('button[aria-label="Página anterior"]').attributes('disabled')).toBeDefined();
    await wrapper.get('button[aria-label="Próxima página"]').trigger('click');
    expect(wrapper.props('page')).toBe(2);
    expect(wrapper.get('[aria-current="page"]').text()).toBe('2');
    expect(wrapper.text()).toContain('2 de 10');
    await wrapper.get('button[aria-label="Página 10"]').trigger('click');
    expect(wrapper.get('button[aria-label="Próxima página"]').attributes('disabled')).toBeDefined();
    await wrapper.get('button[aria-label="Página anterior"]').trigger('click');
    expect(wrapper.props('page')).toBe(9);
    expect(wrapper.findAll('span[aria-hidden="true"]').some((s) => s.text() === '…')).toBe(true);
  });

  it('hides itself with a single page and accepts a label', async () => {
    const single = await mountSuspended(BasePagination, { props: { total: 1 } });
    expect(single.find('nav').exists()).toBe(false);
    const labeled = await mountSuspended(BasePagination, {
      props: { total: 3, label: 'Páginas de pedidos' },
    });
    expect(labeled.get('nav').attributes('aria-label')).toBe('Páginas de pedidos');
  });
});

describe('BaseTabs', () => {
  const tabs = [
    { value: 'pedidos', label: 'Pedidos', count: 3 },
    { value: 'servicos', label: 'Serviços' },
  ];

  it('selects the first tab by default and moves with the keyboard', async () => {
    const wrapper = await mountSuspended(BaseTabs, {
      props: { tabs, label: 'Histórico' },
      slots: { pedidos: () => 'Lista de pedidos', servicos: () => 'Lista de serviços' },
      attachTo: document.body,
    });
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Histórico');
    const triggers = wrapper.findAll('[role="tab"]');
    expect(triggers[0]!.attributes('aria-selected')).toBe('true');
    expect(triggers[0]!.text()).toContain('3');
    expect(wrapper.get('[role="tabpanel"][data-state="active"]').text()).toBe('Lista de pedidos');
    (triggers[0]!.element as HTMLElement).focus();
    await triggers[0]!.trigger('keydown', { key: 'ArrowRight' });
    await flushPromises();
    expect(document.activeElement).toBe(triggers[1]!.element);
    await triggers[1]!.trigger('mousedown', { button: 0, ctrlKey: false });
    await flushPromises();
    expect(wrapper.get('[role="tabpanel"][data-state="active"]').text()).toBe('Lista de serviços');
    wrapper.unmount();
  });

  it('respects a given model value', async () => {
    const wrapper = await mountSuspended(BaseTabs, {
      props: { tabs, label: 'Abas', modelValue: 'servicos' },
      slots: { servicos: () => 'Serviços aqui' },
    });
    expect(wrapper.get('[role="tabpanel"][data-state="active"]').text()).toBe('Serviços aqui');
  });
});

describe('BaseMenu', () => {
  it('opens from the trigger and runs actions; disabled and link items render', async () => {
    const onEdit = vi.fn();
    const wrapper = await mountSuspended(BaseMenu, {
      props: {
        heading: 'Produto',
        items: [
          { label: 'Editar', icon: Pencil, onSelect: onEdit },
          { label: 'Ver no site', to: '/produtos', icon: Pencil },
          { label: 'Baixar', disabled: true },
          { label: 'Excluir', danger: true, separated: true },
        ],
      },
      slots: { trigger: () => h('button', { type: 'button' }, 'Ações') },
      attachTo: document.body,
    });
    const trigger = wrapper.get('button');
    await trigger.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.textContent).toContain('Produto');
    expect(menu.querySelector('a')!.getAttribute('href')).toBe('/produtos');
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    const items = [...menu.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
    expect(items.find((i) => i.textContent?.includes('Baixar'))!.hasAttribute('data-disabled')).toBe(true);
    items.find((i) => i.textContent?.includes('Excluir'))!.click();
    await flushPromises();
    await trigger.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    const edit = [...document.querySelectorAll('[role="menuitem"]')].find((i) =>
      i.textContent?.includes('Editar'),
    );
    (edit as HTMLElement).click();
    await flushPromises();
    expect(onEdit).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('renders a custom heading slot', async () => {
    const wrapper = await mountSuspended(BaseMenu, {
      props: { items: [{ label: 'Um' }] },
      slots: { trigger: () => h('button', { type: 'button' }, 'Abrir'), heading: () => h('strong', 'Conta') },
      attachTo: document.body,
    });
    await wrapper.get('button').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(document.querySelector('[role="menu"] strong')!.textContent).toBe('Conta');
    wrapper.unmount();
  });

  it('works without a heading and with plain link items', async () => {
    const wrapper = await mountSuspended(BaseMenu, {
      props: { items: [{ label: 'Abrir pedido', to: '/pedidos' }] },
      slots: { trigger: () => h('button', { type: 'button' }, 'Mais') },
      attachTo: document.body,
    });
    await wrapper.get('button').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.querySelector('[role="group"], [id*="label"]')).toBeNull();
    expect(menu.querySelector('a')!.querySelector('svg')).toBeNull();
    wrapper.unmount();
  });
});
