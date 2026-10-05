import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirm } from '~/composables/useConfirm';
import { useToast } from '~/composables/useToast';
import VisitPage from '~/pages/agenda/[id].vue';
import ApprovalPage from '~/pages/aprovacoes/[id].vue';
import ApprovalsPage from '~/pages/aprovacoes/index.vue';
import TodayPage from '~/pages/hoje.vue';
import { useAuthStore } from '~/stores/auth';
import { loadDraft, saveDraft } from '~/utils/agenda';
import { MANAGER_USER, click, fill, mockApi, problem, session, submit } from '../support/api';
import { appointment, availability, report } from '../support/agenda';
import { APPOINTMENT, requestListItem, serviceRequest } from '../support/services';
import { IMAGE } from '../support/shop';
import {
  ADMIN_USER,
  EMPLOYEE_USER,
  mockUploads,
  paged,
  pickFiles,
  press,
  settle,
  stubImages,
  text,
} from '../support/staff';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const DETAIL = 'GET /api/v1/appointments/9';
const REPORT = 'POST /api/v1/appointments/9/report';
const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const exists = (selector: string) => document.querySelector(selector) !== null;

function choose(value: 'sim' | 'nao'): void {
  const radio = document.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!;
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
});

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  useConfirm().settle(false);
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('visit detail for the management', () => {
  it('shows the customer and reschedules with If-Match, reloading after a conflict', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const visit = appointment({
      report: report({ status: 'REWORK', reworkComment: 'Faltou a foto da peça.' }),
    });
    const api = mockApi()
      .on(DETAIL, { body: visit, headers: { etag: 'W/"1"' } })
      .on('GET /api/v1/service-requests/41', { body: serviceRequest() })
      .on(
        'GET /api/v1/employees/availability',
        availability([
          { appointmentId: 9, startsAt: '2026-10-07T11:00:00.000Z', endsAt: '2026-10-07T13:00:00.000Z' },
          { appointmentId: 4, startsAt: '2026-10-07T17:00:00.000Z', endsAt: '2026-10-07T18:00:00.000Z' },
        ]),
      )
      .on(
        'PATCH /api/v1/appointments/9',
        problem(412, 'Mudou.'),
        problem(409, 'O colaborador já tem um atendimento das 14:00 às 15:00.'),
        { body: appointment({ version: 2 }) },
      );
    const page = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(page.get('h2').text()).toBe('Conserto de geladeira');
    expect(text()).toContain('quarta-feira, 7 de outubro');
    expect(text()).toContain('08:00 às 10:00');
    expect(page.find('a[href="tel:19999998888"]').text()).toContain('(19) 99999-8888');
    expect(page.find('a[href*="google.com/maps"]').exists()).toBe(true);
    expect(page.find('a[href="/solicitacoes/41"]').exists()).toBe(true);
    expect(page.find('img[alt="Foto 1 do problema, abre em tamanho grande"]').exists()).toBe(true);
    expect(page.find('[data-testid="rework-comment"]').text()).toContain('Faltou a foto da peça.');
    expect(page.find('[data-testid="report-status"]').text()).toContain('Devolvido para ajuste');
    expect(text()).toContain('Relé de partida queimado.');
    expect(exists('[data-testid="report-amount"]')).toBe(false);
    expect(text()).not.toContain('Excluir');
    expect(exists('#finalizar')).toBe(false);

    click('Remarcar');
    await settle();
    expect(text()).toContain('Remarcar atendimento');
    const busy = document.querySelector('[aria-label="Horários ocupados"]')!.textContent;
    expect(busy).toContain('14:00 às 15:00');
    expect(busy).not.toContain('08:00 às 10:00');
    await fill('Início', '09:00');
    submit('Salvar alteração');
    await settle();
    expect(document.querySelector('[data-testid="schedule-error"]')!.textContent).toContain(
      'Atendimento alterado',
    );
    expect(api.called(DETAIL)).toHaveLength(2);
    submit('Salvar alteração');
    await settle();
    expect(document.querySelector('[data-testid="schedule-error"]')!.textContent).toContain(
      'Horário ocupado',
    );
    submit('Salvar alteração');
    await settle();
    expect(api.called('PATCH /api/v1/appointments/9')[2]!.body).toEqual({
      employeeId: 3,
      startsAt: '2026-10-07T12:00:00.000Z',
      endsAt: '2026-10-07T14:00:00.000Z',
    });
    expect(toastTitles()).toContain('Atendimento alterado. O cliente e o técnico foram avisados.');
    expect(text()).not.toContain('Remarcar atendimento');
    expect(api.called(DETAIL)).toHaveLength(3);

    click('Remarcar');
    await settle();
    click('Cancelar');
    await settle();
    expect(text()).not.toContain('Remarcar atendimento');
    click('Remarcar');
    await settle();
    press('Fechar');
    await settle();
    expect(text()).not.toContain('Remarcar atendimento');
    page.unmount();
  });

  it('lets the super user delete a finished visit after confirming', async () => {
    useAuthStore().apply(session(ADMIN_USER));
    const done = appointment({
      request: { status: 'COMPLETED', customer: { id: 4, name: 'Carla Cliente', phone: null } },
      report: report({ status: 'APPROVED', amountCents: 18000, defectFound: false, defectDescription: null }),
    });
    const api = mockApi()
      .on(DETAIL, { body: done })
      .on('GET /api/v1/service-requests/41', problem(500, 'Erro.'))
      .on('DELETE /api/v1/appointments/9', problem(409, 'Não dá.'), { status: 204 });
    const page = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(page.find('[data-testid="report-amount"]').text()).toBe('R$ 180,00');
    expect(page.find('a[href^="tel:"]').exists()).toBe(false);
    expect(text()).not.toContain('Remarcar');
    expect(page.find('img[alt="Foto 1 do serviço, abre em tamanho grande"]').exists()).toBe(true);
    expect(page.find('img[alt="Foto 1 do problema, abre em tamanho grande"]').exists()).toBe(false);

    click('Excluir');
    await settle();
    expect(useConfirm().current.value!.title).toBe('Excluir este atendimento da agenda?');
    useConfirm().settle(false);
    await settle();
    expect(api.called('DELETE /api/v1/appointments/9')).toHaveLength(0);

    click('Excluir');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Não dá.');
    click('Excluir');
    await settle();
    useConfirm().settle(true);
    await settle();
    expect(toastTitles()).toContain('Atendimento excluído da agenda.');
    expect(navigateMock).toHaveBeenCalledWith('/agenda');
    page.unmount();
  });

  it('explains a missing visit and a dropped connection', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on(DETAIL, problem(404, 'Não encontrado.'), new Error('offline'), { body: appointment() });
    const page = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(text()).toContain('Procuramos em todas as prateleiras');
    page.unmount();
    const again = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(text()).toContain('Tentar de novo');
    click('Tentar de novo');
    await settle();
    expect(again.get('h2').text()).toBe('Conserto de geladeira');
    again.unmount();
  });
});

