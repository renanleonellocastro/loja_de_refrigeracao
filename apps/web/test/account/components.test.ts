import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import NewPasswordForm from '~/components/auth/NewPasswordForm.vue';
import AddressFields from '~/components/form/AddressFields.vue';
import NotificationBell from '~/components/layout/NotificationBell.vue';
import SiteDrawer from '~/components/layout/SiteDrawer.vue';
import SiteHeader from '~/components/layout/SiteHeader.vue';
import UserMenu from '~/components/layout/UserMenu.vue';
import AddressTab from '~/components/profile/AddressTab.vue';
import DataTab from '~/components/profile/DataTab.vue';
import PrivacyTab from '~/components/profile/PrivacyTab.vue';
import SecurityTab from '~/components/profile/SecurityTab.vue';
import { useUnreadCount } from '~/composables/useNotifications';
import { useToast } from '~/composables/useToast';
import AuthLayout from '~/layouts/auth.vue';
import { useAuthStore } from '~/stores/auth';
import { emptyAddress, type AddressForm } from '~/utils/address';
import { MANAGER_USER, PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);

afterEach(() => {
  useAuthStore().clear();
  useToast().clear();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('AddressFields', () => {
  it('fills the address from the CEP and explains when it is unknown', async () => {
    const api = mockApi().on(
      'GET /api/v1/addresses/lookup',
      {
        body: {
          cep: '13800061',
          street: 'Rua Doutor Ulhoa Cintra',
          district: 'Centro',
          city: 'Mogi Mirim',
          state: 'SP',
        },
      },
      problem(404, 'CEP não encontrado.'),
    );
    const address = ref<AddressForm>(emptyAddress());
    const Host = defineComponent({
      setup: () => () =>
        h(AddressFields, {
          modelValue: address.value,
          'onUpdate:modelValue': (value: AddressForm) => (address.value = value),
          errors: { 'address.number': 'Informe o número.' },
          required: true,
        }),
    });
    const wrapper = await mountSuspended(Host, { attachTo: document.body });
    expect(wrapper.text()).toContain('Digite o CEP e a gente completa.');
    expect(wrapper.text()).toContain('Informe o número.');
    await fill('CEP', '1380');
    expect(api.calls).toHaveLength(0);
    await fill('CEP', '13800061');
    await flushPromises();
    expect(api.calls[0]!.url.searchParams.get('cep')).toBe('13800061');
    expect(address.value).toMatchObject({
      street: 'Rua Doutor Ulhoa Cintra',
      city: 'Mogi Mirim',
      state: 'SP',
    });
    expect(wrapper.text()).toContain('Achamos!');
    expect(document.activeElement?.getAttribute('inputmode')).toBe('numeric');
    address.value = { ...address.value, number: '91' };
    await flushPromises();
    expect(api.calls).toHaveLength(1);
    await fill('UF', 'RJ');
    await fill('Complemento', 'Fundos');
    expect(address.value.complement).toBe('Fundos');
    expect(address.value.state).toBe('RJ');
    await fill('CEP', '99999999');
    await flushPromises();
    expect(wrapper.text()).toContain('Não achamos esse CEP');
    wrapper.unmount();
  });
});

describe('NewPasswordForm', () => {
  it('saves a new password and signs in', async () => {
    const api = mockApi().on('POST /api/v1/auth/password-resets/abc', { body: session(MANAGER_USER) });
    await mountSuspended(NewPasswordForm, {
      props: { kind: 'reset', token: 'abc' },
      attachTo: document.body,
    });
    submit('Salvar nova senha');
    await flushPromises();
    expect(api.calls).toHaveLength(0);
    expect(document.body.textContent).toContain('Use pelo menos');
    await fill('Nova senha', 'Senha-Forte-2026');
    await fill('Confirme a nova senha', 'Senha-Forte-2026');
    submit('Salvar nova senha');
    await flushPromises();
    expect(api.calls[0]!.body).toEqual({ password: 'Senha-Forte-2026' });
    expect(useAuthStore().actor).toBe('MANAGER');
    expect(navigateMock).toHaveBeenCalledWith('/painel');
  });

  it('explains used invitations and shows other errors', async () => {
    mockApi().on(
      'POST /api/v1/auth/invitations/xyz',
      problem(422, 'Senha fraca.', { errors: [{ path: 'password', message: 'Escolha outra senha.' }] }),
      problem(410, 'Convite vencido.'),
    );
    await mountSuspended(NewPasswordForm, {
      props: { kind: 'invitation', token: 'xyz' },
      attachTo: document.body,
    });
    expect(document.body.textContent).toContain('Boas vindas');
    await fill('Nova senha', 'Senha-Forte-2026');
    await fill('Confirme a nova senha', 'Senha-Forte-2026');
    submit('Criar senha e entrar');
    await flushPromises();
    expect(document.body.textContent).toContain('Escolha outra senha.');
    submit('Criar senha e entrar');
    await flushPromises();
    expect(document.body.textContent).toContain('Este link não vale mais');
  });
});

describe('NotificationBell', () => {
  it('shows the unread count and refreshes every minute', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const api = mockApi().on('GET /api/v1/me/notifications', {
      body: { data: [], meta: { page: 1, pageSize: 1, total: 120, unread: 120 } },
    });
    useAuthStore().apply(session());
    const wrapper = await mountSuspended(NotificationBell);
    await flushPromises();
    expect(wrapper.get('a').attributes('aria-label')).toBe('Notificações, 120 não lidas');
    expect(wrapper.get('[data-testid="unread-badge"]').text()).toBe('99+');
    useUnreadCount().count.value = 1;
    await flushPromises();
    expect(wrapper.get('a').attributes('aria-label')).toBe('Notificações, 1 não lida');
    expect(wrapper.get('[data-testid="unread-badge"]').text()).toBe('1');
    const before = api.calls.length;
    vi.advanceTimersByTime(60_000);
    await flushPromises();
    expect(api.calls.length).toBe(before + 1);
    useAuthStore().clear();
    await flushPromises();
    expect(wrapper.get('a').attributes('aria-label')).toBe('Notificações');
    wrapper.unmount();
  });
});

describe('signed in chrome', () => {
  it('shows the account link and signs out from the drawer', async () => {
    mockApi().on('DELETE /api/v1/auth/sessions/current', { status: 204 });
    useAuthStore().apply(session());
    const header = await mountSuspended(SiteHeader);
    expect(header.text()).toContain('Minha conta');
    expect(header.find('a[href="/perfil"]').exists()).toBe(true);
    const drawer = await mountSuspended(SiteDrawer, { props: { open: true }, attachTo: document.body });
    useAuthStore().updateUser({ name: 'Carla Nova' });
    await flushPromises();
    click('Sair');
    await flushPromises();
    expect(useAuthStore().signedIn).toBe(false);
    expect(toastTitles()).toContain('Você saiu da sua conta. Até logo!');
    drawer.unmount();
  });

  it('signs out from the account menu', async () => {
    mockApi().on('DELETE /api/v1/auth/sessions/current', { status: 204 });
    useAuthStore().apply(session(MANAGER_USER));
    const wrapper = await mountSuspended(UserMenu, { attachTo: document.body });
    const trigger = wrapper.get('button[aria-label="Menu da conta"]');
    expect(trigger.text()).toContain('Marina Gerente');
    await trigger.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    const sair = [...document.querySelectorAll('[role="menuitem"]')].find((i) =>
      i.textContent?.includes('Sair'),
    );
    (sair as HTMLElement).click();
    await flushPromises();
    expect(useAuthStore().signedIn).toBe(false);
    expect(navigateMock).toHaveBeenCalledWith('/');
    wrapper.unmount();
  });

  it('renders the auth layout around the page', async () => {
    const wrapper = await mountSuspended(AuthLayout, { slots: { default: () => h('p', 'Formulário') } });
    expect(wrapper.text()).toContain('Formulário');
    expect(wrapper.text()).toContain('Política de privacidade');
  });
});

describe('profile tabs', () => {
  it('saves personal data and warns about a new email', async () => {
    const api = mockApi().on(
      'PATCH /api/v1/me',
      { body: { profile: { ...PROFILE, name: 'Carla Nova' }, emailVerificationPending: false } },
      { body: { profile: PROFILE, emailVerificationPending: true } },
    );
    const wrapper = await mountSuspended(DataTab, { props: { profile: PROFILE }, attachTo: document.body });
    await fill('Nome completo', 'Carla Nova');
    await fill('Telefone', '19988887777');
    await fill('CPF', '52998224725');
    submit('Salvar alterações');
    await flushPromises();
    expect(api.calls[0]!.body).toEqual({
      name: 'Carla Nova',
      email: 'cliente@castro.dev',
      phone: '19988887777',
      cpf: '52998224725',
    });
    expect(wrapper.emitted('saved')![0]![0]).toMatchObject({ name: 'Carla Nova' });
    expect(toastTitles()).toContain('Pronto! Seus dados foram atualizados.');
    await fill('Email', 'nova@exemplo.com');
    submit('Salvar alterações');
    await flushPromises();
    expect(toastTitles()).toContain('Dados salvos. Falta confirmar o email novo.');
    wrapper.unmount();
  });

  it('lets the team leave the phone blank', async () => {
    const api = mockApi().on('PATCH /api/v1/me', {
      body: { profile: PROFILE, emailVerificationPending: false },
    });
    const team = { ...PROFILE, ...MANAGER_USER, phone: null, cpf: '52998224725' };
    const wrapper = await mountSuspended(DataTab, { props: { profile: team }, attachTo: document.body });
    expect(wrapper.text()).toContain('Opcional.');
    submit('Salvar alterações');
    await flushPromises();
    expect(api.calls[0]!.body).toMatchObject({ phone: null, cpf: '52998224725' });
    wrapper.unmount();
  });

  it('saves and removes the address', async () => {
    const api = mockApi().on(
      'PATCH /api/v1/me',
      { body: { profile: PROFILE, emailVerificationPending: false } },
      { body: { profile: { ...PROFILE, address: null }, emailVerificationPending: false } },
    );
    const wrapper = await mountSuspended(AddressTab, {
      props: { profile: PROFILE },
      attachTo: document.body,
    });
    submit('Salvar endereço');
    await flushPromises();
    expect(api.calls[0]!.body).toEqual({ address: { ...PROFILE.address } });
    expect(toastTitles()).toContain('Pronto! Endereço salvo.');
    wrapper
      .findComponent(AddressFields)
      .vm.$emit('update:modelValue', { ...PROFILE.address, complement: '' });
    await flushPromises();
    for (const label of ['CEP', 'Rua', 'Número', 'Bairro', 'Cidade']) await fill(label, '');
    await fill('UF', '');
    submit('Salvar endereço');
    await flushPromises();
    expect(api.calls[1]!.body).toEqual({ address: null });
    expect(toastTitles()).toContain('Endereço removido.');
    wrapper.unmount();
  });

  it('changes the password', async () => {
    const api = mockApi().on(
      'PUT /api/v1/me/password',
      problem(422, 'Senha atual não confere.', {
        errors: [{ path: 'currentPassword', message: 'A senha atual não confere.' }],
      }),
      { status: 204 },
    );
    const wrapper = await mountSuspended(SecurityTab, { attachTo: document.body });
    submit('Alterar senha');
    await flushPromises();
    expect(wrapper.text()).toContain('Digite a senha que você usa hoje.');
    await fill('Senha atual', 'errada');
    await fill('Nova senha', 'Senha-Forte-2026');
    await fill('Confirme a nova senha', 'Senha-Forte-2026');
    submit('Alterar senha');
    await flushPromises();
    expect(wrapper.text()).toContain('A senha atual não confere.');
    await fill('Senha atual', 'Castro-Dev-2026');
    submit('Alterar senha');
    await flushPromises();
    expect(api.calls[1]!.body).toEqual({
      currentPassword: 'Castro-Dev-2026',
      newPassword: 'Senha-Forte-2026',
    });
    expect(toastTitles()).toContain('Senha alterada!');
    expect((document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement).value).toBe(
      '',
    );
    wrapper.unmount();
  });

  it('exports the data as a file', async () => {
    mockApi().on('GET /api/v1/me/data-export', { body: { profile: PROFILE } }, problem(500, 'Erro.'));
    const createObjectURL = vi.fn(() => 'blob:dados');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = await mountSuspended(PrivacyTab, { attachTo: document.body });
    click('Baixar meus dados');
    await flushPromises();
    expect(createObjectURL).toHaveBeenCalled();
    expect(clicked).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:dados');
    expect(toastTitles()).toContain('Pronto! Baixamos o arquivo com os seus dados.');
    click('Baixar meus dados');
    await flushPromises();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    clicked.mockRestore();
    wrapper.unmount();
  });

  it('deletes the account after the password', async () => {
    const api = mockApi().on('DELETE /api/v1/me', problem(401, 'A senha não confere.'), { status: 204 });
    useAuthStore().apply(session());
    const wrapper = await mountSuspended(PrivacyTab, { attachTo: document.body });
    click('Excluir minha conta');
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Excluir sua conta?');
    submit('Excluir minha conta');
    await flushPromises();
    expect(document.body.textContent).toContain('Digite sua senha para confirmar.');
    await fill('Sua senha', 'errada');
    submit('Excluir minha conta');
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('A senha não confere.');
    click('Cancelar');
    await flushPromises();
    click('Excluir minha conta');
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    click('Excluir minha conta');
    await flushPromises();
    await fill('Sua senha', 'Castro-Dev-2026');
    submit('Excluir minha conta');
    await flushPromises();
    expect(api.calls.at(-1)!.body).toEqual({ password: 'Castro-Dev-2026' });
    expect(useAuthStore().signedIn).toBe(false);
    expect(navigateMock).toHaveBeenCalledWith('/');
    wrapper.unmount();
  });
});
