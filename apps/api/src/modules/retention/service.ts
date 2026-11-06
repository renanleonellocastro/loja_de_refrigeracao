import type { AppContext } from '../../context.js';
import { DAY } from '../../shared/clock.js';
import { removeUnusedKeys } from '../catalog/service.js';
import { FINAL_STATUSES } from '../services/service.js';
import * as repo from './repository.js';

/** Retention periods of docs/SEGURANCA.md section 6 (LGPD). */
export const SESSION_RETENTION_DAYS = 30;
export const SERVICE_PHOTO_RETENTION_YEARS = 5;

export interface RetentionResult {
  sessions: number;
  photos: number;
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * DAY);
}

function yearsBefore(date: Date, years: number): Date {
  const cutoff = new Date(date);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return cutoff;
}

/** Scheduled task: deletes sessions that expired or were revoked more than 30 days ago. */
export function purgeEndedSessions(ctx: AppContext): Promise<number> {
  return repo.deleteSessionsEndedBefore(ctx.db, daysBefore(ctx.clock.now(), SESSION_RETENTION_DAYS));
}

/**
 * Scheduled task: removes the photos of service requests (and of their visit reports) that reached a
 * final status more than 5 years ago. The files go after the commit, only when no other row uses them.
 */
export async function purgeOldServicePhotos(ctx: AppContext): Promise<number> {
  const cutoff = yearsBefore(ctx.clock.now(), SERVICE_PHOTO_RETENTION_YEARS);
  const finished = { statuses: FINAL_STATUSES, cutoff };
  const keys = await repo.deleteFinishedServicePhotos(ctx.db, finished);
  await removeUnusedKeys(ctx, keys);
  return keys.length;
}

/** Runs every retention task; the audit trail is append only and is never purged. */
export async function runRetention(ctx: AppContext): Promise<RetentionResult> {
  const sessions = await purgeEndedSessions(ctx);
  const photos = await purgeOldServicePhotos(ctx);
  return { sessions, photos };
}