describe('finalizing a service', () => {
  it('validates, keeps a draft when the network drops and sends the report with photos', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    stubImages();
    const sent = mockUploads({
      status: 201,
      body: appointment({ request: { status: 'AWAITING_COMPLETION_APPROVAL' }, report: report() }),
    });
    const api = mockApi()
      .on(
        DETAIL,
        { body: appointment() },
        { body: appointment({ request: { status: 'AWAITING_COMPLETION_APPROVAL' }, report: report() }) },
      )
      .on('GET /api/v1/service-requests/41', { body: serviceRequest() })
      .on(REPORT, new Error('offline'), problem(409, 'O serviço já foi finalizado.'), {
        body: appointment({ report: report() }),
      });
    const page = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(exists('#finalizar')).toBe(true);
    expect(text()).not.toContain('Remarcar');
    expect(text()).not.toContain('Descrição do defeito');

    submit('Finalizar serviço');
    await settle();
    expect(text()).toContain('Diga se encontrou defeito.');
    expect(text()).toContain('Conte o que foi feito, com pelo menos 5 letras.');
    choose('sim');
    await settle();
    await fill('Descrição do defeito', 'Relé');
    await fill('Reparo realizado', 'Troca do relé de partida.');
    submit('Finalizar serviço');
    await settle();
    expect(text()).toContain('Descreva o defeito, com pelo menos 5 letras.');
    await fill('Descrição do defeito', 'Relé de partida queimado.');
    pickFiles(['peca.jpg']);
    await settle();

    submit('Finalizar serviço');
    await settle();
    expect(page.find('[data-testid="report-offline"]').exists()).toBe(true);
    expect(loadDraft(9)).toEqual({
      defectFound: 'sim',
      defectDescription: 'Relé de partida queimado.',
      repairDescription: 'Troca do relé de partida.',
    });
    submit('Finalizar serviço');
    await settle();
    expect(text()).toContain('O serviço já foi finalizado.');

    submit('Finalizar serviço');
    await settle();
    expect(api.called(REPORT)[2]!.body).toEqual({
      defectFound: true,
      defectDescription: 'Relé de partida queimado.',
      repairDescription: 'Troca do relé de partida.',
    });
    expect(sent[0]!.url).toBe('http://localhost:3001/api/v1/appointments/9/report/photos');
    expect(sent[0]!.form.getAll('files')).toHaveLength(1);
    expect(toastTitles()).toContain('Serviço finalizado. A gerência vai conferir o relatório.');
    expect(loadDraft(9)).toBeNull();
    expect(exists('#finalizar')).toBe(false);
    page.unmount();
  });

  it('restores a draft, resends after a rework and warns when photos fail', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    stubImages();
    mockUploads({ status: 500, body: {} });
    saveDraft(9, { defectFound: 'nao', defectDescription: '', repairDescription: 'Limpeza do condensador.' });
    const api = mockApi()
      .on(DETAIL, { body: appointment() })
      .on(REPORT, { body: appointment({ report: report() }) });
    const page = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(page.find('[data-testid="report-draft"]').exists()).toBe(true);
    pickFiles(['antes.jpg']);
    await settle();
    submit('Finalizar serviço');
    await settle();
    expect(api.called(REPORT)[0]!.body).toEqual({
      defectFound: false,
      repairDescription: 'Limpeza do condensador.',
    });
    expect(toastTitles()).toContain('O relatório foi enviado, mas as fotos não chegaram.');
    page.unmount();

    // Sent back for rework: the form starts from the report, and a full gallery hides the photo picker.
    const photos = Array.from({ length: 8 }, (_, id) => ({ ...IMAGE, id }));
    const rework = appointment({
      report: report({
        status: 'REWORK',
        defectFound: false,
        defectDescription: null,
        reworkComment: 'Refazer.',
        photos,
      }),
    });
    mockApi()
      .on(DETAIL, { body: rework })
      .on(REPORT, { body: appointment({ report: report() }) });
    const again = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(document.querySelector<HTMLInputElement>('input[value="nao"]')!.checked).toBe(true);
    expect(exists('input[type="file"]')).toBe(false);
    submit('Finalizar serviço');
    await settle();
    expect(toastTitles()).toContain('Serviço finalizado. A gerência vai conferir o relatório.');
    again.unmount();

    const withDefect = appointment({ report: report({ status: 'REWORK' }) });
    mockApi().on(DETAIL, { body: withDefect });
    const third = await mountSuspended(VisitPage, { route: '/agenda/9', attachTo: document.body });
    await settle();
    expect(document.querySelector<HTMLInputElement>('input[value="sim"]')!.checked).toBe(true);
    third.unmount();
  });
});

