import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import QuotePage from '~/pages/orcamentos/[id].vue';
import QueuePage from '~/pages/orcamentos/index.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, fill, mockApi, problem, session, submit, click } from '../support/api';
import { answeredQuote, quote, quoteListItem } from '../support/quotes';
import { message } from '../support/services';
import { paged, press, settle, text, wait } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const LIST = 'GET /api/v1/quotes';
const DETAIL = 'GET /api/v1/quotes/31';
const MESSAGES = 'GET /api/v1/quotes/31/messages';
const ANSWER = 'POST /api/v1/quotes/31/answer';

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('quote queue', () => {
  it('filters by status, searches and shows the value', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on(
      LIST,
      paged([quoteListItem(), quoteListItem({ id: 32, status: 'ANSWERED', amountCents: 50000 })], 30),
      paged([quoteListItem({ id: 33 })], 30),
      paged([]),
    );
    const page = await mountSuspended(QueuePage, { route: '/orcamentos', attachTo: document.body });
    await settle();
    expect(api.called(LIST)[0]!.url.searchParams.get('status')).toBe('REQUESTED');
    expect(page.find('a[href="/orcamentos/31"]').text()).toBe('Orçamento 31');
    expect(text()).toContain('A responder');
    expect(text()).toContain('R$ 500,00');
    expect(page.find('a[href="/orcamento"]').exists()).toBe(true);

    press('Próxima página');
    await settle();
    expect(api.called(LIST)[1]!.url.searchParams.get('page')).toBe('2');

    await fill('Estado', 'ANSWERED');
    await settle();
    expect(api.called(LIST)[2]!.url.searchParams.get('status')).toBe('ANSWERED');
    expect(text()).toContain('Nenhum orçamento: respondido');

    await fill('Buscar orçamentos', 'Zé');
    await wait(350);
    await settle();
    expect(api.called(LIST)[3]!.url.searchParams.get('q')).toBe('Zé');
    expect(text()).toContain('Nada encontrado para “Zé”');
    page.unmount();
  });

  it('starts from every status and shows a failure', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi().on(LIST, paged([]));
    await mountSuspended(QueuePage, { route: '/orcamentos?estado=TODOS', attachTo: document.body });
    await settle();
    expect(api.called(LIST)[0]!.url.searchParams.get('status')).toBeNull();
    expect(text()).toContain('Quando um cliente pedir um orçamento');
    document.body.innerHTML = '';

    mockApi().on(LIST, problem(500, 'Erro.'));
    const failed = await mountSuspended(QueuePage, { route: '/orcamentos?estado=EXPIRED' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});

describe('quote answer', () => {
  it('shows the request and the customer, asks a question and answers with a value', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(DETAIL, { body: quote() })
      .on(MESSAGES, { body: [] })
      .on('POST /api/v1/quotes/31/messages', { body: [message(1, true, 'Qual é a marca?')] })
      .on(
        ANSWER,
        problem(422, 'Dados inválidos', { errors: [{ path: 'included', message: 'Detalhe melhor.' }] }),
        problem(409, 'Este orçamento já foi respondido.'),
        { body: answeredQuote({ canAccept: false, canDecline: false, canCancel: true }) },
      );
    const page = await mountSuspended(QuotePage, { route: '/orcamentos/31', attachTo: document.body });
    await settle();
    expect(page.get('h2').text()).toBe('Orçamento 31');
    expect(page.get('[data-testid="quote-description"]').text()).toContain('split de 12.000 BTUs');
    expect(page.find('a[href="/clientes/4"]').text()).toContain('Carla Cliente');
    expect(page.find('a[href="mailto:cliente@castro.dev"]').exists()).toBe(true);
    expect(page.find('a[href="tel:19999998888"]').text()).toContain('(19) 99999-8888');
    expect(text()).toContain('Pergunte ao cliente o que precisar');

    await fill('Sua mensagem', 'Qual é a marca?');
    click('Enviar mensagem');
    await settle();
    expect(text()).toContain('Qual é a marca?');

    await fill('Validade em dias', '0');
    submit('Enviar orçamento');
    await settle();
    expect(text()).toContain('Informe o valor do orçamento.');
    expect(text()).toContain('A validade vai de 1 a 90 dias.');
    expect(text()).toContain('Diga o que está incluído no valor.');
    expect(api.called(ANSWER)).toHaveLength(0);

    await fill('Valor', '123456');
    await fill('Validade em dias', '15');
    await fill('O que está incluído', 'Mão');
    submit('Enviar orçamento');
    await settle();
    expect(text()).toContain('Detalhe melhor.');
    await fill('O que está incluído', 'Mão de obra e suporte.');
    await fill('Observações', 'Pagamento na hora.');
    submit('Enviar orçamento');
    await settle();
    expect(text()).toContain('Este orçamento já foi respondido.');
    submit('Enviar orçamento');
    await settle();
    expect(api.called(ANSWER)[2]!.body).toEqual({
      amountCents: 123456,
      validityDays: 15,
      included: 'Mão de obra e suporte.',
      notes: 'Pagamento na hora.',
    });
    expect(toastTitles()).toContain('Orçamento enviado. O cliente recebe um email.');
    expect(page.find('[data-status="ANSWERED"]').exists()).toBe(true);
    expect(page.get('[data-testid="quote-amount"]').text()).toBe('R$ 1.234,56');
    expect(text()).not.toContain('Enviar orçamento');
  });

  it('answers without notes and cancels with a reason after a failure', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(DETAIL, { body: quote({ customer: { id: 4, name: 'Carla', email: 'c@x.dev', phone: null } }) })
      .on(MESSAGES, { body: [] })
      .on(ANSWER, { body: answeredQuote({ canCancel: true }) })
      .on('POST /api/v1/quotes/31/cancellation', problem(409, 'Já foi decidido.'), {
        body: answeredQuote({ status: 'CANCELED', canCancel: false, declineReason: 'Cliente desistiu.' }),
      });
    const page = await mountSuspended(QuotePage, { route: '/orcamentos/31', attachTo: document.body });
    await settle();
    expect(page.find('a[href^="tel:"]').exists()).toBe(false);
    await fill('Valor', '9900');
    await fill('O que está incluído', 'Visita técnica.');
    submit('Enviar orçamento');
    await settle();
    expect((api.called(ANSWER)[0]!.body as Record<string, unknown>).notes).toBeUndefined();

    click('Cancelar orçamento');
    await settle();
    click('Voltar');
    await settle();
    click('Cancelar orçamento');
    await settle();
    press('Fechar');
    await settle();
    click('Cancelar orçamento');
    await settle();
    await fill('Motivo (opcional)', 'Cliente desistiu.');
    click('Cancelar orçamento', 1);
    await settle();
    expect(toastTitles()).toContain('Já foi decidido.');
    click('Cancelar orçamento', 1);
    await settle();
    expect(api.called('POST /api/v1/quotes/31/cancellation')[1]!.body).toEqual({
      reason: 'Cliente desistiu.',
    });
    expect(toastTitles()).toContain('Orçamento cancelado.');
    expect(text()).toContain('Cliente desistiu.');
  });

  it('links the visit request of an accepted quote and cancels without a reason', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(DETAIL, { body: answeredQuote({ status: 'ACCEPTED', serviceRequestId: 41, canCancel: true }) })
      .on(MESSAGES, { body: [] })
      .on('POST /api/v1/quotes/31/cancellation', {
        body: answeredQuote({ status: 'CANCELED', canCancel: false }),
      });
    const page = await mountSuspended(QuotePage, { route: '/orcamentos/31', attachTo: document.body });
    await settle();
    expect(page.find('a[href="/solicitacoes/41"]').text()).toContain('Ver solicitação 41');
    click('Cancelar orçamento');
    await settle();
    click('Cancelar orçamento', 1);
    await settle();
    expect(api.called('POST /api/v1/quotes/31/cancellation')[0]!.body).toEqual({});
  });

  it('handles missing and failing quotes', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on('GET /api/v1/quotes/99', problem(404, 'Orçamento não encontrado.'));
    const missing = await mountSuspended(QuotePage, { route: '/orcamentos/99' });
    await settle();
    expect(missing.text()).toContain('Procuramos em todas as prateleiras');

    mockApi().on('GET /api/v1/quotes/98', problem(500, 'Erro.'));
    const failed = await mountSuspended(QuotePage, { route: '/orcamentos/98' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});
