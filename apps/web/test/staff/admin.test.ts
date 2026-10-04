import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePagedList } from '~/composables/usePagedList';
import { useToast } from '~/composables/useToast';
import AuditPage from '~/pages/auditoria.vue';
import SettingsPage from '~/pages/configuracoes.vue';
import { useAuthStore } from '~/stores/auth';
import {
  WEEKDAYS,
  auditActionLabel,
  auditResourceLabel,
  dayBoundary,
  parseEmailList,
  prettyJson,
  storeFormFrom,
  storeFormToApi,
  validateStoreForm,
  type StoreSettings,
} from '~/utils/staff';
import { PROFILE, click, fill, mockApi, problem, session, submit } from '../support/api';

const ADMIN_USER = { id: 1, name: 'Eduardo Castro', email: 'admin@castro.dev', role: 'ADMIN' as const };
const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const text = () => document.body.textContent ?? '';

afterEach(() => {
  useAuthStore().clear();
  useToast().clear();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const SETTINGS: StoreSettings = {
  name: 'Refrigeração Castro',
  legalName: 'Refrigeração Castro Ltda ME',
  cnpj: '63060560000151',
  phone: '1938041658',
  whatsapp: null,
  email: 'contato@castro.dev',
  address: { ...PROFILE.address },
  openingHours: {
    '0': null,
    '1': { opens: '09:00', closes: '18:00' },
    '2': { opens: '09:00', closes: '18:00' },
    '3': { opens: '09:00', closes: '18:00' },
    '4': { opens: '09:00', closes: '18:00' },
    '5': { opens: '09:00', closes: '18:00' },
    '6': { opens: '08:00', closes: '12:00' },
  },
  openNow: true,
  notificationEmails: ['gerente@castro.dev'],
  defaultStockMin: 2,
};

describe('staff helpers', () => {
  it('describes audit entries and filters', () => {
    expect(auditActionLabel('product.update')).toBe('Alteração');
    expect(auditActionLabel('markReady')).toBe('markReady');
    expect(auditResourceLabel('user')).toBe('Usuários');
    expect(auditResourceLabel('other')).toBe('other');
    expect(prettyJson(null)).toBe('—');
    expect(prettyJson(undefined)).toBe('—');
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(dayBoundary('', false)).toBeUndefined();
    expect(dayBoundary('2026-10-03', false)).toBe('2026-10-03T00:00:00.000-03:00');
    expect(dayBoundary('2026-10-03', true)).toBe('2026-10-03T23:59:59.999-03:00');
    expect(parseEmailList('a@x.com, b@x.com\n\n c@x.com;')).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });

  it('checks the store settings like the API', () => {
    const values = storeFormFrom(SETTINGS);
    expect(validateStoreForm(values)).toEqual({});
    expect(storeFormToApi(values).whatsapp).toBeNull();
    values.openingHours['1'] = { open: true, opens: '', closes: '18:00' };
    values.openingHours['2'] = { open: true, opens: '09:00', closes: '' };
    values.openingHours['3'] = { open: true, opens: '18:00', closes: '09:00' };
    values.whatsapp = '123';
    values.phone = '';
    values.name = 'X';
    values.email = 'x';
    values.notificationEmails = Array.from({ length: 11 }, (_, i) => `p${i}@x.com`).join('\n');
    values.defaultStockMin = '1001';
    expect(validateStoreForm(values)).toMatchObject({
      'openingHours.1.opens': 'Informe quando abre na Segunda.',
      'openingHours.2.closes': 'Informe quando fecha na Terça.',
      'openingHours.3.closes': 'O fechamento precisa ser depois da abertura.',
      whatsapp: expect.any(String),
      phone: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      notificationEmails: 'Use até 10 emails.',
      defaultStockMin: expect.any(String),
    });
    values.notificationEmails = 'bom@x.com\nruim';
    values.defaultStockMin = '-1';
    expect(validateStoreForm(values)).toMatchObject({
      notificationEmails: 'Confira o email ruim.',
      defaultStockMin: 'Use um número inteiro de 0 a 1000.',
    });
    expect(WEEKDAYS.map((day) => day.key)).toEqual(['1', '2', '3', '4', '5', '6', '0']);
  });

  it('applies only the newest answer of a paginated list', async () => {
    const pending: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
    const list = usePagedList<number>(
      () => new Promise((resolve, reject) => pending.push({ resolve: resolve as never, reject })),
      10,
    );
    void list.load();
    void list.load();
    pending[1]!.resolve({ data: [2], meta: { total: 25 } });
    await flushPromises();
    pending[0]!.resolve({ data: [1], meta: { total: 1 } });
    await flushPromises();
    expect(list.rows.value).toEqual([2]);
    expect(list.pages.value).toBe(3);
    void list.load();
    void list.load();
    pending[3]!.resolve({ data: [4], meta: { total: 1 } });
    await flushPromises();
    pending[2]!.reject(new Error('lenta'));
    await flushPromises();
    expect(list.failed.value).toBe(false);
    expect(list.loading.value).toBe(false);
    void list.load();
    pending[4]!.reject(new Error('falhou'));
    await flushPromises();
    expect(list.failed.value).toBe(true);
  });
});

const log = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  actorId: 1,
  action: 'product.update',
  resourceType: 'product',
  resourceId: '12',
  before: { priceCents: 1000 },
  after: { priceCents: 1200 },
  ip: '127.0.0.1',
  createdAt: '2026-10-03T15:00:00.000Z',
  ...extra,
});
const page = (rows: unknown[], total = rows.length) => ({
  body: { data: rows, meta: { page: 1, pageSize: 20, total } },
});