describe('today of the technician', () => {
  it('lists the visits in order with call, route and finalize', async () => {
    useAuthStore().apply(session(EMPLOYEE_USER));
    const api = mockApi().on(
      'GET /api/v1/appointments',
      {
        body: [
          appointment({ id: 10, startsAt: '2026-10-05T17:00:00.000Z', endsAt: '2026-10-05T18:00:00.000Z' }),
          appointment({
            startsAt: '2026-10-05T12:00:00.000Z',
            endsAt: '2026-10-05T13:00:00.000Z',
            report: report({ status: 'REWORK', reworkComment: 'Faltou a foto da peça.' }),
          }),
          appointment({
            id: 11,
            startsAt: '2026-10-05T19:00:00.000Z',
            endsAt: '2026-10-05T20:00:00.000Z',
            request: {
              status: 'AWAITING_COMPLETION_APPROVAL',
              customer: { id: 4, name: 'Carla Cliente', phone: null },
            },
          }),
        ],
      },
      problem(500, 'Erro.'),
      { body: [appointment()] },
      { body: [] },
    );
    const page = await mountSuspended(TodayPage, { route: '/hoje', attachTo: document.body });
    await settle();
    expect(api.called('GET /api/v1/appointments')[0]!.url.searchParams.get('from')).toBe(
      '2026-10-05T03:00:00.000Z',
    );
    expect(page.find('[data-testid="today-summary"]').text()).toBe('3 visitas, 2 para finalizar.');
    const visits = page.findAll('[data-testid="today-visit"]');
    expect(visits.map((visit) => visit.find('h3 a').attributes('href'))).toEqual([
      '/agenda/9',
      '/agenda/10',
      '/agenda/11',
    ]);
    expect(visits[0]!.text()).toContain('Faltou a foto da peça.');
    expect(visits[0]!.find('a[href="tel:19999998888"]').exists()).toBe(true);
    expect(visits[0]!.find('a[href="/agenda/9#finalizar"]').exists()).toBe(true);
    expect(visits[2]!.find('a[href^="tel:"]').exists()).toBe(false);
    expect(visits[2]!.text()).not.toContain('Finalizar serviço');
    page.unmount();

    const again = await mountSuspended(TodayPage, { route: '/hoje', attachTo: document.body });
    await settle();
    click('Tentar de novo');
    await settle();
    expect(again.find('[data-testid="today-summary"]').text()).toBe('1 visita, 1 para finalizar.');
    again.unmount();

    const empty = await mountSuspended(TodayPage, { route: '/hoje', attachTo: document.body });
    await settle();
    expect(text()).toContain('Nenhuma visita hoje.');
    expect(text()).toContain('Dia livre');
    empty.unmount();
  });
});

