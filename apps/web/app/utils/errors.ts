export type ErrorKind = 'not-found' | 'server' | 'forbidden' | 'offline';

/** Which friendly error screen fits an HTTP status, given the connection state. */
export function errorKindFor(statusCode: number | undefined, online: boolean): ErrorKind {
  if (!online) return 'offline';
  if (statusCode === 404) return 'not-found';
  if (statusCode === 403) return 'forbidden';
  return 'server';
}
