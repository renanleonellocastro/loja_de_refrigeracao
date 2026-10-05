import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfirm } from '~/composables/useConfirm';
import { useToast } from '~/composables/useToast';
import CustomerPage from '~/pages/clientes/[id].vue';
import CustomersPage from '~/pages/clientes/index.vue';
import EmployeePage from '~/pages/colaboradores/[id].vue';
import EmployeesPage from '~/pages/colaboradores/index.vue';
import ManagerPage from '~/pages/gerentes/[id].vue';
import ManagersPage from '~/pages/gerentes/index.vue';
import { useAuthStore } from '~/stores/auth';
import { emptyAddress } from '~/utils/address';
import { personFromUser } from '~/utils/staff';
import { MANAGER_USER, PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const ADMIN_USER = { id: 1, name: 'Eduardo Castro', email: 'admin@castro.dev', role: 'ADMIN' as const };
const EMPLOYEE_USER = {
  id: 3,
  name: 'Tiago Técnico',
  email: 'tecnico@castro.dev',
  role: 'EMPLOYEE' as const,
};

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const text = () => document.body.textContent ?? '';

const item = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  role: 'CLIENT',
  name: `Cliente ${id}`,
  email: `cliente${id}@exemplo.com`,
  phone: '19999998888',
  cpf: '52998224725',
  createdAt: '2026-10-03T15:00:00.000Z',
  ...extra,
});
const list = (rows: unknown[], total = rows.length) => ({
  body: { data: rows, meta: { page: 1, pageSize: 20, total } },
});

