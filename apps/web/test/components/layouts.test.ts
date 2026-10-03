import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { h } from 'vue';
import AreaBottomNav from '~/components/layout/AreaBottomNav.vue';
import AreaSideNav from '~/components/layout/AreaSideNav.vue';
import AreaTopBar from '~/components/layout/AreaTopBar.vue';
import SiteDrawer from '~/components/layout/SiteDrawer.vue';
import SiteFooter from '~/components/layout/SiteFooter.vue';
import SiteHeader from '~/components/layout/SiteHeader.vue';
import UserMenu from '~/components/layout/UserMenu.vue';
import AreaLayout from '~/layouts/area.vue';
import DefaultLayout from '~/layouts/default.vue';
import { useCartCount } from '~/composables/useCartCount';
import { useCurrentActor } from '~/composables/useCurrentActor';
import { navigationFor } from '~/utils/navigation';

afterEach(() => {
  useCurrentActor().value = 'GUEST';
  useCartCount().value = 0;
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('default layout', () => {
  it('has skip link, header, main, footer and WhatsApp', async () => {
    const wrapper = await mountSuspended(DefaultLayout, { slots: { default: () => h('h1', 'Oi') } });
    expect(wrapper.get('a[href="#conteudo"]').text()).toBe('Pular para o conteúdo');
    expect(wrapper.get('main#conteudo').text()).toBe('Oi');
    expect(wrapper.get('nav[aria-label="Principal"]').findAll('a')).toHaveLength(5);
    expect(wrapper.get('footer').text()).toContain('Rua Doutor Ulhoa Cintra, 91');
    expect(wrapper.get('footer').text()).toContain('(19) 3804-1658');
    expect(wrapper.get('footer').text()).toContain('Segunda a sexta, das 9h às 18h');
    expect(wrapper.get('footer').text()).toContain('Desde 1990');
    expect(wrapper.find('a[href^="https://wa.me/"]').exists()).toBe(true);
  });
});

describe('SiteHeader', () => {
  it('labels the cart by item count', async () => {
    const wrapper = await mountSuspended(SiteHeader);
    expect(wrapper.get('a[href="/carrinho"]').attributes('aria-label')).toBe('Carrinho vazio');
    useCartCount().value = 1;
    await flushPromises();
    expect(wrapper.get('a[href="/carrinho"]').attributes('aria-label')).toBe('Carrinho com 1 item');
    useCartCount().value = 120;
    await flushPromises();
    expect(wrapper.get('a[href="/carrinho"]').attributes('aria-label')).toBe('Carrinho com 120 itens');
    expect(wrapper.get('a[href="/carrinho"]').text()).toBe('99+');
    useCartCount().value = 3;
    await flushPromises();
    expect(wrapper.get('a[href="/carrinho"]').text()).toBe('3');
  });

  it('opens the drawer from the menu button', async () => {
    const wrapper = await mountSuspended(SiteHeader, { attachTo: document.body });
    const button = wrapper.get('button[aria-label="Abrir menu"]');
    expect(button.attributes('aria-expanded')).toBe('false');
    await button.trigger('click');
    await flushPromises();
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Criar conta');
    (document.querySelector('[aria-label="Fechar menu"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(button.attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });
});

describe('SiteDrawer', () => {
  it('lists the public pages and closes on navigation and with the close button', async () => {
    const wrapper = await mountSuspended(SiteDrawer, {
      props: { open: true, 'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }) },
      attachTo: document.body,
    });
    await flushPromises();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelectorAll('nav a')).toHaveLength(7);
    expect(dialog.querySelector('a[href^="tel:"]')!.textContent).toBe('(19) 3804-1658');
    await useRouter().push('/design');
    await flushPromises();
    expect(wrapper.props('open')).toBe(false);
    await wrapper.setProps({ open: true });
    await flushPromises();
    (document.querySelector('[aria-label="Fechar menu"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(wrapper.props('open')).toBe(false);
    wrapper.unmount();
    await useRouter().push('/');
  });
});

describe('SiteFooter', () => {
  it('links to the map in a new tab and lists the site', async () => {
    const wrapper = await mountSuspended(SiteFooter);
    const map = wrapper.get('a[href^="https://www.google.com/maps"]');
    expect(map.attributes('target')).toBe('_blank');
    expect(wrapper.get('nav[aria-label="Rodapé"]').findAll('a').length).toBeGreaterThan(4);
    expect(wrapper.get('a[href^="mailto:"]').text()).toContain('refrigeracaocastro@yahoo.com.br');
  });
});

describe('area layout', () => {
  it('builds the menus for the current actor and titles from the route', async () => {
    useCurrentActor().value = 'MANAGER';
    const wrapper = await mountSuspended(AreaLayout, {
      slots: { default: () => 'Conteúdo' },
      route: '/design/area',
    });
    expect(wrapper.get('h1').text()).toBe('Prévia da área');
    expect(wrapper.get('[data-testid="side-nav"]').text()).toContain('Aprovações');
    expect(wrapper.get('[data-testid="bottom-nav"]').findAll('a')).toHaveLength(4);
    expect(wrapper.get('main#conteudo').text()).toBe('Conteúdo');
  });

  it('uses the menu label or the store name as title', async () => {
    useCurrentActor().value = 'CLIENT';
    const known = await mountSuspended(AreaLayout, { route: '/produtos' });
    expect(known.get('h1').text()).toBe('Produtos');
    const unknown = await mountSuspended(AreaLayout, { route: '/sem-titulo' });
    expect(unknown.get('h1').text()).toBe('Refrigeração Castro');
  });
});

describe('AreaSideNav', () => {
  it('groups items with headings for the sidebar', async () => {
    const wrapper = await mountSuspended(AreaSideNav, { props: { navigation: navigationFor('ADMIN') } });
    expect(wrapper.text()).toContain('Administração');
    expect(wrapper.findAll('nav a')).toHaveLength(navigationFor('ADMIN').items.length);
  });
});

describe('AreaBottomNav', () => {
  it('shows four items and "Mais" with the rest and the theme', async () => {
    const wrapper = await mountSuspended(AreaBottomNav, {
      props: { navigation: navigationFor('MANAGER') },
      attachTo: document.body,
    });
    const more = wrapper.get('button[aria-haspopup="dialog"]');
    expect(more.text()).toBe('Mais');
    await more.trigger('click');
    await flushPromises();
    const sheet = document.querySelector('[role="dialog"]')!;
    expect(sheet.textContent).toContain('Mais opções');
    expect(sheet.textContent).toContain('Solicitações');
    expect(sheet.querySelector('fieldset')).not.toBeNull();
    (document.querySelector('[aria-label="Fechar"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(more.attributes('aria-expanded')).toBe('false');
    await more.trigger('click');
    await flushPromises();
    await useRouter().push('/design');
    await flushPromises();
    expect(more.attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
    await useRouter().push('/');
  });

  it('has no "Mais" when everything fits', async () => {
    const nav = navigationFor('MANAGER');
    const wrapper = await mountSuspended(AreaBottomNav, {
      props: { navigation: { ...nav, bottom: nav.bottom.slice(0, 2), more: [] } },
    });
    expect(wrapper.find('button').exists()).toBe(false);
  });
});

describe('AreaTopBar and UserMenu', () => {
  it('shows the title, the default bell and the account menu', async () => {
    const wrapper = await mountSuspended(AreaTopBar, { props: { title: 'Pedidos' } });
    expect(wrapper.get('h1').text()).toBe('Pedidos');
    expect(wrapper.get('a[aria-label="Notificações"]').attributes('href')).toBe('/notificacoes');
    const custom = await mountSuspended(AreaTopBar, {
      props: { title: 'X' },
      slots: { notifications: () => h('span', { id: 'sino' }) },
    });
    expect(custom.find('#sino').exists()).toBe(true);
  });

  it('switches the theme from the account menu', async () => {
    useCurrentActor().value = 'EMPLOYEE';
    const wrapper = await mountSuspended(UserMenu, { attachTo: document.body });
    const trigger = wrapper.get('button[aria-label="Menu da conta"]');
    expect(trigger.text()).toContain('Colaborador');
    await trigger.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.querySelector('a[href="/perfil"]')).not.toBeNull();
    const sair = [...menu.querySelectorAll('[role="menuitem"]')].find((i) => i.textContent?.includes('Sair'));
    expect(sair!.hasAttribute('data-disabled')).toBe(true);
    const dark = [...menu.querySelectorAll('[role="menuitemradio"]')].find((i) =>
      i.textContent?.includes('Escuro'),
    );
    (dark as HTMLElement).click();
    await flushPromises();
    expect(document.documentElement.dataset.theme).toBe('dark');
    wrapper.unmount();
  });
});
