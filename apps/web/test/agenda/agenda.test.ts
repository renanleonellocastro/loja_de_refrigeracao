import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import AgendaPage from '~/pages/agenda/index.vue';
import { useAuthStore } from '~/stores/auth';
import { MANAGER_USER, click, fill, mockApi, problem, session, submit } from '../support/api';
import {
  appointment,
  availability,
  calendar,
  clickEvent,
  dropEvent,
  resizeTo,
  showWeek,
} from '../support/agenda';
import { serviceRequest, serviceType } from '../support/services';
import { EMPLOYEE_USER, press, settle, text } from '../support/staff';

vi.mock('@fullcalendar/vue3', async () => ({
  default: (await import('../support/agenda')).FullCalendarStub,
}));

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const LIST = 'GET /api/v1/appointments';
const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const input = (label: string) => {
  const element = [...document.querySelectorAll('label')].find((item) =>
    item.textContent?.replace('*', '').trim().startsWith(label),
  )!;
  return document.getElementById(element.htmlFor) as HTMLInputElement;
};

/** Picks the technician in the scheduling dialog (the page filter has the same label). */
async function pickTechnician(value: string): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await settle();
}

function swipe(fromX: number, toX: number, toY = 0): void {
  const section = document.querySelector('section[aria-labelledby="agenda-day-title"]')!;
  section.dispatchEvent(
    Object.assign(new Event('touchstart'), { touches: [{ clientX: fromX, clientY: 0 }] }),
  );
  section.dispatchEvent(
    Object.assign(new Event('touchend'), { changedTouches: [{ clientX: toX, clientY: toY }] }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
});

afterEach(async () => {
  useAuthStore().clear();
  useToast().clear();
  await settle();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resizeTo(1024);
  calendar.options = null;
  document.body.innerHTML = '';
});

describe('agenda for the management on desktop', () => {
  it('filters by technician, opens visits and moves them by drag and drop', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    const visits = [appointment(), appointment({ id: 10, employee: { id: 5, name: 'Bruno Técnico' } })];
    const api = mockApi()
      .on('GET /api/v1/employees/availability', availability())
      .on(LIST, { body: visits }, problem(500, 'Erro.'), { body: visits })
      .on(
        'PATCH /api/v1/appointments/9',
        { body: appointment({ version: 2 }) },
        problem(412, 'Mudou.'),
        problem(409, 'O colaborador já tem um atendimento das 09:00 às 11:00.'),
        new Error('offline'),
      );
    const page = await mountSuspended(AgendaPage, { route: '/agenda?tecnico=3', attachTo: document.body });
    await settle();
    expect(api.called(LIST)).toHaveLength(0);
    expect(text()).toContain('Atendimentos de toda a equipe');
    expect(document.querySelector('[aria-label="Cores dos técnicos"]')!.textContent).toContain(
      'Bruno Técnico',
    );
    expect(calendar.options!.initialView).toBe('timeGridWeek');
    expect(calendar.options!.headerToolbar).toMatchObject({
      right: 'timeGridWeek,dayGridMonth,timeGridDay,listWeek',
    });
    expect(calendar.options!.editable).toBe(true);
    expect((calendar.options!.now as () => string)()).toBe('2026-10-05T09:00:00');

    showWeek('2026-10-04');
    await settle();
    const query = api.called(LIST)[0]!.url.searchParams;
    expect(query.get('from')).toBe('2026-10-04T03:00:00.000Z');
    expect(query.get('to')).toBe('2026-10-11T03:00:00.000Z');
    expect(query.get('employeeId')).toBe('3');
    expect(calendar.options!.events).toHaveLength(2);

    clickEvent(10);
    expect(navigateMock).toHaveBeenCalledWith('/agenda/10');

    await fill('Técnico', 'TODOS');
    await settle();
    expect(api.called(LIST)[1]!.url.searchParams.has('employeeId')).toBe(false);
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query.tecnico).toBeUndefined());
    expect(text()).toContain('Tentar de novo');
    click('Tentar de novo');
    await settle();
    await fill('Técnico', '5');
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query.tecnico).toBe('5'));

    const revert = vi.fn();
    dropEvent(9, '2026-10-08T09:00:00', '2026-10-08T11:00:00', revert);
    await settle();
    const patch = api.called('PATCH /api/v1/appointments/9')[0]!;
    expect(patch.body).toEqual({ startsAt: '2026-10-08T12:00:00.000Z', endsAt: '2026-10-08T14:00:00.000Z' });
    expect(toastTitles()).toContain('Atendimento remarcado. O cliente e o técnico foram avisados.');
    expect(revert).not.toHaveBeenCalled();

    dropEvent(9, '2026-10-08T09:00:00', '2026-10-08T11:00:00', revert);
    await settle();
    expect(toastTitles()).toContain(
      'Outra pessoa mudou este atendimento. Atualizamos a agenda: confira e tente de novo.',
    );
    dropEvent(9, '2026-10-08T09:00:00', '2026-10-08T11:00:00', revert);
    await settle();
    expect(toastTitles()).toContain('O colaborador já tem um atendimento das 09:00 às 11:00.');
    dropEvent(9, '2026-10-08T09:00:00', '2026-10-08T11:00:00', revert);
    await settle();
    expect(toastTitles()).toContain(
      'Não conseguimos falar com a loja agora. Confira sua conexão e tente de novo.',
    );
    expect(revert).toHaveBeenCalledTimes(3);
    page.unmount();
  });

  it('shows only the week on tablets and keeps the agenda when the technicians do not load', async () => {
    resizeTo(800);
    useAuthStore().apply(session(MANAGER_USER));
    mockApi().on('GET /api/v1/employees/availability', problem(500, 'Erro.')).on(LIST, { body: [] });
    const page = await mountSuspended(AgendaPage, { route: '/agenda' });
    await settle();
    expect(calendar.options!.headerToolbar).toMatchObject({ right: '' });
    expect(calendar.options!.editable).toBe(false);
    expect(document.querySelector('[aria-label="Cores dos técnicos"]')).toBeNull();
    page.unmount();
  });
});

