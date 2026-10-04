import { describe, expect, it } from 'vitest';
import {
  availableDays,
  canTalk,
  durationLabel,
  formatDay,
  formatVisit,
  formatWindow,
  isOpenRequest,
  requestTimeline,
  serviceIllustration,
  sortWindows,
} from '~/utils/service-requests';
import { APPOINTMENT, serviceRequest } from '../support/services';

describe('service request helpers', () => {
  it('picks the illustration of each service by name', () => {
    expect(serviceIllustration('Instalação de ar condicionado')).toBe(
      '/illustrations/servico-instalacao-ar.svg',
    );
    expect(serviceIllustration('Manutenção de ar condicionado')).toBe(
      '/illustrations/servico-ar-condicionado.svg',
    );
    expect(serviceIllustration('Conserto de freezer')).toBe('/illustrations/servico-freezer.svg');
    expect(serviceIllustration('Conserto de lavadora')).toBe('/illustrations/servico-lavadora.svg');
    expect(serviceIllustration('Conserto de bebedouro')).toBe('/illustrations/servico-bebedouro.svg');
    expect(serviceIllustration('Refrigeração comercial')).toBe(
      '/illustrations/servico-refrigeracao-comercial.svg',
    );
    expect(serviceIllustration('Conserto de geladeira')).toBe('/illustrations/servico-geladeira.svg');
  });

  it('formats durations, days, windows and visits', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(120)).toBe('2h');
    expect(durationLabel(90)).toBe('1h30');
    expect(formatDay('2026-10-06')).toContain('06/10/2026');
    expect(formatWindow({ day: '2026-10-06', period: 'MORNING' })).toContain('manhã');
    expect(formatVisit(APPOINTMENT)).toBe('07/10/2026, 08:00 até 10:00');
  });

  it('lists 60 days from tomorrow and sorts windows', () => {
    const days = availableDays(new Date(2026, 9, 4, 15));
    expect(days).toHaveLength(60);
    expect(days[0]).toBe('2026-10-05');
    expect(days[59]).toBe('2026-12-03');
    expect(availableDays().length).toBe(60);
    expect(
      sortWindows([
        { day: '2026-10-08', period: 'MORNING' },
        { day: '2026-10-07', period: 'AFTERNOON' },
        { day: '2026-10-07', period: 'MORNING' },
      ]),
    ).toEqual([
      { day: '2026-10-07', period: 'MORNING' },
      { day: '2026-10-07', period: 'AFTERNOON' },
      { day: '2026-10-08', period: 'MORNING' },
    ]);
  });

  it('knows open requests and when the conversation is closed', () => {
    expect(isOpenRequest('REQUESTED')).toBe(true);
    expect(isOpenRequest('AWAITING_CUSTOMER')).toBe(true);
    expect(isOpenRequest('APPROVED')).toBe(false);
    expect(canTalk('SCHEDULED')).toBe(true);
    expect(canTalk('CANCELED')).toBe(false);
  });

  it('builds the short history of a request', () => {
    expect(requestTimeline(serviceRequest()).map((event) => event.title)).toEqual(['Solicitação enviada']);
    const rejected = requestTimeline(
      serviceRequest({ status: 'REJECTED', rejectionReason: 'Fora da área.' }),
    );
    expect(rejected.map((event) => event.title)).toEqual(['Recusado', 'Solicitação enviada']);
    expect(rejected[0]!.description).toBe('Fora da área.');
    const canceled = requestTimeline(
      serviceRequest({ status: 'CANCELED', cancellationReason: 'Resolvido.' }),
    );
    expect(canceled[0]!.description).toBe('Resolvido.');
    expect(requestTimeline(serviceRequest({ status: 'APPROVED' }))[0]!.description).toBeUndefined();
  });
});
