import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import CounterPage from '~/pages/balcao.vue';
import OrderPage from '~/pages/pedidos/[id].vue';
import OrdersPage from '~/pages/pedidos/index.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, click, fill, mockApi, problem, session } from '../support/api';
import { order, orderListItem, product } from '../support/shop';
import {
  ADMIN_USER,
  EMPLOYEE_USER,
  isDisabled,
  openTab,
  paged,
  press,
  settle,
  text,
  wait,
} from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const COUNTS = { PENDING_REVIEW: 3, READY_FOR_PICKUP: 1, PICKED_UP: 9, CANCELED: 0 };

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('order queue', () => {
  it('shows counts per status, switches tabs and searches', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on(
      'GET /api/v1/orders',
      paged([orderListItem(), orderListItem({ id: 32, number: '2026-000032', channel: 'COUNTER' })], 30, {
        counts: COUNTS,
      }),
      paged([orderListItem({ id: 50, number: '2026-000050' })], 30, { counts: COUNTS }),
      paged([], 0, { counts: COUNTS }),
      paged([], 0, { counts: COUNTS }),
      problem(500, 'Erro.'),
      paged([orderListItem()], 1, { counts: COUNTS }),
    );
    const page = await mountSuspended(OrdersPage, {
      route: '/pedidos?estado=READY_FOR_PICKUP',
      attachTo: document.body,
    });
    await settle();
    const calls = () => api.called('GET /api/v1/orders');
    expect(calls()[0]!.url.searchParams.get('status')).toBe('READY_FOR_PICKUP');
    expect(text()).toContain('Pedido 2026-000032');
    expect(text()).toContain('Balcão');
    expect(text()).toContain('R$ 998,00');
    expect(page.find('a[href="/pedidos/31"]').exists()).toBe(true);
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) =>
      tab.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(tabs).toEqual(['Em análise 3', 'Aguardando retirada 1', 'Retirado 9', 'Cancelado 0']);

    press('Próxima página');
    await settle();
    expect(calls()[1]!.url.searchParams.get('page')).toBe('2');
    openTab('Cancelado');
    await settle();
    expect(calls()[2]!.url.searchParams.get('status')).toBe('CANCELED');
    expect(useRouter().currentRoute.value.query.estado).toBe('CANCELED');
    expect(text()).toContain('Nenhum pedido cancelado');

    await fill('Buscar pedidos', '2026-000099');
    await wait(350);
    await settle();
    expect(calls()[3]!.url.searchParams.get('q')).toBe('2026-000099');
    expect(text()).toContain('Nada encontrado para “2026-000099”');

    await fill('Buscar pedidos', '');
    await wait(350);
    await settle();
    expect(text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Pedido 2026-000031');
    page.unmount();
  });

  it('starts on the orders waiting for review', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on('GET /api/v1/orders', paged([], 0, { counts: COUNTS }));
    const page = await mountSuspended(OrdersPage, { route: '/pedidos', attachTo: document.body });
    await settle();
    expect(api.called('GET /api/v1/orders')[0]!.url.searchParams.get('status')).toBe('PENDING_REVIEW');
    expect(text()).toContain('Nenhum pedido esperando separação');
    page.unmount();
  });
});

