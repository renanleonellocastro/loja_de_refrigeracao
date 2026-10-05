import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import QuotePage from '~/pages/minha-conta/orcamentos/[id].vue';
import QuotesPage from '~/pages/minha-conta/orcamentos/index.vue';
import { useAuthStore } from '~/stores/auth';
import { PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';
import { answeredQuote, quote, quoteListItem } from '../support/quotes';
import { message } from '../support/services';
import { paged, press, settle, text } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const DETAIL = 'GET /api/v1/quotes/31';
const MESSAGES = 'GET /api/v1/quotes/31/messages';
const ACCEPT = 'POST /api/v1/quotes/31/acceptance';

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function mountQuote() {
  const page = await mountSuspended(QuotePage, {
    route: '/minha-conta/orcamentos/31',
    attachTo: document.body,
  });
  await settle();
  return page;
}

describe('my quotes', () => {
  it('lists the quotes with status, value and validity', async () => {
    useAuthStore().apply(session());
    const api = mockApi().on(
      'GET /api/v1/quotes',
      paged(
        [
          quoteListItem(),
          quoteListItem({ id: 32, status: 'ANSWERED', amountCents: 123456, validUntil: '2026-10-15' }),
          quoteListItem({ id: 33, status: 'ACCEPTED', amountCents: 9900, validUntil: '2026-10-15' }),
        ],
        30,
      ),
    );
    const page = await mountSuspended(QuotesPage, {
      route: '/minha-conta/orcamentos',
      attachTo: document.body,
    });
    await settle();
    expect(page.find('a[href="/minha-conta/orcamentos/32"]').text()).toContain('Respondido');
    expect(text()).toContain('válido até 15/10/2026');
    expect(text()).toContain('R$ 1.234,56');
    expect(page.find('a[href="/minha-conta/orcamentos/33"]').text()).not.toContain('válido até');
    expect(page.find('a[href="/orcamento"]').exists()).toBe(true);
    press('Próxima página');
    await settle();
    expect(api.called('GET /api/v1/quotes')[1]!.url.searchParams.get('page')).toBe('2');
  });

  it('shows the empty state and the failure', async () => {
    useAuthStore().apply(session());
    mockApi().on('GET /api/v1/quotes', paged([]));
    const empty = await mountSuspended(QuotesPage, { route: '/minha-conta/orcamentos' });
    await settle();
    expect(empty.text()).toContain('Quando você pedir um orçamento');

    mockApi().on('GET /api/v1/quotes', new TypeError('offline'));
    const failed = await mountSuspended(QuotesPage, { route: '/minha-conta/orcamentos' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});

describe('my quote', () => {
  it('shows the offer, talks to the store and accepts with days and the profile address', async () => {
    useAuthStore().apply(session());
    const api = mockApi()
      .on(DETAIL, { body: answeredQuote() })
      .on(MESSAGES, { body: [message(1, false, 'Tem tomada perto?')] })
      .on('POST /api/v1/quotes/31/messages', {
        body: [message(1, false, 'Tem tomada perto?'), message(2, true, 'Tem sim.')],
      })
      .on('GET /api/v1/me', { body: PROFILE })
      .on(ACCEPT, problem(409, 'O orçamento venceu.'), {
        body: {
          quote: answeredQuote({
            status: 'ACCEPTED',
            canAccept: false,
            canDecline: false,
            serviceRequestId: 41,
          }),
          serviceRequestId: 41,
        },
      });
    const page = await mountQuote();
    expect(page.get('h2').text()).toBe('Conserto de geladeira');
    expect(page.get('[data-testid="quote-amount"]').text()).toBe('R$ 1.234,56');
    expect(text()).toContain('Válido até 15/10/2026');
    expect(text()).toContain('Mão de obra e suporte.');
    expect(text()).toContain('Pagamento na hora.');
    expect(text()).toContain('Respondido por Marina Gerente');
    expect(text()).toContain('Seu orçamento está pronto.');
    expect(page.findAll('[aria-label="Fotos do pedido"] img')).toHaveLength(1);
    expect(text()).toContain('Tem tomada perto?');
    expect(text()).not.toContain('Cancelar');

    await fill('Sua mensagem', 'Tem sim.');
    click('Enviar mensagem');
    await settle();
    expect(api.called('POST /api/v1/quotes/31/messages')[0]!.body).toEqual({ body: 'Tem sim.' });
    expect(api.called(DETAIL)).toHaveLength(2);

    click('Aceitar');
    await settle();
    expect(text()).toContain('Rua Doutor Ulhoa Cintra, 91');
    click('Voltar');
    await settle();
    expect(text()).not.toContain('Aceitar e pedir visita');
    click('Aceitar');
    await settle();
    submit('Aceitar e pedir visita');
    await settle();
    expect(text()).toContain('Escolha pelo menos um dia e período.');
    click('Adicionar data');
    await settle();
    submit('Aceitar e pedir visita');
    await settle();
    expect(text()).toContain('O orçamento venceu.');
    submit('Aceitar e pedir visita');
    await settle();
    const body = api.called(ACCEPT)[1]!.body as Record<string, unknown>;
    expect(body.windows).toHaveLength(1);
    expect(body.address).toBeUndefined();
    expect(toastTitles()).toContain('Orçamento aceito. Pedido de visita enviado.');
    expect(page.find('[data-status="ACCEPTED"]').exists()).toBe(true);
    expect(page.get('[data-testid="quote-request"]').text()).toContain('Pedido de visita 41');
    expect(page.find('a[href="/minha-conta/agendamentos/41"]').exists()).toBe(true);
    expect(text()).not.toContain('Enviar mensagem');
  });

  it('accepts with another address and types one when the profile has none', async () => {
    useAuthStore().apply(session());
    const accepted = {
      quote: answeredQuote({ status: 'ACCEPTED', canAccept: false, canDecline: false, serviceRequestId: 42 }),
      serviceRequestId: 42,
    };
    const api = mockApi()
      .on(DETAIL, { body: answeredQuote() })
      .on(MESSAGES, { body: [] })
      .on('GET /api/v1/me', { body: PROFILE })
      .on('GET /api/v1/addresses/lookup', {
        body: { cep: '13800061', street: 'Rua Um', district: 'Centro', city: 'Mogi Mirim', state: 'SP' },
      })
      .on(ACCEPT, { body: accepted });
    await mountQuote();
    expect(text()).toContain('tirar dúvidas sobre o orçamento');
    click('Aceitar');
    await settle();
    click('Adicionar data');
    await settle();
    (document.querySelector('input[value="other"]') as HTMLInputElement).click();
    await settle();
    submit('Aceitar e pedir visita');
    await settle();
    expect(text()).toContain('Digite os 8 números do CEP');
    await fill('CEP', '13800061');
    await settle();
    await fill('Rua', 'Rua Um');
    await fill('Número', '10');
    await fill('Bairro', 'Centro');
    await fill('Cidade', 'Mogi Mirim');
    await fill('UF', 'SP');
    submit('Aceitar e pedir visita');
    await settle();
    expect((api.called(ACCEPT)[0]!.body as Record<string, unknown>).address).toMatchObject({ number: '10' });
    document.body.innerHTML = '';

    mockApi()
      .on(DETAIL, { body: answeredQuote() })
      .on(MESSAGES, { body: [] })
      .on('GET /api/v1/me', new TypeError('offline'))
      .on(ACCEPT, { body: accepted });
    await mountQuote();
    click('Aceitar');
    await settle();
    expect(text()).toContain('Seu cadastro não tem endereço.');
  });

  it('declines with a reason and handles a failure', async () => {
    useAuthStore().apply(session());
    const api = mockApi()
      .on(DETAIL, { body: answeredQuote({ notes: null, photos: [], answeredBy: null }) })
      .on(MESSAGES, { body: [] })
      .on('POST /api/v1/quotes/31/decline', problem(409, 'Já foi decidido.'), {
        body: answeredQuote({
          status: 'DECLINED',
          canAccept: false,
          canDecline: false,
          declineReason: 'Achei caro.',
        }),
      });
    await mountQuote();
    expect(text()).not.toContain('Observações');
    expect(text()).not.toContain('Respondido por');
    expect(text()).toContain('Nenhuma foto enviada.');
    click('Recusar');
    await settle();
    press('Fechar');
    await settle();
    click('Recusar');
    await settle();
    await fill('Motivo (opcional)', 'Achei caro.');
    click('Recusar orçamento');
    await settle();
    expect(toastTitles()).toContain('Já foi decidido.');
    click('Recusar orçamento');
    await settle();
    expect(api.called('POST /api/v1/quotes/31/decline')[1]!.body).toEqual({ reason: 'Achei caro.' });
    expect(toastTitles()).toContain('Orçamento recusado.');
    expect(text()).toContain('Achei caro.');
    expect(text()).toContain('Você recusou este orçamento.');
  });

  it('cancels a quote still waiting for the store without a reason', async () => {
    useAuthStore().apply(session());
    const api = mockApi()
      .on(DETAIL, { body: quote() })
      .on(MESSAGES, { body: [] })
      .on('POST /api/v1/quotes/31/cancellation', {
        body: quote({ status: 'CANCELED', canCancel: false }),
      });
    await mountQuote();
    expect(text()).not.toContain('Valor');
    expect(text()).not.toContain('Aceitar');
    click('Cancelar');
    await settle();
    click('Voltar');
    await settle();
    click('Cancelar');
    await settle();
    click('Cancelar pedido');
    await settle();
    expect(api.called('POST /api/v1/quotes/31/cancellation')[0]!.body).toEqual({});
    expect(toastTitles()).toContain('Pedido de orçamento cancelado.');
    expect(text()).toContain('Este orçamento foi cancelado.');
  });

  it('handles missing and failing quotes', async () => {
    useAuthStore().apply(session());
    mockApi().on('GET /api/v1/quotes/99', problem(404, 'Orçamento não encontrado.'));
    const missing = await mountSuspended(QuotePage, { route: '/minha-conta/orcamentos/99' });
    await settle();
    expect(missing.text()).toContain('Procuramos em todas as prateleiras');

    mockApi().on('GET /api/v1/quotes/98', problem(500, 'Erro.'));
    const failed = await mountSuspended(QuotePage, { route: '/minha-conta/orcamentos/98' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
  });
});
