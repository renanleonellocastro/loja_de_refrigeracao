import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '~/pages/painel.vue';
import TodayPage from '~/pages/hoje.vue';
import { useAuthStore } from '~/stores/auth';
import { saveDay } from '~/utils/offline-day';
import { MANAGER_USER, mockApi, problem, session } from '../support/api';
import { appointment } from '../support/agenda';
import { managementDashboard } from '../support/home';
import { EMPLOYEE_USER, settle, text } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const DASHBOARD = 'GET /api/v1/dashboard';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
});

afterEach(async () => {
  useAuthStore().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('staff dashboard', () => {
  it('shows the indicators linking to the filtered lists, the agenda and the low stock, refreshing on its own', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const intervals: Array<() => void> = [];
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: () => void) => {
      intervals.push(fn);
      return 1;
    }) as unknown as typeof setInterval);
    const api = mockApi().on(DASHBOARD, { body: managementDashboard() }, problem(500, 'Erro.'), {
      body: managementDashboard({ quotesAwaitingAnswer: 9 }),
    });
    const page = await mountSuspended(DashboardPage, { route: '/painel' });
    await settle();

    const kpis = page.findAll('[data-testid="kpi"]');
    expect(kpis.map((kpi) => kpi.attributes('href'))).toEqual([
      '/pedidos?estado=PENDING_REVIEW',
      '/pedidos?estado=READY_FOR_PICKUP',
      '/solicitacoes?estado=REQUESTED',
      '/solicitacoes?estado=AWAITING_CUSTOMER',
      '/orcamentos?estado=REQUESTED',
      '/aprovacoes',
    ]);
    expect(kpis[4]!.text()).toContain('4');
    expect(page.get('[data-testid="revenue"]').text()).toContain('R$ 1.234,56');
    expect(page.findAll('[data-testid="agenda-group"]')).toHaveLength(1);
    expect(page.text()).toContain('2 visitas');
    expect(page.find('a[href="/agenda/10"]').exists()).toBe(true);
    expect(page.find('a[href="/produtos/gerenciar/7"]').text()).toContain('0 de 2');
    expect(page.text()).toContain('E mais 1 produtos.');

    // A failed refresh keeps the last numbers on screen; the next one updates them.
    intervals[0]!();
    await settle();
    expect(page.findAll('[data-testid="kpi"]')[4]!.text()).toContain('4');
    intervals[0]!();
    await settle();
    expect(page.findAll('[data-testid="kpi"]')[4]!.text()).toContain('9');
    expect(api.called(DASHBOARD)).toHaveLength(3);
    page.unmount();
  });

  it('shows empty states, one visit and a failure with retry', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const one = managementDashboard({ lowStock: { total: 0, items: [] } });
    one.management!.agendaToday[0]!.appointments = [appointment()];
    mockApi().on(
      DASHBOARD,
      problem(500, 'Erro.'),
      { body: managementDashboard({ agendaToday: [], lowStock: { total: 0, items: [] } }) },
      { body: one },
    );
    const page = await mountSuspended(DashboardPage, { route: '/painel' });
    await settle();
    expect(page.text()).toContain('Tentar de novo');
    await page
      .findAll('button')
      .find((button) => button.text() === 'Tentar de novo')!
      .trigger('click');
    await settle();
    expect(page.text()).toContain('Nenhuma visita marcada para hoje.');
    expect(page.text()).toContain('nenhum produto abaixo do mínimo');
    page.unmount();

    const single = await mountSuspended(DashboardPage, { route: '/painel' });
    await settle();
    expect(single.text()).toContain('1 visita');
    single.unmount();
  });

  it('sends technicians to their day', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    const api = mockApi();
    const page = await mountSuspended(DashboardPage, { route: '/painel' });
    await settle();
    expect(navigateMock).toHaveBeenCalledWith('/hoje', { replace: true });
    expect(api.called(DASHBOARD)).toHaveLength(0);
    page.unmount();
  });
});

describe('today offline', () => {
  it('shows the copy saved on this phone when the store cannot answer', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    mockApi().on('GET /api/v1/appointments', new Error('offline'));
    const nothingSaved = await mountSuspended(TodayPage, { route: '/hoje' });
    await settle();
    expect(nothingSaved.text()).toContain('Tentar de novo');
    expect(nothingSaved.text()).not.toContain('Sem conexão com a loja');
    nothingSaved.unmount();

    saveDay({
      userId: EMPLOYEE_USER.id,
      day: '2026-10-05',
      savedAt: '2026-10-05T11:00:00.000Z',
      visits: [appointment()],
    });
    mockApi().on('GET /api/v1/appointments', new Error('offline'), {
      body: [appointment(), appointment({ id: 10 })],
    });
    const page = await mountSuspended(TodayPage, { route: '/hoje', attachTo: document.body });
    await settle();
    expect(text()).toContain('Sem conexão com a loja');
    expect(text()).toContain('05/10/2026, 08:00');
    expect(page.findAll('[data-testid="today-visit"]')).toHaveLength(1);
    await page
      .findAll('button')
      .find((button) => button.text() === 'Tentar de novo')!
      .trigger('click');
    await settle();
    expect(text()).not.toContain('Sem conexão com a loja');
    expect(page.findAll('[data-testid="today-visit"]')).toHaveLength(2);
    page.unmount();
  });
});
