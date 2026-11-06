import { and, eq, inArray, lt, or } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { appointments, media, serviceReports, serviceRequests, sessions } from '../../infra/db/schema.js';
import type { RequestStatus } from '../services/service.js';

/** Deletes sessions that expired or were revoked before `cutoff`. Returns how many were deleted. */
export async function deleteSessionsEndedBefore(db: Executor, cutoff: Date): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, cutoff), lt(sessions.revokedAt, cutoff)))
    .returning({ id: sessions.id });
  return deleted.length;
}

/** Service requests in one of `statuses` whose last change happened before `cutoff`. */
export interface FinishedServices {
  statuses: readonly RequestStatus[];
  cutoff: Date;
}

function finishedRequestIds(db: Executor, finished: FinishedServices) {
  return db
    .select({ id: serviceRequests.id })
    .from(serviceRequests)
    .where(
      and(
        inArray(serviceRequests.status, [...finished.statuses]),
        lt(serviceRequests.updatedAt, finished.cutoff),
      ),
    );
}

function finishedReportIds(db: Executor, finished: FinishedServices) {
  return db
    .select({ id: serviceReports.id })
    .from(serviceReports)
    .innerJoin(appointments, eq(appointments.id, serviceReports.appointmentId))
    .where(inArray(appointments.serviceRequestId, finishedRequestIds(db, finished)));
}

/**
 * Deletes the photo rows of finished service requests and of their visit reports.
 * Returns the storage keys of the deleted rows, so the files can be removed after the commit.
 */
export async function deleteFinishedServicePhotos(
  db: Executor,
  finished: FinishedServices,
): Promise<string[]> {
  const deleted = await db
    .delete(media)
    .where(
      or(
        and(eq(media.ownerType, 'SERVICE_REQUEST'), inArray(media.ownerId, finishedRequestIds(db, finished))),
        and(eq(media.ownerType, 'SERVICE_REPORT'), inArray(media.ownerId, finishedReportIds(db, finished))),
      ),
    )
    .returning({ key: media.storageKey });
  return deleted.map((row) => row.key);
}
