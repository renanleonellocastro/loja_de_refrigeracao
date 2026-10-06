import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfirm } from '~/composables/useConfirm';
import { useToast } from '~/composables/useToast';
import ServiceTypesPage from '~/pages/tipos-de-servico.vue';
import { useAuthStore } from '~/stores/auth';
import { serviceTypeFormFrom, serviceTypeFormToApi, validateServiceTypeForm } from '~/utils/service-types';
import { click, fill, mockApi, problem, session, submit } from '../support/api';
import { serviceType } from '../support/services';
import { ADMIN_USER, press, settle, text } from '../support/staff';

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const FRIDGE = serviceType();
const AIR = serviceType({
  id: 2,
  name: 'Instalação de ar condicionado',
  description: '',
  estimatedMinutes: 45,
  active: false,
  position: 1,
});

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  useConfirm().settle(false);
  await settle();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('service type form helpers', () => {
  it('checks the fields like the API and converts them', () => {
    expect(serviceTypeFormFrom()).toEqual({ name: '', description: '', estimatedMinutes: '60' });
    const values = serviceTypeFormFrom(FRIDGE);
    expect(values.estimatedMinutes).toBe('120');
    expect(validateServiceTypeForm(values)).toEqual({});
    expect(serviceTypeFormToApi({ ...values, name: ' Gás ', estimatedMinutes: ' 90 ' })).toEqual({
      name: 'Gás',
      description: 'Diagnóstico e reparo de geladeiras.',
      estimatedMinutes: 90,
    });

    expect(
      validateServiceTypeForm({ name: 'ab', description: 'x'.repeat(501), estimatedMinutes: '' }),
    ).toEqual({
      name: 'Informe o nome do serviço, com pelo menos 3 letras.',
      description: 'Use até 500 caracteres na descrição.',
      estimatedMinutes: 'Use um número inteiro de 15 a 1440 minutos.',
    });
    const long = { name: 'x'.repeat(81), description: '', estimatedMinutes: '1441' };
    expect(validateServiceTypeForm(long)).toEqual({
      name: 'Use até 80 letras no nome.',
      estimatedMinutes: 'Use um número inteiro de 15 a 1440 minutos.',
    });
    expect(
      validateServiceTypeForm({ ...long, name: 'Gás', estimatedMinutes: '14' }).estimatedMinutes,
    ).toBeDefined();
    expect(
      validateServiceTypeForm({ ...long, name: 'Gás', estimatedMinutes: '1.5' }).estimatedMinutes,
    ).toBeDefined();
  });
});

