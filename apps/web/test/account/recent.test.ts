import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileRecentOrders from '~/components/profile/RecentOrders.vue';
import ProfileRecentQuotes from '~/components/profile/RecentQuotes.vue';
import ProfileRecentServiceRequests from '~/components/profile/RecentServiceRequests.vue';
import { mockApi } from '../support/api';
import { quoteListItem } from '../support/quotes';
import { requestListItem } from '../support/services';
import { orderList, orderListItem } from '../support/shop';

afterEach(() => {
  vi.unstubAllGlobals();
});

const page = <T>(data: T[]) => ({ data, meta: { page: 1, pageSize: 3, total: data.length } });

describe('ProfileRecentOrders', () => {
  it('asks for the first three orders and links each one and the full list', async () => {
    const api = mockApi().on('GET /api/v1/orders', { body: orderList([orderListItem()]) });
    const wrapper = await mountSuspended(ProfileRecentOrders);
    expect(wrapper.find('[role="status"]').text()).toBe('Carregando últimos pedidos…');
    await flushPromises();
    expect(api.called('GET /api/v1/orders')[0]!.url.searchParams.get('pageSize')).toBe('3');
    expect(wrapper.text()).toContain('Pedido 2026-000031');
    expect(wrapper.find('a[href="/minha-conta/pedidos"]').text()).toBe('Ver todos');
    expect(wrapper.find('a[href="/minha-conta/pedidos/31"]').exists()).toBe(true);
  });

  it('invites to shop when there are no orders and hides when offline', async () => {
    mockApi().on('GET /api/v1/orders', { body: orderList([]) });
    const empty = await mountSuspended(ProfileRecentOrders);
    await flushPromises();
    expect(empty.text()).toContain('Nenhum pedido ainda.');
    expect(empty.find('a[href="/produtos"]').text()).toBe('Ver produtos');
    expect(empty.text()).not.toContain('Ver todos');
    mockApi().on('GET /api/v1/orders', new TypeError('offline'));
    const offline = await mountSuspended(ProfileRecentOrders);
    await flushPromises();
    expect(offline.text()).toBe('');
  });
});

describe('ProfileRecentServiceRequests', () => {
  it('shows the scheduled visit or the request day of each service', async () => {
    const api = mockApi().on('GET /api/v1/service-requests', {
      body: page([
        requestListItem(),
        requestListItem({ id: 42, status: 'SCHEDULED', scheduledFor: '2026-10-07T11:00:00.000Z' }),
      ]),
    });
    const wrapper = await mountSuspended(ProfileRecentServiceRequests);
    await flushPromises();
    expect(api.called('GET /api/v1/service-requests')[0]!.url.searchParams.get('pageSize')).toBe('3');
    expect(wrapper.text()).toContain('Últimos serviços');
    expect(wrapper.text()).toContain('Geladeira duplex · Pedido em 4 de outubro de 2026');
    expect(wrapper.text()).toMatch(/Geladeira duplex · Visita em 07\/10\/2026/);
    expect(wrapper.find('a[href="/minha-conta/agendamentos/42"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/minha-conta/agendamentos"]').text()).toBe('Ver todos');
  });

  it('invites to schedule a visit when there are none', async () => {
    mockApi().on('GET /api/v1/service-requests', { body: page([]) });
    const wrapper = await mountSuspended(ProfileRecentServiceRequests);
    await flushPromises();
    expect(wrapper.text()).toContain('Nenhum serviço agendado ainda.');
    expect(wrapper.find('a[href="/agendar"]').text()).toBe('Agendar visita');
  });
});

describe('ProfileRecentQuotes', () => {
  it('shows the amount once the store answers', async () => {
    const api = mockApi().on('GET /api/v1/quotes', {
      body: page([
        quoteListItem(),
        quoteListItem({ id: 32, status: 'ANSWERED', amountCents: 35000, validUntil: '2026-10-20' }),
      ]),
    });
    const wrapper = await mountSuspended(ProfileRecentQuotes);
    await flushPromises();
    expect(api.called('GET /api/v1/quotes')[0]!.url.searchParams.get('pageSize')).toBe('3');
    const rows = wrapper.findAll('li').map((row) => row.text());
    expect(rows[0]).toContain('4 de outubro de 2026');
    expect(rows[0]).not.toContain('R$');
    expect(rows[1]).toContain('4 de outubro de 2026 · R$ 350,00');
    expect(wrapper.find('a[href="/minha-conta/orcamentos/32"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/minha-conta/orcamentos"]').text()).toBe('Ver todos');
  });

  it('invites to ask for a quote when there are none', async () => {
    mockApi().on('GET /api/v1/quotes', { body: page([]) });
    const wrapper = await mountSuspended(ProfileRecentQuotes);
    await flushPromises();
    expect(wrapper.text()).toContain('Nenhum orçamento ainda.');
    expect(wrapper.find('a[href="/orcamento"]').text()).toBe('Pedir orçamento');
  });
});
