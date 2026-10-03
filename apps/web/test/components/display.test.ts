import { mountSuspended } from '@nuxt/test-utils/runtime';
import { PackageCheck } from 'lucide-vue-next';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import BaseAvatar from '~/components/base/Avatar.vue';
import BaseCard from '~/components/base/Card.vue';
import BaseDescriptionList from '~/components/base/DescriptionList.vue';
import BaseEmptyState from '~/components/base/EmptyState.vue';
import BaseResponsiveTable from '~/components/base/ResponsiveTable.vue';
import BaseSkeleton from '~/components/base/Skeleton.vue';
import BaseStatusBadge from '~/components/base/StatusBadge.vue';
import BaseTimeline from '~/components/base/Timeline.vue';
import { ORDER_STATUSES, QUOTE_STATUSES, SERVICE_REQUEST_STATUSES } from '~/utils/status';

describe('BaseCard', () => {
  it('renders header, actions and footer', async () => {
    const wrapper = await mountSuspended(BaseCard, {
      props: {
        title: 'Pedido',
        description: 'Feito hoje',
        headingLevel: 3,
        padding: 'lg',
        interactive: true,
      },
      slots: { default: () => 'Corpo', actions: () => h('button', 'Ação'), footer: () => 'Rodapé' },
    });
    expect(wrapper.get('h3').text()).toBe('Pedido');
    expect(wrapper.text()).toContain('Feito hoje');
    expect(wrapper.get('footer').text()).toBe('Rodapé');
    expect(wrapper.classes().join(' ')).toContain('hover:shadow-md');
  });

  it('renders only the body without a title', async () => {
    const wrapper = await mountSuspended(BaseCard, {
      props: { padding: 'none' },
      slots: { default: () => 'Só corpo' },
    });
    expect(wrapper.find('header').exists()).toBe(false);
    expect(wrapper.find('footer').exists()).toBe(false);
    const actionsOnly = await mountSuspended(BaseCard, { slots: { actions: () => 'A' } });
    expect(actionsOnly.find('header h2').exists()).toBe(false);
  });
});

describe('BaseStatusBadge', () => {
  it('has a label for every status of every kind', async () => {
    const groups = [
      ['order', ORDER_STATUSES],
      ['serviceRequest', SERVICE_REQUEST_STATUSES],
      ['quote', QUOTE_STATUSES],
    ] as const;
    for (const [kind, statuses] of groups) {
      for (const status of statuses) {
        const wrapper = await mountSuspended(BaseStatusBadge, { props: { kind, status, size: 'sm' } });
        expect(wrapper.attributes('data-status')).toBe(status);
        expect(wrapper.text()).not.toBe('');
        expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true');
      }
    }
    const order = await mountSuspended(BaseStatusBadge, { props: { kind: 'order', status: 'CANCELED' } });
    expect(order.text()).toBe('Cancelado');
  });
});

describe('BaseAvatar', () => {
  it('shows initials with the full name for screen readers', async () => {
    const wrapper = await mountSuspended(BaseAvatar, { props: { name: 'Eduardo Castro', size: 'lg' } });
    expect(wrapper.text()).toContain('EC');
    expect(wrapper.get('.sr-only').text()).toBe('Eduardo Castro');
  });

  it('shows a photo and falls back to initials when it fails', async () => {
    const wrapper = await mountSuspended(BaseAvatar, { props: { name: 'Ana', src: '/ana.jpg', size: 'sm' } });
    const img = wrapper.get('img');
    expect(img.attributes('alt')).toBe('Ana');
    await img.trigger('error');
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toContain('A');
  });
});

describe('BaseTimeline', () => {
  it('highlights the latest event and draws connectors between events', async () => {
    const wrapper = await mountSuspended(BaseTimeline, {
      props: {
        events: [
          {
            id: 2,
            title: 'Pronto',
            when: 'hoje',
            datetime: '2026-10-03',
            description: 'Separado',
            icon: PackageCheck,
          },
          { id: 1, title: 'Criado', when: 'ontem' },
        ],
      },
    });
    expect(wrapper.attributes('aria-label')).toBe('Histórico');
    const items = wrapper.findAll('li');
    expect(items).toHaveLength(2);
    expect(items[0]!.get('time').attributes('datetime')).toBe('2026-10-03');
    expect(items[0]!.text()).toContain('Separado');
    expect(items[0]!.find('.w-0\\.5').exists()).toBe(true);
    expect(items[1]!.find('.w-0\\.5').exists()).toBe(false);
  });

  it('accepts a custom label', async () => {
    const wrapper = await mountSuspended(BaseTimeline, {
      props: { events: [], label: 'Histórico do pedido' },
    });
    expect(wrapper.attributes('aria-label')).toBe('Histórico do pedido');
  });
});