describe('agenda on the phone', () => {
  it('lists the day of the technician and changes the day with arrows and swipes', async () => {
    resizeTo(400);
    useAuthStore().apply(session(EMPLOYEE_USER));
    const api = mockApi().on(LIST, {
      body: [
        appointment({ id: 10, startsAt: '2026-10-05T17:00:00.000Z', endsAt: '2026-10-05T18:00:00.000Z' }),
        appointment({ startsAt: '2026-10-05T12:00:00.000Z', endsAt: '2026-10-05T13:00:00.000Z' }),
      ],
    });
    const page = await mountSuspended(AgendaPage, { route: '/agenda', attachTo: document.body });
    await settle();
    expect(api.called('GET /api/v1/employees/availability')).toHaveLength(0);
    expect(text()).toContain('Seus atendimentos');
    expect(text()).toContain('segunda-feira, 5 de outubro');
    expect(text()).toContain('Hoje');
    const links = [...document.querySelectorAll('ol a')].map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/agenda/9', '/agenda/10']);
    expect(text()).not.toContain('Tiago Técnico');
    const from = () => api.called(LIST).at(-1)!.url.searchParams.get('from');
    expect(from()).toBe('2026-10-05T03:00:00.000Z');

    // Two quick taps: only the answer of the last request counts.
    press('Próximo dia');
    press('Próximo dia');
    await settle();
    expect(from()).toBe('2026-10-06T03:00:00.000Z');
    click('Voltar para hoje');
    await settle();
    expect(from()).toBe('2026-10-05T03:00:00.000Z');
    press('Dia anterior');
    await settle();
    expect(from()).toBe('2026-10-04T03:00:00.000Z');

    swipe(300, 100);
    await settle();
    expect(from()).toBe('2026-10-05T03:00:00.000Z');
    swipe(100, 300);
    await settle();
    expect(from()).toBe('2026-10-04T03:00:00.000Z');
    const calls = api.called(LIST).length;
    swipe(300, 260);
    swipe(300, 200, 400);
    document
      .querySelector('section[aria-labelledby="agenda-day-title"]')!
      .dispatchEvent(Object.assign(new Event('touchend'), { changedTouches: [{ clientX: 0, clientY: 0 }] }));
    await settle();
    expect(api.called(LIST)).toHaveLength(calls);

    // Back on a wide screen the calendar asks for its own period.
    resizeTo(1200);
    await settle();
    expect(api.called(LIST)).toHaveLength(calls);
    expect(document.querySelector('[data-testid="fullcalendar"]')).not.toBeNull();
    page.unmount();
  });

  it('shows the management every technician and an empty day', async () => {
    resizeTo(400);
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on('GET /api/v1/employees/availability', availability())
      .on(LIST, { body: [appointment()] }, { body: [] });
    const page = await mountSuspended(AgendaPage, { route: '/agenda', attachTo: document.body });
    await settle();
    expect(document.querySelector('ol')!.textContent).toContain('Tiago Técnico');
    press('Próximo dia');
    await settle();
    expect(text()).toContain('Nenhum atendimento neste dia');
    page.unmount();
  });
});

