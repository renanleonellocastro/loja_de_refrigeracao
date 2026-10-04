import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import RequestPage from '~/pages/solicitacoes/[id].vue';
import QueuePage from '~/pages/solicitacoes/index.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, click, fill, mockApi, problem, session } from '../support/api';
import { APPOINTMENT, message, requestListItem, serviceRequest } from '../support/services';
import { paged, press, settle, text, wait } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const DETAIL = 'GET /api/v1/service-requests/41';

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('request queue', () => {
  it('filters by status, searches and pages', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on(
      'GET /api/v1/service-requests',
      paged([requestListItem(), requestListItem({ id: 42, status: 'AWAITING_CUSTOMER' })], 30),
      paged([requestListItem({ id: 50 })], 30),
      paged([]),
      paged([]),
      paged([]),
      problem(500, 'Erro.'),
      paged([requestListItem()]),
    );
    const page = await mountSuspended(QueuePage, {
      route: '/solicitacoes?estado=AWAITING_CUSTOMER',
      attachTo: document.body,
    });
    await settle();
    const calls = () => api.called('GET /api/v1/service-requests');
    expect(calls()[0]!.url.searchParams.get('status')).toBe('AWAITING_CUSTOMER');
    expect(page.find('a[href="/solicitacoes/42"]').exists()).toBe(true);
    expect(text()).toContain('Em conversa');
    expect(text()).toContain('Carla Cliente');

    press('Próxima página');
    await settle();
    expect(calls()[1]!.url.searchParams.get('page')).toBe('2');

    await fill('Estado', 'TODOS');
    await settle();
    expect(calls()[2]!.url.searchParams.has('status')).toBe(false);
    expect(useRouter().currentRoute.value.query.estado).toBe('TODOS');
    expect(text()).toContain('Nenhuma solicitação');

    await fill('Estado', 'CANCELED');
    await settle();
    expect(text()).toContain('Nenhuma solicitação: cancelado');

    await fill('Buscar solicitações', 'Carla');
    await wait(350);
    await settle();
    expect(calls()[4]!.url.searchParams.get('q')).toBe('Carla');
    expect(text()).toContain('Nada encontrado para “Carla”');

    await fill('Buscar solicitações', 'Bia');
    await wait(350);
    await settle();
    expect(text()).toContain('Tentar de novo');
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Solicitação 41');
    page.unmount();
  });

  it('starts on the new requests when the address has no status', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on('GET /api/v1/service-requests', paged([]));
    await mountSuspended(QueuePage, { route: '/solicitacoes?estado=OUTRO' });
    await settle();
    expect(api.called('GET /api/v1/service-requests')[0]!.url.searchParams.get('status')).toBe('REQUESTED');
  });
});