describe('BaseDescriptionList', () => {
  it('renders terms with default and slotted details in one or two columns', async () => {
    const items = [
      { term: 'Cliente', detail: 'Maria' },
      { term: 'Estado', detail: 'X' },
    ];
    const wrapper = await mountSuspended(BaseDescriptionList, {
      props: { items },
      slots: { 'detail-1': () => h('strong', 'Em análise') },
    });
    expect(wrapper.findAll('dt').map((dt) => dt.text())).toEqual(['Cliente', 'Estado']);
    expect(wrapper.get('strong').text()).toBe('Em análise');
    const two = await mountSuspended(BaseDescriptionList, { props: { items, columns: 2 } });
    expect(two.classes()).toContain('sm:grid-cols-2');
  });
});

describe('BaseEmptyState', () => {
  it('shows the default illustration, text and action', async () => {
    const wrapper = await mountSuspended(BaseEmptyState, {
      props: { title: 'Nada ainda', text: 'Volte depois.', headingLevel: 3 },
      slots: { action: () => h('button', 'Ver produtos') },
    });
    expect(wrapper.get('h3').text()).toBe('Nada ainda');
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.get('button').text()).toBe('Ver produtos');
  });

  it('accepts a custom illustration and no text', async () => {
    const wrapper = await mountSuspended(BaseEmptyState, {
      props: { title: 'Vazio' },
      slots: { illustration: () => h('img', { alt: '' }) },
    });
    expect(wrapper.find('img').exists()).toBe(true);
    expect(wrapper.find('p').exists()).toBe(false);
  });
});

describe('BaseSkeleton', () => {
  it('is hidden from assistive technology', async () => {
    const wrapper = await mountSuspended(BaseSkeleton);
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });
});

describe('BaseResponsiveTable', () => {
  const columns = [
    { key: 'number', label: 'Pedido' },
    { key: 'customer', label: 'Cliente', priority: 'low' as const },
    { key: 'total', label: 'Total', align: 'end' as const },
  ];
  const rows = [
    { number: 'RC-1', customer: 'Maria', total: 'R$ 10,00' },
    { number: 'RC-2', customer: null, total: undefined },
  ];

  it('renders a captioned table and stacked cards with the same data', async () => {
    const wrapper = await mountSuspended(BaseResponsiveTable, {
      props: { columns, rows, rowKey: 'number', caption: 'Pedidos' },
      slots: { 'cell-total': ({ value }: { value: unknown }) => h('b', String(value ?? '-')) },
    });
    expect(wrapper.get('caption').text()).toBe('Pedidos');
    expect(wrapper.findAll('th').map((th) => th.attributes('scope'))).toEqual(['col', 'col', 'col']);
    expect(wrapper.findAll('th')[1]!.classes()).toContain('lg:table-cell');
    expect(wrapper.findAll('th')[2]!.classes()).toContain('text-right');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    const cards = wrapper.get('ul[aria-label="Pedidos"]').findAll('li');
    expect(cards).toHaveLength(2);
    expect(cards[0]!.text()).toContain('RC-1');
    expect(cards[1]!.findAll('dd')[0]!.text()).toBe('');
    expect(wrapper.findAll('b').map((b) => b.text())).toContain('-');
  });

  it('shows skeleton rows while loading', async () => {
    const wrapper = await mountSuspended(BaseResponsiveTable, {
      props: { columns, rows, rowKey: 'number', caption: 'Pedidos', loading: true, skeletonRows: 2 },
    });
    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Carregando');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('shows the default or custom empty state', async () => {
    const wrapper = await mountSuspended(BaseResponsiveTable, {
      props: { columns, rows: [], rowKey: 'number', caption: 'Pedidos' },
    });
    expect(wrapper.text()).toContain('Nada por aqui ainda');
    const custom = await mountSuspended(BaseResponsiveTable, {
      props: { columns, rows: [], rowKey: 'number', caption: 'Pedidos' },
      slots: { empty: () => 'Nenhum pedido' },
    });
    expect(custom.text()).toBe('Nenhum pedido');
  });
});