describe('service types page', () => {
  it('lists, creates and edits service types', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/service-types', problem(500, 'Erro.'), { body: [] }, { body: [FRIDGE, AIR] })
      .on(
        'POST /api/v1/service-types',
        problem(409, 'Serviço já cadastrado', {
          code: 'service-type-exists',
          errors: [{ path: 'name', message: 'Já existe um serviço com este nome.' }],
        }),
        { status: 201, body: FRIDGE },
      )
      .on('PATCH /api/v1/service-types/1', { body: { ...FRIDGE, name: 'Conserto de freezer' } });
    const page = await mountSuspended(ServiceTypesPage, { attachTo: document.body });
    await settle();
    expect(api.called('GET /api/v1/service-types')[0]!.url.searchParams.get('includeInactive')).toBe('true');
    click('Tentar de novo');
    await settle();
    expect(text()).toContain('Nenhum tipo de serviço ainda');

    click('Novo serviço');
    await settle();
    await fill('Duração estimada', '10');
    submit('Cadastrar serviço');
    await settle();
    expect(text()).toContain('pelo menos 3 letras');
    expect(text()).toContain('de 15 a 1440 minutos');
    await fill('Nome do serviço', ' Conserto de geladeira ');
    await fill('Descrição', 'Diagnóstico e reparo de geladeiras.');
    await fill('Duração estimada', '120');
    submit('Cadastrar serviço');
    await settle();
    expect(text()).toContain('Já existe um serviço com este nome.');
    submit('Cadastrar serviço');
    await settle();
    expect(api.called('POST /api/v1/service-types')[1]!.body).toEqual({
      name: 'Conserto de geladeira',
      description: 'Diagnóstico e reparo de geladeiras.',
      estimatedMinutes: 120,
    });
    expect(toastTitles()).toContain('Serviço Conserto de geladeira cadastrado.');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(text()).toContain('1 serviço ativo e 1 inativo');
    expect(text()).toContain('Duração estimada: 2h');
    expect(text()).toContain('Duração estimada: 45 min');
    expect(text()).toContain('Inativo');

    press('Editar Conserto de geladeira');
    await settle();
    expect(text()).toContain('Editar Conserto de geladeira');
    expect(
      document.querySelector<HTMLButtonElement>('button[form="service-type-form"]')!.textContent,
    ).toContain('Salvar alterações');
    await fill('Nome do serviço', 'Conserto de freezer');
    submit('Salvar alterações');
    await settle();
    expect(api.called('PATCH /api/v1/service-types/1')[0]!.body).toEqual({
      name: 'Conserto de freezer',
      description: 'Diagnóstico e reparo de geladeiras.',
      estimatedMinutes: 120,
    });
    expect(toastTitles()).toContain('Serviço Conserto de freezer atualizado.');

    press('Editar Conserto de geladeira');
    await settle();
    press('Fechar');
    await settle();
    press('Editar Conserto de geladeira');
    await settle();
    click('Cancelar');
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    page.unmount();
  });

  it('activates, deactivates and deletes service types', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const api = mockApi()
      .on('GET /api/v1/service-types', { body: [FRIDGE, AIR] })
      .on(
        'PATCH /api/v1/service-types/1',
        problem(500, 'Erro.'),
        { body: { ...FRIDGE, active: false } },
        { body: FRIDGE },
      )
      .on('PATCH /api/v1/service-types/2', { body: { ...AIR, active: true } })
      .on('DELETE /api/v1/service-types/1', problem(404, 'Serviço não encontrado.'), {
        body: { result: 'deactivated' },
      })
      .on('DELETE /api/v1/service-types/2', { body: { result: 'deleted' } });
    const page = await mountSuspended(ServiceTypesPage, { attachTo: document.body });
    await settle();
    expect(text()).toContain('1 serviço ativo e 1 inativo');

    press('Desativar Conserto de geladeira');
    await settle();
    expect(toastTitles()).toContain('Algo deu errado do nosso lado. Tente de novo em instantes.');
    press('Desativar Conserto de geladeira');
    await settle();
    expect(api.called('PATCH /api/v1/service-types/1')[1]!.body).toEqual({ active: false });
    expect(toastTitles()).toContain('Serviço Conserto de geladeira desativado.');
    expect(text()).toContain('2 inativos');
    expect(text()).toContain('0 serviços ativos');

    press('Ativar Instalação de ar condicionado');
    await settle();
    expect(api.called('PATCH /api/v1/service-types/2')[0]!.body).toEqual({ active: true });
    expect(toastTitles()).toContain('Serviço Instalação de ar condicionado ativado.');
    expect(text()).toContain('1 serviço ativo e 1 inativo');
    press('Ativar Conserto de geladeira');
    await settle();
    expect(text()).toContain('2 serviços ativos');
    expect(text()).not.toContain('Inativo');

    press('Excluir Conserto de geladeira');
    await settle();
    expect(useConfirm().current.value!.title).toBe('Excluir o serviço Conserto de geladeira?');
    useConfirm().settle(false);
    await settle();
    expect(api.called('DELETE /api/v1/service-types/1')).toHaveLength(0);

    press('Excluir Conserto de geladeira');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Serviço não encontrado.');

    press('Excluir Conserto de geladeira');
    await settle();
    useConfirm().settle(true);
    await settle();
    const deactivated = useToast().toasts.value.find((toast) => toast.tone === 'info')!;
    expect(deactivated.title).toBe('Serviço Conserto de geladeira desativado.');
    expect(deactivated.description).toContain('o histórico foi mantido');

    press('Excluir Instalação de ar condicionado');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Serviço Instalação de ar condicionado excluído.');
    expect(api.called('GET /api/v1/service-types')).toHaveLength(3);
    page.unmount();
  });
});
