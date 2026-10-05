import type { Appointment } from './agenda';

/** Copy of the technician's day kept in this browser for when the signal drops in the field (issue #81). */
export interface SavedDay {
  userId: number;
  day: string;
  savedAt: string;
  visits: Appointment[];
}

const KEY = 'rc-hoje';

export function saveDay(entry: SavedDay): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Storage full or blocked: the page still works online.
  }
}

/** The saved copy of that person and day, or null. */
export function readDay(userId: number, day: string): SavedDay | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SavedDay | null;
    return saved?.userId === userId && saved.day === day ? saved : null;
  } catch {
    return null;
  }
}

/** Customer data must not outlive the session on a shared phone. */
export function forgetDay(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing saved.
  }
}
