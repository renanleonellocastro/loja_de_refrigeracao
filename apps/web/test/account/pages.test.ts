import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import ConfirmEmailPage from '~/pages/confirmar-email/[token].vue';
import RegisterPage from '~/pages/criar-conta.vue';
import InvitationPage from '~/pages/definir-senha/[token].vue';
import SignInPage from '~/pages/entrar.vue';
import ForgotPage from '~/pages/esqueci-minha-senha.vue';
import NotificationsPage from '~/pages/notificacoes.vue';
import ProfilePage from '~/pages/perfil.vue';
import PrivacyPage from '~/pages/privacidade.vue';
import ResetPage from '~/pages/redefinir-senha/[token].vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);

afterEach(() => {
  useAuthStore().clear();
  useToast().clear();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('sign in page', () => {
  it('checks the fields, reports wrong credentials and goes back where the person was', async () => {
    mockApi().on('POST /api/v1/auth/sessions', problem(401, 'Email ou senha não conferem.'), {
      body: session(MANAGER_USER),
    });
    const page = await mountSuspended(SignInPage, {
      route: '/entrar?redirect=/perfil',
      attachTo: document.body,
    });
    expect(page.find('a[href="/criar-conta?redirect=%2Fperfil"]').exists()).toBe(true);
    submit('Entrar');
    await flushPromises();
    expect(page.text()).toContain('Digite um email válido');
    expect(page.text()).toContain('Digite sua senha.');
    await fill('Email', 'gerente@castro.dev');
    await fill('Senha', 'errada');
    submit('Entrar');
    await flushPromises();
    expect(page.text()).toContain('Email ou senha não conferem.');
    await fill('Senha', 'Castro-Dev-2026');
    submit('Entrar');
    await flushPromises();
    expect(toastTitles()).toContain('Olá, Marina! Que bom te ver.');
    expect(navigateMock).toHaveBeenCalledWith('/perfil', { replace: false });
    page.unmount();
  });

  it('sends someone already signed in to their area', async () => {
    mockApi();
    useAuthStore().apply(session(MANAGER_USER));
    const page = await mountSuspended(SignInPage, { route: '/entrar' });
    expect(page.find('a[href="/criar-conta"]').exists()).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('/painel', { replace: true });
    page.unmount();
  });
});

describe('registration page', () => {
  it('requires the privacy consent and creates the account', async () => {
    const api = mockApi().on('POST /api/v1/customers', { body: session() });
    const page = await mountSuspended(RegisterPage, {
      route: '/criar-conta?redirect=/carrinho',
      attachTo: document.body,
    });
    expect(page.find('a[href="/entrar?redirect=%2Fcarrinho"]').exists()).toBe(true);
    await fill('Nome completo', 'Carla Cliente');
    await fill('Email', 'carla@exemplo.com');
    await fill('Telefone', '19999998888');
    await fill('Crie uma senha', 'Senha-Forte-2026');
    await fill('Confirme a senha', 'Senha-Forte-2026');
    submit('Criar minha conta');
    await flushPromises();
    expect(page.text()).toContain('Para criar a conta, aceite a política de privacidade.');
    expect(api.calls).toHaveLength(0);
    (document.querySelector('button[role="checkbox"]') as HTMLButtonElement).click();
    await flushPromises();
    submit('Criar minha conta');
    await flushPromises();
    expect(api.calls[0]!.body).toEqual({
      name: 'Carla Cliente',
      email: 'carla@exemplo.com',
      phone: '19999998888',
      password: 'Senha-Forte-2026',
      cpf: null,
      address: null,
      acceptPrivacy: true,
    });
    expect(useAuthStore().signedIn).toBe(true);
    expect(toastTitles()).toContain('Pronto, Carla! Sua conta está criada.');
    expect(navigateMock).toHaveBeenCalledWith('/carrinho');
    page.unmount();
  });

  it('goes to the home page without a redirect', async () => {
    mockApi().on('POST /api/v1/customers', { body: session() });
    const page = await mountSuspended(RegisterPage, { route: '/criar-conta', attachTo: document.body });
    expect(page.find('a[href="/entrar"]').exists()).toBe(true);
    await fill('Nome completo', 'Carla Cliente');
    await fill('Email', 'carla@exemplo.com');
    await fill('Telefone', '19999998888');
    await fill('CPF', '52998224725');
    await fill('Crie uma senha', 'Senha-Forte-2026');
    await fill('Confirme a senha', 'Senha-Forte-2026');
    page
      .findComponent({ name: 'FormAddressFields' })
      .vm.$emit('update:modelValue', { ...PROFILE.address, complement: '' });
    (document.querySelector('button[role="checkbox"]') as HTMLButtonElement).click();
    await flushPromises();
    submit('Criar minha conta');
    await flushPromises();
    expect(navigateMock).toHaveBeenCalledWith('/');
    page.unmount();
  });
});

describe('password pages', () => {
  it('asks for a recovery link without telling whether the email exists', async () => {
    const api = mockApi().on('POST /api/v1/auth/password-resets', { status: 204 });
    const page = await mountSuspended(ForgotPage, { attachTo: document.body });
    const button = page.get('button[type="submit"]').text();
    submit(button);
    await flushPromises();
    expect(page.text()).toContain('Digite um email válido');
    await fill('Email', ' carla@exemplo.com ');
    submit(button);
    await flushPromises();
    expect(api.calls[0]!.body).toEqual({ email: 'carla@exemplo.com' });
    expect(page.text()).toContain('carla@exemplo.com');
    click('Usar outro email');
    await flushPromises();
    expect(page.find('form').exists()).toBe(true);
    page.unmount();
  });

  it('renders the reset and invitation forms with the token of the link', async () => {
    const reset = await mountSuspended(ResetPage, { route: '/redefinir-senha/abc' });
    expect(reset.text()).toContain('Crie uma nova senha');
    const invitation = await mountSuspended(InvitationPage, { route: '/definir-senha/xyz' });
    expect(invitation.text()).toContain('Boas vindas');
  });
});

describe('email confirmation page', () => {
  it('confirms, explains expired links and retries other failures', async () => {
    mockApi().on(
      'POST /api/v1/auth/email-verifications/tok',
      { status: 204 },
      problem(410, 'Link vencido.'),
      problem(500, 'Erro.'),
      { status: 204 },
    );
    useAuthStore().apply(session());
    const done = await mountSuspended(ConfirmEmailPage, {
      route: '/confirmar-email/tok',
      attachTo: document.body,
    });
    await flushPromises();
    expect(done.text()).toContain('Voltar ao perfil');
    useAuthStore().clear();
    done.unmount();
    const expired = await mountSuspended(ConfirmEmailPage, {
      route: '/confirmar-email/tok',
      attachTo: document.body,
    });
    await flushPromises();
    expect(expired.text()).toContain('Este link não vale mais');
    expired.unmount();
    const failed = await mountSuspended(ConfirmEmailPage, {
      route: '/confirmar-email/tok',
      attachTo: document.body,
    });
    await flushPromises();
    expect(failed.text()).toContain('Não deu para confirmar agora');
    click('Tentar de novo');
    await flushPromises();
    expect(failed.text()).toContain('Email confirmado');
    failed.unmount();
  });
});

describe('profile page', () => {
  it('loads the profile, keeps the tab in the address and syncs the menus after saving', async () => {
    mockApi()
      .on('GET /api/v1/me', problem(500, 'Erro.'), { body: PROFILE })
      .on('PATCH /api/v1/me', {
        body: { profile: { ...PROFILE, name: 'Carla Nova' }, emailVerificationPending: false },
      });
    useAuthStore().apply(session());
    const page = await mountSuspended(ProfilePage, {
      route: '/perfil?aba=privacidade',
      attachTo: document.body,
    });
    await flushPromises();
    expect(page.text()).toContain('Tentar de novo');
    click('Tentar de novo');
    await flushPromises();
    expect(page.get('#perfil-nome').text()).toBe('Carla Cliente');
    expect(page.text()).toContain('Conta criada em 3 de outubro de 2026');
    expect(page.text()).toContain('Baixar meus dados');
    const replace = vi.spyOn(useRouter(), 'replace').mockResolvedValue(undefined);
    const tabs = page.findComponent({ name: 'BaseTabs' });
    tabs.vm.$emit('update:modelValue', 'dados');
    tabs.vm.$emit('update:modelValue', 'seguranca');
    expect(replace.mock.calls.map(([to]) => (to as { query: { aba?: string } }).query.aba)).toEqual([
      undefined,
      'seguranca',
    ]);
    replace.mockRestore();
    page.unmount();
  });

  it('opens on the data tab and syncs the menus after saving', async () => {
    mockApi()
      .on('GET /api/v1/me', { body: PROFILE })
      .on('PATCH /api/v1/me', {
        body: { profile: { ...PROFILE, name: 'Carla Nova' }, emailVerificationPending: false },
      });
    useAuthStore().apply(session());
    const page = await mountSuspended(ProfilePage, {
      route: '/perfil?aba=desconhecida',
      attachTo: document.body,
    });
    await flushPromises();
    await fill('Nome completo', 'Carla Nova');
    submit('Salvar alterações');
    await flushPromises();
    expect(page.get('#perfil-nome').text()).toBe('Carla Nova');
    expect(useAuthStore().user!.name).toBe('Carla Nova');
    page.unmount();
  });

  it('opens the address and security tabs from the address', async () => {
    mockApi().on('GET /api/v1/me', { body: PROFILE });
    useAuthStore().apply(session());
    for (const [aba, text] of [
      ['endereco', 'Salvar endereço'],
      ['seguranca', 'Alterar senha'],
    ]) {
      const page = await mountSuspended(ProfilePage, {
        route: `/perfil?aba=${aba}`,
        attachTo: document.body,
      });
      await flushPromises();
      expect(page.text()).toContain(text);
      page.unmount();
    }
  });

  it('hides the privacy tab from the team', async () => {
    mockApi().on('GET /api/v1/me', { body: { ...PROFILE, ...MANAGER_USER } });
    useAuthStore().apply(session(MANAGER_USER));
    const page = await mountSuspended(ProfilePage, {
      route: '/perfil?aba=privacidade',
      attachTo: document.body,
    });
    await flushPromises();
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((item) => item.textContent?.trim());
    expect(tabs).toEqual(['Dados', 'Endereço', 'Segurança']);
    expect(page.text()).toContain('Seus dados');
    page.unmount();
  });
});

describe('notifications page', () => {
  const item = (id: number, read: boolean, link: string | null = null) => ({
    id,
    type: 'order.ready',
    title: `Aviso ${id}`,
    body: 'Seu pedido está pronto para retirada.',
    link,
    readAt: read ? '2026-10-03T12:00:00.000Z' : null,
    createdAt: '2026-10-03T17:30:00.000Z',
  });
  const page1 = {
    data: [item(1, false, '/pedidos/1'), item(2, true)],
    meta: { page: 1, pageSize: 20, total: 41, unread: 1 },
  };

  it('lists, opens and marks notifications as read', async () => {
    const api = mockApi()
      .on('GET /api/v1/me/notifications', problem(500, 'Erro.'), { body: page1 })
      .on('POST /api/v1/me/notifications/1/read', { status: 204 })
      .on('POST /api/v1/me/notifications/read-all', problem(500, 'Erro.'), { status: 204 });
    useAuthStore().apply(session());
    const page = await mountSuspended(NotificationsPage, { attachTo: document.body });
    await flushPromises();
    click('Tentar de novo');
    await flushPromises();
    expect(page.text()).toContain('1 não lida.');
    expect(page.text()).toContain('03/10/2026, 14:30');
    click(page.findAll('li button')[0]!.text());
    await flushPromises();
    expect(api.called('POST /api/v1/me/notifications/1/read')).toHaveLength(1);
    expect(navigateMock).toHaveBeenCalledWith('/pedidos/1');
    (page.findAll('li button')[1]!.element as HTMLButtonElement).click();
    await flushPromises();
    expect(navigateMock).toHaveBeenCalledTimes(1);

    page.vm.$.setupState.count = 2;
    await flushPromises();
    expect(page.text()).toContain('2 não lidas.');
    click('Marcar todas como lidas');
    await flushPromises();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    click('Marcar todas como lidas');
    await flushPromises();
    expect(toastTitles()).toContain('Pronto! Tudo marcado como lido.');
    expect(page.text()).toContain('Nenhuma notificação nova.');

    const next = page.find('button[aria-label*="2"]');
    await next.trigger('click');
    await flushPromises();
    expect(api.called('GET /api/v1/me/notifications').at(-1)!.url.searchParams.get('page')).toBe('2');
    page.unmount();
  });

  it('still follows the link when marking as read fails and shows the empty state', async () => {
    mockApi()
      .on(
        'GET /api/v1/me/notifications',
        {
          body: {
            data: [item(3, false, '/orcamentos/3')],
            meta: { page: 1, pageSize: 20, total: 1, unread: 1 },
          },
        },
        { body: { data: [], meta: { page: 1, pageSize: 20, total: 0, unread: 0 } } },
      )
      .on('POST /api/v1/me/notifications/3/read', new TypeError('offline'))
      .on('POST /api/v1/me/notifications/read-all', { status: 204 });
    useAuthStore().apply(session());
    const page = await mountSuspended(NotificationsPage, { attachTo: document.body });
    await flushPromises();
    (page.find('li button').element as HTMLButtonElement).click();
    await flushPromises();
    expect(navigateMock).toHaveBeenCalledWith('/orcamentos/3');
    click('Marcar todas como lidas');
    await flushPromises();
    expect(page.text()).not.toContain('Não lida.');
    page.unmount();
    const empty = await mountSuspended(NotificationsPage, { attachTo: document.body });
    await flushPromises();
    expect(empty.text()).toContain('Nenhuma notificação por aqui');
    empty.unmount();
  });
});

describe('privacy policy page', () => {
  it('shows the version and the data controller', async () => {
    const page = await mountSuspended(PrivacyPage);
    expect(page.get('h1').text()).toBe('Política de privacidade');
    expect(page.text()).toContain('Versão de 03/10/2026');
    expect(page.text()).toContain('refrigeracaocastro@yahoo.com.br');
  });
});
