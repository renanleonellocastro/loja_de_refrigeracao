import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearNuxtData } from '#imports';
import { useToast } from '~/composables/useToast';
import RequestPage from '~/pages/minha-conta/agendamentos/[id].vue';
import RequestsPage from '~/pages/minha-conta/agendamentos/index.vue';
import ServicesPage from '~/pages/servicos.vue';
import { useAuthStore } from '~/stores/auth';
import { click, fill, mockApi, problem, session } from '../support/api';
import { APPOINTMENT, message, requestListItem, serviceRequest, serviceType } from '../support/services';
import { paged, press, settle, text } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const DETAIL = 'GET /api/v1/service-requests/41';
const MESSAGES = 'GET /api/v1/service-requests/41/messages';

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  clearNuxtData();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('services page', () => {
  it('lists the active service types with their calls to action', async () => {
    mockApi().on('GET /api/v1/service-types', {
      body: [
        serviceType(),
        serviceType({ id: 2, name: 'Manutenção de ar condicionado', estimatedMinutes: 90 }),
        serviceType({ id: 3, name: 'Antigo', active: false }),
      ],
    });
    const page = await mountSuspended(ServicesPage, { route: '/servicos' });
    await settle();
    expect(page.get('h1').text()).toBe('Serviços');
    expect(page.findAll('[data-service]')).toHaveLength(2);
    expect(page.text()).toContain('Duração estimada: 1h30');
    expect(page.find('a[href="/agendar?servico=2"]').text()).toContain('Agendar visita');
    expect(page.find('a[href="/orcamento?servico=1"]').text()).toContain('Pedir orçamento');
    expect(page.find('img[src="/illustrations/servico-ar-condicionado.svg"]').exists()).toBe(true);
  });

  it('shows an empty state and a failure with retry', async () => {
    mockApi().on('GET /api/v1/service-types', { body: [] });
    const empty = await mountSuspended(ServicesPage, { route: '/servicos' });
    await settle();
    expect(empty.text()).toContain('Nenhum serviço disponível agora');
    clearNuxtData();

    mockApi().on('GET /api/v1/service-types', problem(500, 'Erro.'), { body: [serviceType()] });
    const failed = await mountSuspended(ServicesPage, { route: '/servicos' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
    await failed
      .findAll('button')
      .find((item) => item.text() === 'Tentar de novo')!
      .trigger('click');
    await settle();
    expect(failed.findAll('[data-service]')).toHaveLength(1);
  });

  it('shows skeletons while the services load', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal('fetch', async () => {
      await gate;
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const page = mountSuspended(ServicesPage, { route: '/servicos' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const wrapper = await page;
    await settle();
    expect(wrapper.text()).toContain('Nenhum serviço');
  });
});

describe('my visit requests', () => {
  it('lists the requests with status and the scheduled visit', async () => {
    useAuthStore().apply(session());
    const api = mockApi().on(
      'GET /api/v1/service-requests',
      paged(
        [
          requestListItem(),
          requestListItem({
            id: 42,
            status: 'SCHEDULED',
            scheduledFor: '2026-10-07T11:00:00.000Z',
            employee: { id: 3, name: 'Tiago Técnico' },
          }),
          requestListItem({ id: 43, status: 'APPROVED', scheduledFor: '2026-10-09T11:00:00.000Z' }),
        ],
        30,
      ),
    );
    const page = await mountSuspended(RequestsPage, {
      route: '/minha-conta/agendamentos',
      attachTo: document.body,
    });
    await settle();
    expect(page.find('a[href="/minha-conta/agendamentos/42"]').text()).toContain('Agendado');
    expect(text()).toContain('Visita em 07/10/2026, 08:00 com Tiago Técnico');
    expect(text()).toContain('Visita em 09/10/2026, 08:00');
    expect(page.find('a[href="/agendar"]').exists()).toBe(true);
    press('Próxima página');
    await settle();
    expect(api.called('GET /api/v1/service-requests')[1]!.url.searchParams.get('page')).toBe('2');
  });

  it('shows the empty state and the failure', async () => {
    useAuthStore().apply(session());
    mockApi().on('GET /api/v1/service-requests', paged([]));
    const empty = await mountSuspended(RequestsPage, { route: '/minha-conta/agendamentos' });
    await settle();
    expect(empty.text()).toContain('Quando você pedir uma visita, ela aparece aqui.');
    expect(empty.find('a[href="/servicos"]').exists()).toBe(true);

    mockApi().on('GET /api/v1/service-requests', new TypeError('offline'));
    const failed = await mountSuspended(RequestsPage, { route: '/minha-conta/agendamentos' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});

describe('my visit request', () => {
  it('shows the request, answers the store and cancels within the rule', async () => {
    useAuthStore().apply(session());
    const api = mockApi()
      .on(
        DETAIL,
        { body: serviceRequest({ status: 'AWAITING_CUSTOMER' }) },
        { body: serviceRequest({ status: 'REQUESTED' }) },
      )
      .on(MESSAGES, { body: [message(1, false, 'A geladeira faz barulho?')] })
      .on(
        'POST /api/v1/service-requests/41/messages',
        { body: [message(1, false, 'A geladeira faz barulho?'), message(2, true, 'Faz um estalo.')] },
        problem(409, 'Esta solicitação foi encerrada.'),
      )
      .on('POST /api/v1/service-requests/41/cancellation', problem(409, 'Não dá mais para cancelar.'), {
        body: serviceRequest({ status: 'CANCELED', canCancel: false, cancellationReason: 'Resolvi.' }),
      });
    const page = await mountSuspended(RequestPage, {
      route: '/minha-conta/agendamentos/41',
      attachTo: document.body,
    });
    await settle();
    expect(page.get('h2').text()).toBe('Conserto de geladeira');
    expect(text()).toContain('A loja fez uma pergunta.');
    expect(text()).toContain('Geladeira duplex · Brastemp');
    expect(text()).toContain('Rua Doutor Ulhoa Cintra, 91, Centro, Mogi Mirim/SP, CEP 13800-061');
    expect(text()).toContain('A geladeira faz barulho?');
    expect(text()).toContain('Marina Gerente');
    expect(text()).toContain('até as 18h do dia anterior');
    expect(page.findAll('[aria-label="Fotos do problema"] img')).toHaveLength(1);

    click('Enviar mensagem');
    await settle();
    expect(text()).toContain('Escreva a mensagem antes de enviar.');
    await fill('Sua mensagem', 'Faz um estalo.');
    click('Enviar mensagem');
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/messages')[0]!.body).toEqual({
      body: 'Faz um estalo.',
    });
    expect(text()).toContain('Você');
    expect(api.called(DETAIL)).toHaveLength(2);
    expect(page.find('[data-status="REQUESTED"]').exists()).toBe(true);
    await fill('Sua mensagem', 'Mais uma.');
    click('Enviar mensagem');
    await settle();
    expect(toastTitles()).toContain('Esta solicitação foi encerrada.');

    click('Cancelar agendamento');
    await settle();
    await fill('Motivo (opcional)', 'Resolvi.');
    click('Cancelar agendamento', 1);
    await settle();
    expect(toastTitles()).toContain('Não dá mais para cancelar.');
    click('Cancelar agendamento', 1);
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/cancellation')[1]!.body).toEqual({
      reason: 'Resolvi.',
    });
    expect(toastTitles()).toContain('Agendamento cancelado.');
    expect(page.find('[data-status="CANCELED"]').exists()).toBe(true);
    expect(text()).toContain('Resolvi.');
    expect(text()).not.toContain('Enviar mensagem');
  });

  it('shows the visit, cancels without a reason and handles a conversation failure', async () => {
    useAuthStore().apply(session());
    const api = mockApi()
      .on(DETAIL, {
        body: serviceRequest({ status: 'SCHEDULED', appointment: APPOINTMENT, photos: [], brand: null }),
      })
      .on(MESSAGES, new TypeError('offline'), { body: [] })
      .on('POST /api/v1/service-requests/41/cancellation', {
        body: serviceRequest({ status: 'CANCELED', canCancel: false }),
      });
    const page = await mountSuspended(RequestPage, {
      route: '/minha-conta/agendamentos/41',
      attachTo: document.body,
    });
    await settle();
    expect(page.get('[data-testid="visit"]').text()).toContain('07/10/2026, 08:00 até 10:00');
    expect(text()).toContain('Técnico: Tiago Técnico');
    expect(text()).toContain('Nenhuma foto enviada.');
    expect(text()).toContain('Não conseguimos carregar a conversa.');
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Nenhuma mensagem ainda.');
    click('Cancelar agendamento');
    await settle();
    press('Fechar');
    await settle();
    click('Cancelar agendamento');
    await settle();
    click('Voltar');
    await settle();
    click('Cancelar agendamento');
    await settle();
    click('Cancelar agendamento', 1);
    await settle();
    expect(api.called('POST /api/v1/service-requests/41/cancellation')[0]!.body).toEqual({});
  });

  it('explains a rejection and handles missing and failing requests', async () => {
    useAuthStore().apply(session());
    mockApi()
      .on(DETAIL, {
        body: serviceRequest({ status: 'REJECTED', canCancel: false, rejectionReason: 'Fora da área.' }),
      })
      .on(MESSAGES, { body: [] });
    await mountSuspended(RequestPage, { route: '/minha-conta/agendamentos/41', attachTo: document.body });
    await settle();
    expect(text()).toContain('Fora da área.');
    expect(text()).not.toContain('Cancelar agendamento');
    document.body.innerHTML = '';

    mockApi().on('GET /api/v1/service-requests/99', problem(404, 'Solicitação não encontrada.'));
    const missing = await mountSuspended(RequestPage, { route: '/minha-conta/agendamentos/99' });
    await settle();
    expect(missing.text()).toContain('Procuramos em todas as prateleiras');

    mockApi().on('GET /api/v1/service-requests/98', problem(500, 'Erro.'));
    const failed = await mountSuspended(RequestPage, { route: '/minha-conta/agendamentos/98' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});