describe('request detail for the store', () => {
  it('asks the customer, rejects with a reason and approves with a message', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(DETAIL, { body: serviceRequest() }, { body: serviceRequest({ status: 'AWAITING_CUSTOMER' }) })
      .on('GET /api/v1/service-requests/41/messages', { body: [] })
      .on('POST /api/v1/service-requests/41/messages', {
        body: [
          {
            ...message(1, true, 'Qual o modelo?'),
            author: { id: 2, name: 'Marina Gerente', role: 'MANAGER' },
          },
        ],
      })
      .on('POST /api/v1/service-requests/41/rejection', problem(409, 'Já decidida.'))
      .on('POST /api/v1/service-requests/41/approval', {
        body: serviceRequest({ status: 'APPROVED', canCancel: true }),
      });
    const page = await mountSuspended(RequestPage, { route: '/solicitacoes/41', attachTo: document.body });
    await settle();
    expect(page.get('h2').text()).toBe('Solicitação 41');
    expect(page.find('a[href="/clientes/4"]').text()).toContain('Carla Cliente');
    expect(page.find('a[href="tel:19999998888"]').text()).toContain('(19) 99999-8888');

    await fill('Sua mensagem', 'Qual o modelo?');
    click('Enviar mensagem');
    await settle();
    expect(page.find('[data-status="AWAITING_CUSTOMER"]').exists()).toBe(true);

    click('Recusar');
    await settle();
    await fill('Motivo', 'Não');
    click('Recusar solicitação');
    await settle();
    expect(text()).toContain('Explique o motivo para o cliente');
    expect(api.called('POST /api/v1/service-requests/41/rejection')).toHaveLength(0);
    await fill('Motivo', 'Fora da área de atendimento.');
    click('Recusar solicitação');
    await settle();
    expect(toastTitles()).toContain('Já decidida.');
    press('Fechar');
    await settle();

    click('Aprovar');
    await settle();
    click('Aprovar solicitação');
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/approval')[0]!.body).toEqual({});
    expect(toastTitles()).toContain('Solicitação aprovada. Agora é só marcar na agenda.');
    expect(page.find('a[href="/agenda?solicitacao=41"]').text()).toContain('Marcar na agenda');
    expect(text()).not.toContain('Aprovar solicitação');
  });

  it('approves with a message, rejects and cancels', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(DETAIL, { body: serviceRequest({ customer: { ...serviceRequest().customer, phone: null } }) })
      .on('GET /api/v1/service-requests/41/messages', { body: [] })
      .on('POST /api/v1/service-requests/41/approval', { body: serviceRequest() })
      .on('POST /api/v1/service-requests/41/rejection', {
        body: serviceRequest({ status: 'REJECTED', canCancel: false, rejectionReason: 'Fora da área.' }),
      });
    const page = await mountSuspended(RequestPage, { route: '/solicitacoes/41', attachTo: document.body });
    await settle();
    expect(page.find('a[href^="tel:"]').exists()).toBe(false);
    click('Aprovar');
    await settle();
    await fill('Mensagem para o cliente (opcional)', 'Vamos marcar.');
    click('Aprovar solicitação');
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/approval')[0]!.body).toEqual({
      message: 'Vamos marcar.',
    });

    click('Recusar');
    await settle();
    await fill('Motivo', 'Fora da área.');
    click('Recusar solicitação');
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/rejection')[0]!.body).toEqual({
      reason: 'Fora da área.',
    });
    expect(text()).toContain('Fora da área.');
    expect(text()).not.toContain('Enviar mensagem');
  });

  it('cancels a scheduled visit with or without a reason', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(DETAIL, { body: serviceRequest({ status: 'SCHEDULED', appointment: APPOINTMENT }) })
      .on('GET /api/v1/service-requests/41/messages', { body: [] })
      .on(
        'POST /api/v1/service-requests/41/cancellation',
        { body: serviceRequest({ status: 'SCHEDULED', appointment: APPOINTMENT }) },
        {
          body: serviceRequest({
            status: 'CANCELED',
            canCancel: false,
            cancellationReason: 'Cliente desistiu.',
          }),
        },
      );
    await mountSuspended(RequestPage, { route: '/solicitacoes/41', attachTo: document.body });
    await settle();
    expect(text()).toContain('07/10/2026, 08:00 até 10:00 com Tiago Técnico');
    click('Cancelar');
    await settle();
    click('Voltar');
    await settle();
    click('Cancelar');
    await settle();
    click('Cancelar solicitação');
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/cancellation')[0]!.body).toEqual({});
    click('Cancelar');
    await settle();
    await fill('Motivo (opcional)', 'Cliente desistiu.');
    click('Cancelar solicitação');
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/cancellation')[1]!.body).toEqual({
      reason: 'Cliente desistiu.',
    });
    expect(toastTitles()).toContain('Solicitação cancelada.');
  });

  it('handles missing and failing requests', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on('GET /api/v1/service-requests/99', problem(404, 'Solicitação não encontrada.'));
    const missing = await mountSuspended(RequestPage, { route: '/solicitacoes/99' });
    await settle();
    expect(missing.text()).toContain('Procuramos em todas as prateleiras');
    mockApi().on('GET /api/v1/service-requests/98', problem(500, 'Erro.'));
    const failed = await mountSuspended(RequestPage, { route: '/solicitacoes/98' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});