describe('order detail', () => {
  const mountOrder = () => mountSuspended(OrderPage, { route: '/pedidos/31', attachTo: document.body });

  it('shows not found and server errors', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on('GET /api/v1/orders/31', problem(404, 'Não existe.'), problem(500, 'Erro.'));
    const page = await mountOrder();
    await settle();
    expect(text()).toContain('não achamos');
    page.unmount();
    const again = await mountOrder();
    await settle();
    expect(text()).toContain('Algo esquentou por aqui');
    again.unmount();
  });

  it('moves the order to ready and picked up', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const ready = order({ status: 'READY_FOR_PICKUP', statusLabel: 'Aguardando retirada' });
    mockApi()
      .on('GET /api/v1/orders/31', { body: order() })
      .on('POST /api/v1/orders/31/ready-for-pickup', problem(409, 'O pedido mudou.'), { body: ready })
      .on('POST /api/v1/orders/31/pickup', {
        body: order({ status: 'PICKED_UP', statusLabel: 'Retirado', canCancel: false }),
      });
    const page = await mountOrder();
    await settle();
    expect(text()).toContain('Pedido 2026-000031');
    expect(text()).toContain('Retiro na sexta.');
    expect(text()).toContain('Carla Cliente');
    expect(text()).not.toContain('Venda no balcão');

    click('Pronto para retirada');
    await settle();
    expect(toastTitles()).toContain('O pedido mudou.');
    click('Pronto para retirada');
    await settle();
    expect(toastTitles()).toContain('Pedido pronto para retirada.');
    click('Marcar como retirado');
    await settle();
    expect(toastTitles()).toContain('Pedido retirado.');
    expect(document.querySelector('[data-status="PICKED_UP"]')).not.toBeNull();
    expect(text()).not.toContain('Cancelar');
    page.unmount();
  });

  it('cancels with a reason after confirming', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/orders/31', {
        body: order({
          channel: 'COUNTER',
          notes: null,
          customer: { ...order().customer, phone: '19999998888' },
        }),
      })
      .on('POST /api/v1/orders/31/cancellation', problem(409, 'Já foi retirado.'), {
        body: order({ status: 'CANCELED', statusLabel: 'Cancelado', canCancel: false }),
      });
    const page = await mountOrder();
    await settle();
    expect(text()).toContain('Venda no balcão');
    expect(text()).toContain('(19) 99999-8888');

    click('Cancelar');
    await settle();
    press('Fechar');
    await settle();
    click('Cancelar');
    await settle();
    click('Voltar');
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click('Cancelar');
    await settle();
    click('Cancelar pedido');
    await settle();
    expect(api.called('POST /api/v1/orders/31/cancellation')[0]!.body).toEqual({});
    expect(toastTitles()).toContain('Já foi retirado.');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await fill('Motivo', ' Cliente desistiu. ');
    click('Cancelar pedido');
    await settle();
    expect(api.called('POST /api/v1/orders/31/cancellation')[1]!.body).toEqual({
      reason: 'Cliente desistiu.',
    });
    expect(toastTitles()).toContain('Pedido cancelado. Os itens voltaram para o estoque.');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    page.unmount();
  });

  it('opens the label PDF in a new tab', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:label') });
    const tab = { location: { href: '' }, close: vi.fn() };
    const open = vi.fn().mockReturnValueOnce(null).mockReturnValue(tab);
    vi.stubGlobal('open', open);
    mockApi()
      .on('GET /api/v1/orders/31', { body: order() })
      .on('GET /api/v1/orders/31/label', problem(500, 'Erro.'), { body: 'pdf' });
    const page = await mountOrder();
    await settle();

    click('Imprimir etiqueta');
    await settle();
    expect(toastTitles()[0]).toContain('O navegador bloqueou a nova aba');
    click('Imprimir etiqueta');
    await settle();
    expect(tab.close).toHaveBeenCalled();
    click('Imprimir etiqueta');
    await settle();
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.location.href).toBe('blob:label');
    page.unmount();
  });
});