describe('audit page', () => {
  it('lists the actions with author names and filters them', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/users', page([{ ...PROFILE, id: 1, name: 'Eduardo Castro' }]), problem(500, 'Erro.'))
      .on(
        'GET /api/v1/audit-logs',
        page(
          [
            log(1),
            log(2, { actorId: null, resourceId: null, ip: null, before: null, action: 'store.update' }),
            log(3, { actorId: 99 }),
          ],
          45,
        ),
        page([log(4)], 45),
        page([]),
        problem(500, 'Erro.'),
        page([]),
      );
    const wrapper = await mountSuspended(AuditPage, { attachTo: document.body });
    expect(wrapper.text()).toContain('Carregando auditoria…');
    await flushPromises();
    expect(wrapper.text()).toContain('Alteração em Produtos nº 12');
    expect(wrapper.text()).toContain('Eduardo Castro');
    expect(wrapper.text()).toContain('Sistema');
    expect(wrapper.text()).toContain('Pessoa nº 99');
    expect(wrapper.text()).toContain('IP não registrado');
    expect(wrapper.text()).toContain('"priceCents": 1200');

    (document.querySelector('button[aria-label="Próxima página"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(api.called('GET /api/v1/audit-logs')[1]!.url.searchParams.get('page')).toBe('2');

    await fill('De', '2026-10-01');
    await flushPromises();
    const filtered = api.called('GET /api/v1/audit-logs')[2]!.url.searchParams;
    expect(filtered.get('page')).toBe('1');
    expect(filtered.get('from')).toBe('2026-10-01T00:00:00.000-03:00');
    expect(wrapper.text()).toContain('Nenhum registro com esses filtros');

    document
      .querySelector('form[aria-label="Filtros da auditoria"]')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    wrapper.findAllComponents({ name: 'BaseSelect' })[0]!.vm.$emit('update:modelValue', 'user');
    wrapper.findAllComponents({ name: 'BaseSelect' })[1]!.vm.$emit('update:modelValue', '1');
    await fill('Até', '2026-10-03');
    await flushPromises();
    const all = api.called('GET /api/v1/audit-logs').at(-1)!.url.searchParams;
    expect(all.get('resourceType')).toBe('user');
    expect(all.get('actorId')).toBe('1');
    expect(all.get('to')).toBe('2026-10-03T23:59:59.999-03:00');
    expect(wrapper.text()).toContain('Algo esquentou por aqui');

    click('Limpar filtros');
    await flushPromises();
    expect(wrapper.text()).toContain('Nenhuma ação registrada ainda');
    expect(text()).not.toContain('Limpar filtros');
    wrapper.unmount();
  });
});

describe('store settings page', () => {
  it('loads, checks and saves the store settings', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const saved = {
      ...SETTINGS,
      whatsapp: '19999998888',
      openingHours: { ...SETTINGS.openingHours, '6': null },
    };
    const api = mockApi()
      .on('GET /api/v1/store/settings', problem(500, 'Erro.'), { body: SETTINGS })
      .on('PATCH /api/v1/store', { body: saved });
    const wrapper = await mountSuspended(SettingsPage, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.text()).toContain('Algo esquentou por aqui');
    click('Tentar de novo');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Carregando configurações…');
    await flushPromises();
    expect(wrapper.text()).toContain('CNPJ 63.060.560/0001-51');
    expect(wrapper.text()).toContain('Fechado');

    await fill('Fecha na Segunda', '08:00');
    submit('Salvar configurações');
    await flushPromises();
    expect(text()).toContain('O fechamento precisa ser depois da abertura.');
    expect(api.called('PATCH /api/v1/store')).toHaveLength(0);

    await fill('Fecha na Segunda', '18:00');
    await fill('Abre na Segunda', '08:30');
    await fill('Nome da loja', 'Castro Refrigeração');
    await fill('Telefone', '1938041659');
    await fill('Email de contato', 'loja@castro.dev');
    await fill('Emails que recebem', 'gerente@castro.dev\nadmin@castro.dev');
    await fill('Estoque mínimo padrão', '3');
    await fill('WhatsApp', '19999998888');
    wrapper
      .findComponent({ name: 'FormAddressFields' })
      .vm.$emit('update:modelValue', { ...PROFILE.address, complement: '' });
    (document.querySelectorAll('button[role="switch"]')[5] as HTMLButtonElement).click();
    await flushPromises();
    submit('Salvar configurações');
    await flushPromises();
    expect(api.called('PATCH /api/v1/store')[0]!.body).toMatchObject({
      whatsapp: '19999998888',
      notificationEmails: ['gerente@castro.dev', 'admin@castro.dev'],
      defaultStockMin: 3,
      name: 'Castro Refrigeração',
      phone: '1938041659',
      email: 'loja@castro.dev',
      openingHours: { '0': null, '1': { opens: '08:30', closes: '18:00' }, '6': null },
      address: { cep: '13800061', complement: null },
    });
    expect(toastTitles()).toContain('Pronto! As configurações da loja foram salvas.');
    wrapper.unmount();
  });
});