describe('scheduling an approved request', () => {
  const REQUEST = 'GET /api/v1/service-requests/41';
  const approved = serviceRequest({
    status: 'APPROVED',
    statusLabel: 'Aprovado',
    windows: [
      { day: '2026-10-08', period: 'AFTERNOON' },
      { day: '2026-10-01', period: 'MORNING' },
      { day: '2026-10-07', period: 'MORNING' },
    ],
  });

  it('picks the technician, sees busy times, handles a conflict and opens the new visit', async () => {
    const busyDay = availability([
      { appointmentId: 3, startsAt: '2026-10-08T13:00:00.000Z', endsAt: '2026-10-08T15:00:00.000Z' },
    ]);
    useAuthStore().apply(session(MANAGER_USER));
    const api = mockApi()
      .on(REQUEST, { body: approved })
      .on('GET /api/v1/service-types/1', { body: serviceType({ estimatedMinutes: 100 }) })
      .on('GET /api/v1/employees/availability', (request) => {
        const from = new URL(request.url).searchParams.get('from');
        if (from === '2026-10-09T03:00:00.000Z') return problem(500, 'Erro.');
        return from === '2026-10-08T03:00:00.000Z' ? busyDay : availability();
      })
      .on(
        'POST /api/v1/appointments',
        problem(409, 'O colaborador já tem um atendimento das 10:00 às 12:00.'),
        new Error('offline'),
        { status: 201, body: appointment({ id: 12 }) },
      );
    const page = await mountSuspended(AgendaPage, {
      route: '/agenda?solicitacao=41',
      attachTo: document.body,
    });
    await settle();
    expect(text()).toContain('Agendar solicitação 41');
    expect(text()).toContain('Conserto de geladeira para Carla Cliente');
    expect(input('Dia').value).toBe('2026-10-07');
    expect(input('Início').value).toBe('08:00');
    expect(input('Duração').value).toBe('100');
    expect(text()).toContain('Escolha o técnico para ver os horários dele.');
    const windows = [...document.querySelectorAll('[aria-pressed]')].map((item) => item.textContent?.trim());
    expect(windows).toHaveLength(2);

    submit('Agendar visita');
    await settle();
    expect(text()).toContain('Escolha o técnico.');

    await pickTechnician('3');
    click(windows[1]!);
    await settle();
    expect(input('Dia').value).toBe('2026-10-08');
    expect(input('Início').value).toBe('13:00');
    expect(document.querySelector('[aria-label="Horários ocupados"]')!.textContent).toContain(
      '10:00 às 12:00',
    );

    submit('Agendar visita');
    await settle();
    expect(document.querySelector('[data-testid="schedule-error"]')!.textContent).toContain(
      'Horário ocupado',
    );
    expect(api.called('POST /api/v1/appointments')[0]!.body).toEqual({
      serviceRequestId: 41,
      employeeId: 3,
      startsAt: '2026-10-08T16:00:00.000Z',
      endsAt: '2026-10-08T17:40:00.000Z',
    });
    submit('Agendar visita');
    await settle();
    expect(document.querySelector('[data-testid="schedule-error"]')!.textContent).toContain(
      'Não deu para salvar',
    );

    await fill('Dia', '2026-10-09');
    await settle();
    expect(text()).toContain('Não conseguimos ver a agenda do técnico agora.');
    await fill('Dia', '2026-10-10');
    await settle();
    await pickTechnician('5');
    expect(text()).toContain('Dia livre para este técnico.');

    await fill('Dia', '2026-10-01');
    submit('Agendar visita');
    await settle();
    expect(text()).toContain('Escolha hoje ou um dia futuro.');
    await fill('Dia', '');
    await fill('Início', '');
    submit('Agendar visita');
    await settle();
    expect(text()).toContain('Escolha o dia.');
    expect(text()).toContain('Escolha o horário de início.');

    await fill('Dia', '2026-10-10');
    await fill('Início', '09:30');
    await fill('Duração', '30');
    submit('Agendar visita');
    await settle();
    expect(api.called('POST /api/v1/appointments').at(-1)!.body).toMatchObject({
      employeeId: 5,
      startsAt: '2026-10-10T12:30:00.000Z',
      endsAt: '2026-10-10T13:00:00.000Z',
    });
    expect(navigateMock).toHaveBeenCalledWith('/agenda/12');
    expect(toastTitles()).toContain('Visita agendada. O cliente e o técnico foram avisados.');
    page.unmount();
  });

  it('closes the form, warns about requests that cannot be scheduled and missing ones', async () => {
    useAuthStore().apply(session(MANAGER_USER));
    mockApi()
      .on(REQUEST, { body: serviceRequest({ status: 'APPROVED', windows: [] }) })
      .on('GET /api/v1/service-types/1', problem(500, 'Erro.'))
      .on('GET /api/v1/employees/availability', availability());
    const first = await mountSuspended(AgendaPage, {
      route: '/agenda?solicitacao=41',
      attachTo: document.body,
    });
    await settle();
    expect(input('Dia').value).toBe('2026-10-06');
    expect(input('Início').value).toBe('08:00');
    expect(input('Duração').value).toBe('60');
    click('Cancelar');
    await settle();
    expect(text()).not.toContain('Agendar solicitação 41');
    await vi.waitFor(() => expect(useRouter().currentRoute.value.query.solicitacao).toBeUndefined());
    first.unmount();

    mockApi().on(REQUEST, { body: approved }).on('GET /api/v1/service-types/1', { body: serviceType() });
    const second = await mountSuspended(AgendaPage, {
      route: '/agenda?solicitacao=41',
      attachTo: document.body,
    });
    await settle();
    press('Fechar');
    await settle();
    expect(text()).not.toContain('Agendar solicitação 41');
    second.unmount();

    mockApi()
      .on(REQUEST, { body: serviceRequest({ status: 'SCHEDULED', statusLabel: 'Agendado' }) })
      .on('GET /api/v1/service-types/1', { body: serviceType() });
    const third = await mountSuspended(AgendaPage, {
      route: '/agenda?solicitacao=41',
      attachTo: document.body,
    });
    await settle();
    expect(document.querySelector('[data-testid="not-schedulable"]')!.textContent).toContain('está agendado');
    third.unmount();

    mockApi().on(REQUEST, problem(404, 'Não encontrada.'));
    const fourth = await mountSuspended(AgendaPage, {
      route: '/agenda?solicitacao=41',
      attachTo: document.body,
    });
    await settle();
    expect(text()).toContain('Não encontramos a solicitação');
    fourth.unmount();

    // An invalid number is ignored.
    const api = mockApi();
    const fifth = await mountSuspended(AgendaPage, { route: '/agenda?solicitacao=0' });
    await settle();
    expect(api.called(REQUEST)).toHaveLength(0);
    fifth.unmount();
  });
});