describe('counter sale', () => {
  const stock = [
    product({ id: 14, name: 'Compressor Embraco', stockAvailable: 2, priceCents: 49900, cover: null }),
    product({ id: 15, slug: 'gas', name: 'Gás R134a', stockAvailable: 10, priceCents: 9000 }),
  ];
  const customer = {
    id: 4,
    role: 'CLIENT',
    name: 'Carla Cliente',
    email: 'cliente@castro.dev',
    phone: '19999998888',
    cpf: null,
    createdAt: '2026-10-03T15:00:00.000Z',
  };

  it('searches products, limits quantities, picks the customer and sells', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    const sale = order({ channel: 'COUNTER', status: 'PICKED_UP', number: '2026-000040', id: 40 });
    const api = mockApi()
      .on('GET /api/v1/products', problem(500, 'Erro.'), paged(stock), paged([]), paged(stock))
      .on(
        'GET /api/v1/users',
        problem(500, 'Erro.'),
        paged([]),
        paged([customer, { ...customer, id: 5, name: 'Caio', phone: null, email: 'caio@exemplo.com' }]),
      )
      .on(
        'POST /api/v1/counter-sales',
        new Error('offline'),
        problem(409, 'Sem estoque.', { code: 'insufficient-stock' }),
        problem(422, 'Confira os dados.'),
        { status: 201, body: sale },
      );
    const page = await mountSuspended(CounterPage, { attachTo: document.body });
    await settle();
    expect(text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await settle();
    const products = () => api.called('GET /api/v1/products');
    expect(products()[1]!.url.searchParams.get('available')).toBe('true');
    expect(products()[1]!.url.searchParams.get('sort')).toBe('name');
    expect(text()).toContain('Adicione pelo menos um produto.');

    press('Adicionar Compressor Embraco');
    await settle();
    press('Adicionar Compressor Embraco');
    await settle();
    expect(isDisabled('Adicionar Compressor Embraco')).toBe(true);
    press('Adicionar Gás R134a');
    await settle();
    expect(document.querySelector('[data-testid="counter-total"]')!.textContent).toContain('R$ 1.088,00');
    expect(text()).toContain('3 itens');
    press('Tirar Gás R134a da venda');
    await settle();
    expect(document.querySelector('[data-testid="counter-total"]')!.textContent).toContain('R$ 998,00');
    press('Diminuir quantidade');
    await settle();
    expect(document.querySelector('[data-testid="counter-total"]')!.textContent).toContain('R$ 499,00');
    press('Aumentar quantidade');
    await settle();
    expect(text()).toContain('Escolha o cliente da venda.');
    expect(text()).not.toContain('Cadastrar cliente');

    await fill('Buscar produto', 'xyz');
    await wait(350);
    await settle();
    expect(products()[2]!.url.searchParams.get('sort')).toBe('relevance');
    expect(text()).toContain('Nenhum produto com estoque para “xyz”');

    await fill('Cliente', 'car');
    await wait(350);
    await settle();
    expect(text()).toContain('Não conseguimos buscar agora');
    await fill('Cliente', 'carla');
    await wait(350);
    await settle();
    expect(text()).toContain('Nenhum cliente encontrado para “carla”. Peça para um gerente cadastrar.');
    await fill('Cliente', '');
    await wait(350);
    await settle();
    expect(api.called('GET /api/v1/users')).toHaveLength(2);
    await fill('Cliente', 'ca');
    await wait(350);
    await settle();
    expect(api.called('GET /api/v1/users')[2]!.url.searchParams.get('role')).toBe('CLIENT');
    expect(text()).toContain('caio@exemplo.com');
    click('Carla Cliente(19) 99999-8888');
    await settle();
    expect(document.querySelector('[data-testid="picked-customer"]')!.textContent).toBe('Carla Cliente');
    click('Trocar');
    await settle();
    await fill('Cliente', 'ca');
    await wait(350);
    await settle();
    click('Caiocaio@exemplo.com');
    await settle();
    expect(text()).toContain('caio@exemplo.com');
    click('Trocar');
    await settle();
    await fill('Cliente', 'ca');
    await wait(350);
    await settle();
    click('Carla Cliente(19) 99999-8888');
    await settle();

    await fill('Observação (opcional)', ' Pago no Pix. ');
    click('Confirmar venda');
    await settle();
    expect(toastTitles()).toContain(
      'Não conseguimos falar com a loja agora. Confira sua conexão e tente de novo.',
    );
    click('Confirmar venda');
    await settle();
    const sales = api.called('POST /api/v1/counter-sales');
    // No answer keeps the key, so a retry cannot sell twice; an answer ends the attempt.
    expect(sales[1]!.body).toEqual({
      customerId: 4,
      items: [{ productId: 14, quantity: 2 }],
      notes: 'Pago no Pix.',
    });
    expect(toastTitles()).toContain('Algum produto não tem a quantidade pedida. Confira o estoque e ajuste.');
    expect(products()).toHaveLength(4);
    click('Confirmar venda');
    await settle();
    expect(toastTitles()).toContain('Confira os dados.');
    click('Confirmar venda');
    await settle();
    expect(document.querySelector('[data-testid="sale-number"]')!.textContent).toBe('2026-000040');
    expect(text()).toContain('Venda registrada!');
    expect(text()).not.toContain('Ver pedido');

    click('Nova venda');
    await wait(350);
    await settle();
    expect(text()).toContain('Adicione pelo menos um produto.');
    expect(products().length).toBeGreaterThan(4);
    page.unmount();
  });

  it('lets a manager register the customer and open the sale', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on('GET /api/v1/products', paged(stock))
      .on('POST /api/v1/counter-sales', {
        status: 201,
        body: order({ channel: 'COUNTER', status: 'PICKED_UP', id: 41 }),
      });
    const page = await mountSuspended(CounterPage, { attachTo: document.body });
    await settle();
    click('Cadastrar cliente');
    await settle();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    press('Fechar');
    await settle();
    page
      .findComponent({ name: 'UsersCreateDialog' })
      .vm.$emit('created', { ...customer, id: 9, name: 'Nova Cliente', phone: null });
    await settle();
    expect(document.querySelector('[data-testid="picked-customer"]')!.textContent).toBe('Nova Cliente');
    press('Adicionar Gás R134a');
    await settle();
    click('Confirmar venda');
    await settle();
    expect(api.called('POST /api/v1/counter-sales')[0]!.body).toEqual({
      customerId: 9,
      items: [{ productId: 15, quantity: 1 }],
    });
    expect(page.find('a[href="/pedidos/41"]').exists()).toBe(true);

    click('Nova venda');
    await wait(350);
    await settle();
    expect(api.called('GET /api/v1/products').at(-1)!.url.searchParams.has('q')).toBe(false);
    page.unmount();
  });
});
