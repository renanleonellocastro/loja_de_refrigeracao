import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import RequestFormPage from '~/pages/agendar.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';
import { serviceRequest, serviceType } from '../support/services';
import { mockUploads, paged, pickFiles, settle, stubImages, text, wait } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const CREATE = 'POST /api/v1/service-requests';
const TYPES = [
  serviceType(),
  serviceType({ id: 2, name: 'Conserto de lavadora' }),
  serviceType({ id: 3, active: false }),
];

const stepTitle = () => document.querySelector('[data-testid="step-title"]')!.textContent!.trim();

async function next(): Promise<void> {
  submit('Continuar');
  await settle();
}

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('visit request form for customers', () => {
  it('walks the steps, validates each one and sends with photos', async () => {
    useAuthStore().apply(session());
    stubImages();
    const uploads = mockUploads({ status: 201, body: [] });
    const api = mockApi()
      .on('GET /api/v1/service-types', { body: TYPES })
      .on('GET /api/v1/me', { body: PROFILE })
      .on(CREATE, { status: 201, body: serviceRequest() });
    const page = await mountSuspended(RequestFormPage, {
      route: '/agendar?servico=1',
      attachTo: document.body,
    });
    await settle();
    expect(stepTitle()).toBe('Qual serviço você precisa?');
    expect(page.findAll('input[name="serviceTypeId"]')).toHaveLength(2);
    await next();

    expect(stepTitle()).toBe('Qual é o aparelho?');
    await next();
    expect(text()).toContain('Diga qual é o aparelho');
    await fill('Aparelho', 'Geladeira duplex');
    await fill('Marca', 'Brastemp');
    await fill('Modelo', 'BRM44');
    await next();

    expect(stepTitle()).toBe('O que está acontecendo?');
    await next();
    expect(text()).toContain('pelo menos 10 letras');
    await fill('Problema', 'Não gela embaixo desde ontem.');
    pickFiles(['defeito.jpg']);
    await settle();
    await next();

    expect(stepTitle()).toBe('Quais dias ficam bons?');
    await next();
    expect(text()).toContain('Escolha pelo menos um dia e período.');
    await fill('Período', 'AFTERNOON');
    click('Adicionar data');
    await settle();
    click('Adicionar data');
    await settle();
    expect(text()).toContain('Esse dia e período já estão na lista.');
    await fill('Período', 'MORNING');
    await fill('Dia', (document.querySelector('option:nth-child(3)') as HTMLOptionElement).value);
    click('Adicionar data');
    await settle();
    expect(document.querySelectorAll('[aria-label="Datas escolhidas"] li')).toHaveLength(2);
    const remove = document.querySelector<HTMLButtonElement>('[aria-label^="Remover"][aria-label*="tarde"]')!;
    remove.click();
    await settle();
    expect(text()).toContain('removido');
    await next();

    expect(stepTitle()).toBe('Onde vai ser a visita?');
    expect(text()).toContain('Rua Doutor Ulhoa Cintra, 91');
    await next();

    expect(stepTitle()).toBe('Confira e envie');
    expect(text()).toContain('Conserto de geladeira');
    expect(text()).toContain('Geladeira duplex · Brastemp');
    expect(text()).toContain('1 de 6');
    submit('Enviar solicitação');
    await settle();
    await wait(5);
    await settle();

    const call = api.called(CREATE)[0]!;
    expect(call.body).toMatchObject({
      serviceTypeId: 1,
      productKind: 'Geladeira duplex',
      brand: 'Brastemp',
      problem: 'Não gela embaixo desde ontem.',
      windows: [{ period: 'MORNING' }],
    });
    expect((call.body as Record<string, unknown>).address).toBeUndefined();
    expect((call.body as Record<string, unknown>).customerId).toBeUndefined();
    expect(uploads[0]!.url).toContain('/api/v1/service-requests/41/photos');
    expect(uploads[0]!.form.getAll('files')).toHaveLength(1);
    expect(text()).toContain('Pronto! Recebemos sua solicitação.');
    expect(page.find('a[href="/minha-conta/agendamentos/41"]').text()).toContain('Ver agendamento');

    click('Agendar outra visita');
    await settle();
    expect(stepTitle()).toBe('Qual serviço você precisa?');
    await next();
    expect(text()).toContain('Escolha o serviço.');
  });

  it('asks for the address when the profile has none and warns when photos fail', async () => {
    useAuthStore().apply(session());
    stubImages();
    mockUploads({ status: 500, body: { title: 'Erro.' } });
    const api = mockApi()
      .on('GET /api/v1/service-types', problem(500, 'Erro.'), { body: TYPES })
      .on('GET /api/v1/me', new TypeError('offline'))
      .on('GET /api/v1/addresses/lookup', { status: 404, body: {} })
      .on(CREATE, { status: 201, body: serviceRequest({ id: 77 }) });
    const page = await mountSuspended(RequestFormPage, { route: '/agendar', attachTo: document.body });
    await settle();
    expect(text()).toContain('Tentar de novo');
    click('Tentar de novo');
    await settle();
    (document.querySelector('input[value="2"]') as HTMLInputElement).click();
    await settle();
    await next();
    await fill('Aparelho', 'Lavadora');
    await next();
    await fill('Problema', 'Não centrifuga mais a roupa.');
    pickFiles(['a.jpg']);
    await settle();
    await next();
    click('Adicionar data');
    await settle();
    await next();
    expect(text()).toContain('Seu cadastro não tem endereço.');
    await next();
    expect(text()).toContain('Digite os 8 números do CEP');
    await fill('CEP', '13800061');
    await settle();
    await fill('Rua', 'Rua Um');
    await fill('Número', '10');
    await fill('Bairro', 'Centro');
    await fill('Cidade', 'Mogi Mirim');
    await fill('UF', 'SP');
    await next();
    expect(text()).toContain('Rua Um, 10, Centro, Mogi Mirim/SP');
    submit('Enviar solicitação');
    await settle();
    await wait(5);
    await settle();
    expect((api.called(CREATE)[0]!.body as Record<string, unknown>).address).toMatchObject({
      cep: '13800061',
    });
    expect(text()).toContain('as fotos não chegaram');
    expect(page.find('a[href="/minha-conta/agendamentos/77"]').exists()).toBe(true);
  });

  it('goes back to the refused field and retries after a dropped connection', async () => {
    useAuthStore().apply(session());
    const api = mockApi()
      .on('GET /api/v1/service-types', { body: TYPES })
      .on('GET /api/v1/me', { body: PROFILE })
      .on('GET /api/v1/addresses/lookup', {
        body: { cep: '13800061', street: 'Rua Dois', district: 'Centro', city: 'Mogi Mirim', state: 'SP' },
      })
      .on(
        CREATE,
        problem(422, 'Dados inválidos', { errors: [{ path: 'problem', message: 'Descreva melhor.' }] }),
        new TypeError('offline'),
        problem(409, 'Serviço indisponível.'),
        { status: 201, body: serviceRequest() },
      );
    await mountSuspended(RequestFormPage, { route: '/agendar?servico=1', attachTo: document.body });
    await settle();
    await next();
    await fill('Aparelho', 'Freezer');
    await next();
    await fill('Problema', 'Faz muito barulho à noite.');
    await next();
    click('Adicionar data');
    await settle();
    await next();
    // Another address, typed by hand.
    (document.querySelector('input[value="other"]') as HTMLInputElement).click();
    await settle();
    await fill('CEP', '13800061');
    await fill('Rua', 'Rua Dois');
    await fill('Número', '20');
    await fill('Bairro', 'Centro');
    await fill('Cidade', 'Mogi Mirim');
    await fill('UF', 'SP');
    await next();
    submit('Enviar solicitação');
    await settle();
    expect(stepTitle()).toBe('O que está acontecendo?');
    expect(text()).toContain('Descreva melhor.');

    // The step bar goes back to an earlier step.
    click('2. Aparelho');
    await settle();
    expect(stepTitle()).toBe('Qual é o aparelho?');
    click('Voltar');
    await settle();
    expect(stepTitle()).toBe('Qual serviço você precisa?');
    for (let step = 0; step < 5; step++) await next();
    submit('Enviar solicitação');
    await settle();
    submit('Enviar solicitação');
    await settle();
    expect(text()).toContain('Serviço indisponível.');
    submit('Enviar solicitação');
    await settle();
    expect(api.called(CREATE)).toHaveLength(4);
    expect(text()).toContain('Pronto! Recebemos sua solicitação.');
  });
});

