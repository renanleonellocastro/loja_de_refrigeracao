import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewport, viewportFor } from '~/composables/useViewport';
import {
  addDays,
  appliance,
  clearDraft,
  dayRange,
  durationOf,
  etagOf,
  formatLongDay,
  formatTimeRange,
  fromStoreWall,
  isMovable,
  loadDraft,
  mapsUrl,
  saveDraft,
  storeDay,
  technicianColor,
  toCalendarEvent,
  toStoreWall,
} from '~/utils/agenda';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { defineComponent, h } from 'vue';
import { appointment, report, resizeTo } from '../support/agenda';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  resizeTo(1024);
});

describe('agenda time helpers', () => {
  it('converts between instants and the São Paulo wall clock', () => {
    expect(toStoreWall('2026-10-07T11:00:00.000Z')).toBe('2026-10-07T08:00:00');
    expect(fromStoreWall('2026-10-07T08:00')).toBe('2026-10-07T11:00:00.000Z');
    expect(fromStoreWall('2026-10-07T23:30:00.000')).toBe('2026-10-08T02:30:00.000Z');
    expect(storeDay('2026-10-08T02:00:00.000Z')).toBe('2026-10-07');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dayRange('2026-10-07')).toEqual({
      from: '2026-10-07T03:00:00.000Z',
      to: '2026-10-08T03:00:00.000Z',
    });
    expect(dayRange('2026-10-07', '2026-10-08').to).toBe('2026-10-09T03:00:00.000Z');
    expect(formatLongDay('2026-10-07')).toBe('quarta-feira, 7 de outubro');
    expect(formatTimeRange('2026-10-07T11:00:00.000Z', '2026-10-07T13:30:00.000Z')).toBe('08:00 às 10:30');
    expect(durationOf(appointment())).toBe(120);
  });

  it('describes visits for the calendar and the map', () => {
    expect(technicianColor(3)).toBe(technicianColor(11));
    expect(appliance(appointment().request)).toBe('Geladeira duplex · Brastemp');
    expect(mapsUrl(appointment().request.address)).toContain('destination=Rua%20Doutor%20Ulhoa%20Cintra');
    expect(etagOf(4)).toBe('W/"4"');
    const event = toCalendarEvent(appointment(), true);
    expect(event).toMatchObject({
      id: '9',
      title: 'Tiago · Conserto de geladeira: Carla Cliente',
      editable: true,
    });
    expect(event.start).toBe('2026-10-07T08:00:00');
    expect(toCalendarEvent(appointment(), false).title).toBe('Conserto de geladeira: Carla Cliente');
    expect(isMovable(appointment({ report: report() }))).toBe(false);
    expect(isMovable(appointment({ report: report({ status: 'REWORK' }) }))).toBe(true);
    expect(isMovable(appointment({ request: { status: 'COMPLETED' } }))).toBe(false);
  });
});

describe('report drafts', () => {
  it('keeps the draft on the device and survives blocked storage', () => {
    expect(loadDraft(9)).toBeNull();
    saveDraft(9, { defectFound: 'sim', defectDescription: 'Relé', repairDescription: 'Troca' });
    expect(loadDraft(9)).toEqual({
      defectFound: 'sim',
      defectDescription: 'Relé',
      repairDescription: 'Troca',
    });
    localStorage.setItem('rc:finalizacao:9', JSON.stringify({ defectFound: 'talvez' }));
    expect(loadDraft(9)).toEqual({ defectFound: '', defectDescription: '', repairDescription: '' });
    localStorage.setItem('rc:finalizacao:9', '{');
    expect(loadDraft(9)).toBeNull();
    clearDraft(9);
    expect(localStorage.getItem('rc:finalizacao:9')).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() =>
      saveDraft(9, { defectFound: '', defectDescription: '', repairDescription: '' }),
    ).not.toThrow();
    expect(() => clearDraft(9)).not.toThrow();
  });
});

describe('viewport', () => {
  it('follows the breakpoints of the design and the window size', async () => {
    expect(viewportFor(767)).toBe('phone');
    expect(viewportFor(768)).toBe('tablet');
    expect(viewportFor(1024)).toBe('desktop');
    const Probe = defineComponent({
      setup() {
        const viewport = useViewport();
        return () => h('p', viewport.value);
      },
    });
    const probe = await mountSuspended(Probe);
    expect(probe.text()).toBe('desktop');
    resizeTo(500);
    await nextTick();
    expect(probe.text()).toBe('phone');
    probe.unmount();
  });
});