describe('approvals', () => {
  it('approves with the value or sends the report back with a comment', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(
        'GET /api/v1/service-requests',
        paged([requestListItem({ id: 41 }), requestListItem({ id: 42 }), requestListItem({ id: 43 })]),
      )
      .on('GET /api/v1/service-requests/41', { body: serviceRequest({ appointment: APPOINTMENT }) })
      .on('GET /api/v1/service-requests/42', {
        body: serviceRequest({ id: 42, appointment: { ...APPOINTMENT, id: 10 } }),
      })
      .on('GET /api/v1/service-requests/43', { body: serviceRequest({ id: 43, appointment: null }) })
      .on(DETAIL, { body: appointment({ report: report({ submittedAt: '2026-10-05T10:00:00.000Z' }) }) })
      .on('GET /api/v1/appointments/10', {
        body: appointment({
          id: 10,
          request: { customer: { id: 5, name: 'Bia Souza', phone: null } },
          report: report({
            submittedAt: '2026-10-04T10:00:00.000Z',
            defectFound: false,
            defectDescription: null,
          }),
        }),
      })
      .on('POST /api/v1/appointments/9/report/approval', problem(409, 'Já aprovado.'), {
        body: appointment({ report: report({ status: 'APPROVED', amountCents: 18000 }) }),
      })
      .on('POST /api/v1/appointments/10/report/rework', { body: appointment({ id: 10 }) });
    const page = await mountSuspended(ApprovalsPage, { route: '/aprovacoes', attachTo: document.body });
    await settle();
    expect(api.called('GET /api/v1/service-requests')[0]!.url.searchParams.get('status')).toBe(
      'AWAITING_COMPLETION_APPROVAL',
    );
    const titles = () => page.findAll('[data-testid="approval-card"] h2').map((title) => title.text());
    expect(titles()).toEqual(['Conserto de geladeira: Bia Souza', 'Conserto de geladeira: Carla Cliente']);
    expect(page.findAll('[data-testid="approval-card"]')[0]!.text()).toContain('Não');
    expect(page.find('img[alt="Foto 1 do serviço, abre em tamanho grande"]').exists()).toBe(true);

    click('Aprovar', 1);
    await settle();
    expect(text()).toContain('Informe o valor cobrado pelo serviço.');
    const amount = document.querySelectorAll<HTMLInputElement>('[data-testid="approval-card"] input')[1]!;
    amount.value = '18000';
    amount.dispatchEvent(new Event('input'));
    await settle();
    click('Aprovar', 1);
    await settle();
    expect(toastTitles()).toContain('Já aprovado.');
    click('Aprovar', 1);
    await settle();
    expect(api.called('POST /api/v1/appointments/9/report/approval')[1]!.body).toEqual({
      amountCents: 18000,
    });
    expect(toastTitles()).toContain('Serviço aprovado e concluído.');
    expect(titles()).toEqual(['Conserto de geladeira: Bia Souza']);

    click('Devolver para ajuste');
    await settle();
    click('Voltar');
    await settle();
    click('Devolver para ajuste');
    await settle();
    click('Enviar para o técnico');
    await settle();
    expect(text()).toContain('Explique o ajuste, com pelo menos 5 letras.');
    await fill('O que o técnico precisa ajustar', 'Falta a foto da peça trocada.');
    click('Enviar para o técnico');
    await settle();
    expect(api.called('POST /api/v1/appointments/10/report/rework')[0]!.body).toEqual({
      comment: 'Falta a foto da peça trocada.',
    });
    expect(toastTitles()).toContain('Relatório devolvido ao técnico.');
    expect(text()).toContain('Nada para aprovar');
    page.unmount();

    mockApi().on('GET /api/v1/service-requests', problem(500, 'Erro.'));
    const failed = await mountSuspended(ApprovalsPage, { route: '/aprovacoes', attachTo: document.body });
    await settle();
    expect(text()).toContain('Tentar de novo');
    failed.unmount();
  });

  it('opens one report from the notification', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on(DETAIL, { body: appointment({ report: report() }) })
      .on('POST /api/v1/appointments/9/report/approval', {
        body: appointment({ report: report({ status: 'APPROVED', amountCents: 9000 }) }),
      });
    const page = await mountSuspended(ApprovalPage, { route: '/aprovacoes/9', attachTo: document.body });
    await settle();
    const amount = document.querySelector<HTMLInputElement>('[data-testid="approval-card"] input')!;
    amount.value = '9000';
    amount.dispatchEvent(new Event('input'));
    await settle();
    click('Aprovar');
    await settle();
    expect(text()).toContain('Situação: aprovado.');
    page.unmount();

    mockApi().on(DETAIL, { body: appointment() });
    const pending = await mountSuspended(ApprovalPage, { route: '/aprovacoes/9', attachTo: document.body });
    await settle();
    expect(text()).toContain('O técnico ainda não finalizou este serviço.');
    pending.unmount();

    mockApi().on(DETAIL, problem(404, 'Não encontrado.'), new Error('offline'));
    const missing = await mountSuspended(ApprovalPage, { route: '/aprovacoes/9', attachTo: document.body });
    await settle();
    expect(text()).toContain('Procuramos em todas as prateleiras');
    missing.unmount();
    const offline = await mountSuspended(ApprovalPage, { route: '/aprovacoes/9', attachTo: document.body });
    await settle();
    expect(text()).toContain('Tentar de novo');
    offline.unmount();
  });
});