describe('visit request form for the store', () => {
  it('picks the customer and requests on their behalf', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on('GET /api/v1/service-types', { body: TYPES })
      .on('GET /api/v1/users', paged([{ ...PROFILE, role: 'CLIENT', cpf: null }]))
      .on(
        CREATE,
        problem(422, 'Dados inválidos', { errors: [{ path: 'customerId', message: 'Escolha o cliente.' }] }),
        {
          status: 201,
          body: serviceRequest(),
        },
      );
    const page = await mountSuspended(RequestFormPage, { route: '/agendar', attachTo: document.body });
    await settle();
    expect(stepTitle()).toBe('Para qual cliente é a visita?');
    await next();
    expect(text()).toContain('Escolha o cliente.');
    await fill('Cliente', 'Carla');
    await wait(350);
    await settle();
    [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('Carla Cliente'))!
      .click();
    await settle();
    click('Trocar');
    await settle();
    await fill('Cliente', 'Carla');
    await wait(350);
    await settle();
    [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('Carla Cliente'))!
      .click();
    await settle();
    await next();
    (document.querySelector('input[value="1"]') as HTMLInputElement).click();
    await settle();
    await next();
    await fill('Aparelho', 'Geladeira');
    await next();
    await fill('Problema', 'Porta não fecha direito.');
    await next();
    click('Adicionar data');
    await settle();
    await next();
    expect(text()).toContain('Endereço do cadastro do cliente');
    await next();
    expect(text()).toContain('Carla Cliente');
    submit('Enviar solicitação');
    await settle();
    expect(stepTitle()).toBe('Para qual cliente é a visita?');
    for (let step = 0; step < 6; step++) await next();
    submit('Enviar solicitação');
    await settle();
    expect((api.called(CREATE)[1]!.body as Record<string, unknown>).customerId).toBe(4);
    expect(page.find('a[href="/solicitacoes/41"]').text()).toContain('Ver solicitação');
    expect(api.called('GET /api/v1/me')).toHaveLength(0);
  });
});
