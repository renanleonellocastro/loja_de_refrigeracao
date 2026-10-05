import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import QuoteFormPage from '~/pages/orcamento.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';
import { quote } from '../support/quotes';
import { serviceType } from '../support/services';
import { mockUploads, paged, pickFiles, settle, stubImages, text, wait } from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const CREATE = 'POST /api/v1/quotes';
const TYPES = [
  serviceType(),
  serviceType({ id: 2, name: 'Instalação de ar condicionado' }),
  serviceType({ id: 3, active: false }),
];

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

async function send(): Promise<void> {
  submit('Pedir orçamento');
  await settle();
}

describe('quote request form for customers', () => {
  it('validates, sends and uploads the photos', async () => {
    useAuthStore().apply(session());
    stubImages();
    const uploads = mockUploads({ status: 201, body: [] });
    const api = mockApi()
      .on('GET /api/v1/service-types', { body: TYPES })
      .on(CREATE, { status: 201, body: quote() });
    const page = await mountSuspended(QuoteFormPage, {
      route: '/orcamento?servico=2',
      attachTo: document.body,
    });
    await settle();
    expect(page.findAll('input[name="serviceTypeId"]')).toHaveLength(2);
    expect(page.find<HTMLInputElement>('input[value="2"]').element.checked).toBe(true);
    expect(text()).not.toContain('Cliente');

    await send();
    expect(text()).toContain('pelo menos 10 letras');
    expect(api.called(CREATE)).toHaveLength(0);
    await fill('Descrição', 'Instalar um split de 12.000 BTUs na sala.');
    pickFiles(['sala.jpg']);
    await settle();
    await send();
    await wait(5);
    await settle();

    const call = api.called(CREATE)[0]!;
    expect(call.body).toEqual({ serviceTypeId: 2, description: 'Instalar um split de 12.000 BTUs na sala.' });
    expect(uploads[0]!.url).toContain('/api/v1/quotes/31/photos');
    expect(uploads[0]!.form.getAll('files')).toHaveLength(1);
    expect(text()).toContain('Pronto! Pedido de orçamento enviado.');
    expect(page.find('[data-testid="quote-number"]').text()).toBe('31');
    expect(page.find('a[href="/minha-conta/orcamentos/31"]').text()).toContain('Ver orçamento');

    click('Pedir outro orçamento');
    await settle();
    await send();
    expect(text()).toContain('Escolha o serviço.');
  });

  it('retries the service types, retries after a dropped connection and warns when photos fail', async () => {
    useAuthStore().apply(session());
    stubImages();
    mockUploads({ status: 500, body: { title: 'Erro.' } });
    const api = mockApi()
      .on('GET /api/v1/service-types', problem(500, 'Erro.'), { body: TYPES })
      .on(
        CREATE,
        new TypeError('offline'),
        problem(422, 'Dados inválidos', { errors: [{ path: 'description', message: 'Descreva melhor.' }] }),
        { status: 201, body: quote({ id: 32 }) },
      );
    const page = await mountSuspended(QuoteFormPage, { route: '/orcamento', attachTo: document.body });
    await settle();
    click('Tentar de novo');
    await settle();
    (document.querySelector('input[value="1"]') as HTMLInputElement).click();
    await fill('Descrição', 'Geladeira faz barulho alto.');
    pickFiles(['a.jpg']);
    await settle();
    await send();
    expect(text()).toContain('Não conseguimos falar com a loja agora');
    await send();
    expect(text()).toContain('Descreva melhor.');
    await send();
    await wait(5);
    await settle();
    expect(api.called(CREATE)).toHaveLength(3);
    expect(text()).toContain('as fotos não chegaram');
    expect(page.find('a[href="/minha-conta/orcamentos/32"]').exists()).toBe(true);
  });
});

describe('quote request form for the store', () => {
  it('picks the customer and asks on their behalf without photos', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const uploads = mockUploads({ status: 201, body: [] });
    const api = mockApi()
      .on('GET /api/v1/service-types', { body: TYPES })
      .on('GET /api/v1/users', paged([{ ...PROFILE, role: 'CLIENT', cpf: null }]))
      .on(CREATE, { status: 201, body: quote() });
    const page = await mountSuspended(QuoteFormPage, { route: '/orcamento', attachTo: document.body });
    await settle();
    await send();
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
    await send();
    expect(text()).toContain('Escolha o cliente.');
    await fill('Cliente', 'Carla');
    await wait(350);
    await settle();
    [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('Carla Cliente'))!
      .click();
    await settle();
    (document.querySelector('input[value="1"]') as HTMLInputElement).click();
    await fill('Descrição', 'Freezer horizontal não gela.');
    await send();
    expect((api.called(CREATE)[0]!.body as Record<string, unknown>).customerId).toBe(4);
    expect(uploads).toHaveLength(0);
    expect(page.find('a[href="/orcamentos/31"]').exists()).toBe(true);
  });
});