afterEach(() => {
  useAuthStore().clear();
  useToast().clear();
  useConfirm().settle(false);
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('customers list', () => {
  it('searches with debounce, paginates and shows the empty states', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on(
      'GET /api/v1/users',
      list([item(1), item(2, { phone: null, cpf: null })], 45),
      list([item(21)], 45),
      list([]),
      list([]),
      problem(500, 'Erro.'),
      list([item(1)]),
    );
    const page = await mountSuspended(CustomersPage, { attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Cliente 1');
    expect(page.text()).toContain('—');
    // Signing in also loads the cart, so only the calls of this list are checked.
    const users = () => api.called('GET /api/v1/users');
    expect(page.find('a[href="/clientes/1"]').exists()).toBe(true);
    expect(users()[0]!.url.searchParams.get('role')).toBe('CLIENT');

    (document.querySelector('button[aria-label="Próxima página"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(users()[1]!.url.searchParams.get('page')).toBe('2');

    await fill('Buscar clientes', 'zzz');
    await fill('Buscar clientes', 'zzzz');
    await wait(350);
    await flushPromises();
    expect(api.called('GET /api/v1/users')).toHaveLength(3);
    expect(users()[2]!.url.searchParams.get('q')).toBe('zzzz');
    expect(users()[2]!.url.searchParams.get('page')).toBe('1');
    expect(page.text()).toContain('Nada encontrado para “zzzz”');

    await fill('Buscar clientes', ' ');
    await wait(350);
    await flushPromises();
    expect(users()[3]!.url.searchParams.has('q')).toBe(false);
    expect(page.text()).toContain('Nenhum cliente por aqui ainda');

    await fill('Buscar clientes', 'x');
    await wait(350);
    await flushPromises();
    expect(page.text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await flushPromises();
    expect(page.text()).toContain('Cliente 1');
    page.unmount();
  });

  it('lets a technician read but not register customers', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    mockApi().on('GET /api/v1/users', list([]));
    const page = await mountSuspended(CustomersPage, { attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Nenhum cliente por aqui ainda');
    expect(page.text()).not.toContain('Cadastrar cliente');
    page.unmount();
  });

  it('registers a customer with the CEP lookup and sends the invitation', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on('GET /api/v1/users', list([]), list([item(9)]), list([item(9)]))
      .on('GET /api/v1/addresses/lookup', { body: { ...PROFILE.address } })
      .on('POST /api/v1/users', problem(409, 'Esse email já tem conta.'), {
        status: 201,
        body: { ...PROFILE, id: 9, name: 'Nova Cliente', email: 'nova@exemplo.com' },
      });
    const page = await mountSuspended(CustomersPage, { attachTo: document.body });
    await flushPromises();
    click('Cadastrar cliente', 1);
    await flushPromises();
    expect(text()).toContain('Enviamos um convite por email');
    submit('Cadastrar e enviar convite');
    await flushPromises();
    expect(text()).toContain('Informe o nome completo.');
    expect(text()).toContain('Digite o telefone com DDD');
    await fill('Nome completo', 'Nova Cliente');
    await fill('Email', 'nova@exemplo.com');
    await fill('Telefone', '19999997777');
    await fill('CEP', '13800061');
    await flushPromises();
    await fill('Número', '10');
    submit('Cadastrar e enviar convite');
    await flushPromises();
    expect(toastTitles()).toContain('Esse email já tem conta.');
    submit('Cadastrar e enviar convite');
    await flushPromises();
    expect(api.called('POST /api/v1/users').at(-1)!.body).toMatchObject({
      role: 'CLIENT',
      name: 'Nova Cliente',
      phone: '19999997777',
      cpf: null,
      address: { cep: '13800061', number: '10', city: 'Mogi Mirim', complement: null },
    });
    expect(toastTitles()).toContain('Pronto! Nova foi cadastrado.');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(page.text()).toContain('Cliente 9');

    // With a search on screen, registering clears it and the search reloads the list.
    await fill('Buscar clientes', 'abc');
    await wait(350);
    await flushPromises();
    click('Cadastrar cliente');
    await flushPromises();
    expect((document.querySelector('[role="dialog"] input') as HTMLInputElement).value).toBe('');
    page.findComponent({ name: 'UsersPersonFields' }).vm.$emit('update:modelValue', {
      name: '',
      email: '',
      phone: '',
      cpf: '',
      address: emptyAddress(),
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    page.findComponent({ name: 'UsersCreateDialog' }).vm.$emit('created', PROFILE);
    await wait(350);
    await flushPromises();
    expect(api.called('GET /api/v1/users').at(-1)!.url.searchParams.has('q')).toBe(false);
    page.unmount();
  });

  it('goes back to the first page after registering from another page', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on('GET /api/v1/users', list([item(1)], 45));
    const page = await mountSuspended(CustomersPage, { attachTo: document.body });
    await flushPromises();
    (document.querySelector('button[aria-label="Próxima página"]') as HTMLButtonElement).click();
    await flushPromises();
    page.findComponent({ name: 'UsersCreateDialog' }).vm.$emit('created', PROFILE);
    await flushPromises();
    expect(api.calls.at(-1)!.url.searchParams.get('page')).toBe('1');
    click('Cadastrar cliente');
    await flushPromises();
    click('Cancelar');
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    page.unmount();
  });
});

describe('team lists', () => {
  it('requires the CPF for employees and shows the super user among managers', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/users', list([]))
      .on('POST /api/v1/users', { status: 201, body: { ...PROFILE, role: 'EMPLOYEE', name: 'Tiago' } });
    const employees = await mountSuspended(EmployeesPage, { attachTo: document.body });
    await flushPromises();
    expect(employees.text()).toContain('Nenhum colaborador cadastrado');
    click('Cadastrar colaborador');
    await flushPromises();
    await fill('Nome completo', 'Tiago Técnico');
    await fill('Email', 'tiago@exemplo.com');
    submit('Cadastrar e enviar convite');
    await flushPromises();
    expect(text()).toContain('Informe o CPF.');
    await fill('CPF', '11111111111');
    submit('Cadastrar e enviar convite');
    await flushPromises();
    expect(text()).toContain('Esse CPF não existe.');
    await fill('CPF', '52998224725');
    submit('Cadastrar e enviar convite');
    await flushPromises();
    expect(api.called('POST /api/v1/users')[0]!.body).toMatchObject({
      role: 'EMPLOYEE',
      cpf: '52998224725',
      phone: null,
      address: null,
    });
    employees.unmount();

    mockApi().on('GET /api/v1/users', list([item(1, { role: 'ADMIN', name: 'Eduardo Castro' })]));
    const managers = await mountSuspended(ManagersPage, { attachTo: document.body });
    await flushPromises();
    expect(managers.text()).toContain('Super usuário');
    expect(managers.find('a[href="/gerentes/1"]').exists()).toBe(true);
    managers.unmount();
  });
});

describe('user details', () => {
  const NO_ACTIVITY = { recentOrders: [], recentServiceRequests: [], recentAppointments: [] };
  const detail = (extra: Record<string, unknown> = {}) => ({ ...PROFILE, ...NO_ACTIVITY, id: 7, ...extra });

  it('lists the recent orders and requests of a customer with links, or says there are none', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on('GET /api/v1/users/7', {
        body: detail({
          recentOrders: [
            {
              id: 12,
              number: 'RC-000012',
              status: 'READY_FOR_PICKUP',
              totalCents: 15990,
              createdAt: '2026-10-04T15:00:00.000Z',
            },
          ],
          recentServiceRequests: [
            {
              id: 5,
              status: 'SCHEDULED',
              serviceType: 'Conserto de geladeira',
              productKind: 'Geladeira',
              createdAt: '2026-10-02T15:00:00.000Z',
            },
          ],
        }),
      })
      .on('GET /api/v1/users/8', { body: detail({ id: 8 }) });
    const page = await mountSuspended(CustomerPage, { route: '/clientes/7', attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Pedido RC-000012');
    expect(page.text()).toContain('R$ 159,90');
    expect(page.find('a[href="/pedidos/12"]').exists()).toBe(true);
    expect(page.text()).toContain('Conserto de geladeira · Geladeira');
    expect(page.find('a[href="/solicitacoes/5"]').exists()).toBe(true);
    page.unmount();
    const empty = await mountSuspended(CustomerPage, { route: '/clientes/8', attachTo: document.body });
    await flushPromises();
    expect(empty.text()).toContain('Nenhum pedido ainda.');
    expect(empty.text()).toContain('Nenhuma solicitação ainda.');
    empty.unmount();
  });

  it('hides the customer history from a technician', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    mockApi().on('GET /api/v1/users/7', { body: detail() });
    const page = await mountSuspended(CustomerPage, { route: '/clientes/7', attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Carla Cliente');
    expect(page.text()).not.toContain('Últimos pedidos');
    expect(page.text()).not.toContain('Últimas solicitações');
    page.unmount();
  });

  it('lists the recent visits of an employee with links', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    mockApi()
      .on('GET /api/v1/users/7', {
        body: detail({
          role: 'EMPLOYEE',
          recentAppointments: [
            {
              id: 31,
              startsAt: '2026-10-06T11:00:00.000Z',
              endsAt: '2026-10-06T13:00:00.000Z',
              status: 'SCHEDULED',
              serviceType: 'Instalação de ar condicionado',
              customerName: 'Carla Cliente',
            },
          ],
        }),
      })
      .on('GET /api/v1/users/8', { body: detail({ id: 8, role: 'EMPLOYEE' }) });
    const page = await mountSuspended(EmployeePage, { route: '/colaboradores/7', attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Últimos atendimentos');
    expect(page.text()).toContain('Carla Cliente · Instalação de ar condicionado');
    expect(page.text()).toContain('08:00 às 10:00');
    expect(page.find('a[href="/agenda/31"]').exists()).toBe(true);
    page.unmount();
    const empty = await mountSuspended(EmployeePage, { route: '/colaboradores/8', attachTo: document.body });
    await flushPromises();
    expect(empty.text()).toContain('Nenhum atendimento ainda.');
    empty.unmount();
  });

  it('shows a customer to the manager without the super user actions', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on('GET /api/v1/users/7', { body: detail({ pendingInvitation: true, cpf: '52998224725' }) });
    const page = await mountSuspended(CustomerPage, { route: '/clientes/7', attachTo: document.body });
    expect(page.text()).toContain('Detalhes');
    await flushPromises();
    expect(page.text()).toContain('Carla Cliente');
    expect(page.text()).toContain('Convite pendente');
    expect(page.text()).toContain('529.982.247-25');
    expect(page.text()).toContain('(19) 99999-8888');
    expect(page.text()).not.toContain('Editar dados');
    expect(page.find('a[href="/clientes"]').exists()).toBe(true);
    page.unmount();
  });

  it('answers not found for unknown people and people of another role, and retries errors', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on('GET /api/v1/users/7', problem(404, 'Usuário não encontrado.'))
      .on('GET /api/v1/users/8', { body: detail({ id: 8, role: 'EMPLOYEE' }) })
      .on('GET /api/v1/users/0', problem(400, 'Inválido.'))
      .on('GET /api/v1/users/9', problem(500, 'Erro.'), { body: detail({ id: 9 }) });
    for (const id of [7, 8, 0]) {
      const page = await mountSuspended(CustomerPage, { route: `/clientes/${id}`, attachTo: document.body });
      await flushPromises();
      expect(page.text()).toContain('Procuramos em todas as prateleiras');
      page.unmount();
    }
    const page = await mountSuspended(CustomerPage, { route: '/clientes/9', attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await flushPromises();
    expect(page.text()).toContain('Carla Cliente');
    page.unmount();
  });

  it('lets the super user edit and delete an employee', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const employee = detail({ role: 'EMPLOYEE', cpf: '52998224725', phone: null, address: null });
    const api = mockApi()
      .on('GET /api/v1/users/7', { body: employee })
      .on('PATCH /api/v1/users/7', { body: { ...employee, name: 'Tiago Souza', emailVerified: false } })
      .on('DELETE /api/v1/users/7', problem(500, 'Erro.'), { status: 204 });
    const page = await mountSuspended(EmployeePage, { route: '/colaboradores/7', attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Email confirmado');
    expect(page.text()).toContain('Não informado');

    click('Editar dados');
    await flushPromises();
    await fill('Nome completo', 'Tiago Souza');
    submit('Salvar alterações');
    await flushPromises();
    expect(api.called('PATCH /api/v1/users/7')[0]!.body).toMatchObject({
      name: 'Tiago Souza',
      cpf: '52998224725',
    });
    expect(toastTitles()).toContain('Pronto! Os dados foram atualizados.');
    expect(page.text()).toContain('Tiago Souza');
    expect(page.text()).not.toContain('Email confirmado');
    click('Editar dados');
    await flushPromises();
    await fill('CPF', '');
    submit('Salvar alterações');
    await flushPromises();
    expect(text()).toContain('Informe o CPF.');
    page.findComponent({ name: 'UsersPersonFields' }).vm.$emit('update:modelValue', personFromUser(null));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();

    click('Excluir colaborador');
    await flushPromises();
    expect(useConfirm().current.value!.title).toBe('Excluir este colaborador?');
    useConfirm().settle(false);
    await flushPromises();
    expect(api.called('DELETE /api/v1/users/7')).toHaveLength(0);
    click('Excluir colaborador');
    await flushPromises();
    useConfirm().settle(true);
    await flushPromises();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    click('Excluir colaborador');
    await flushPromises();
    useConfirm().settle(true);
    await flushPromises();
    expect(toastTitles()).toContain('Tiago foi excluído.');
    expect(navigateMock).toHaveBeenCalledWith('/colaboradores');
    page.unmount();
  });

  it('never offers to delete the super user', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    mockApi().on('GET /api/v1/users/1', {
      body: detail({ id: 1, role: 'ADMIN', emailVerified: false, name: 'Eduardo Castro' }),
    });
    const page = await mountSuspended(ManagerPage, { route: '/gerentes/1', attachTo: document.body });
    await flushPromises();
    expect(page.text()).toContain('Editar dados');
    expect(page.text()).not.toContain('Excluir gerente');
    click('Editar dados');
    await flushPromises();
    click('Cancelar');
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    page.unmount();
  });
});
