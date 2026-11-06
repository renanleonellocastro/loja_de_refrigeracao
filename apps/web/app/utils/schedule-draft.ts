/** Values of the scheduling form (UCs Cadastrar and Alterar Serviço na Agenda), as the inputs hold them. */
export type ScheduleValues = { employeeId: string; day: string; time: string; duration: string };

/** Whose draft it is: a request being scheduled, or a visit being changed from the version with that ETag. */
export type ScheduleDraftTarget = { requestId: number } | { appointmentId: number; etag: string };

type StoredDraft = { etag: string; values: ScheduleValues };

const VALUE_PATTERNS: Record<keyof ScheduleValues, RegExp> = {
  employeeId: /^\d*$/,
  day: /^(\d{4}-\d{2}-\d{2})?$/,
  time: /^(\d{2}:\d{2})?$/,
  duration: /^\d+$/,
};

function keyOf(target: ScheduleDraftTarget): string {
  return 'appointmentId' in target
    ? `rc:remarcacao:${target.appointmentId}`
    : `rc:agendamento:${target.requestId}`;
}

function etagOf(target: ScheduleDraftTarget): string {
  return 'etag' in target ? target.etag : '';
}

function isScheduleValues(value: unknown): value is ScheduleValues {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Object.entries(VALUE_PATTERNS).every(
    ([field, pattern]) => typeof record[field] === 'string' && pattern.test(record[field]),
  );
}

function readStored(key: string): Partial<StoredDraft> | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<StoredDraft> | null;
  } catch {
    return null;
  }
}

/**
 * The draft kept on this device, or null. A draft of a visit that someone changed since (other ETag) is
 * dropped: the form starts from the version on screen instead of mixing two versions.
 */
export function loadScheduleDraft(target: ScheduleDraftTarget): ScheduleValues | null {
  const stored = readStored(keyOf(target));
  if (stored?.etag === etagOf(target) && isScheduleValues(stored.values)) return { ...stored.values };
  if (stored) clearScheduleDraft(target);
  return null;
}

export function saveScheduleDraft(target: ScheduleDraftTarget, values: ScheduleValues): void {
  try {
    const stored: StoredDraft = { etag: etagOf(target), values };
    localStorage.setItem(keyOf(target), JSON.stringify(stored));
  } catch {
    // Private windows and full storage only lose the draft; the form keeps working.
  }
}

export function clearScheduleDraft(target: ScheduleDraftTarget): void {
  try {
    localStorage.removeItem(keyOf(target));
  } catch {
    // Nothing to clean when storage is blocked.
  }
}
