import { preconditionFailed, preconditionRequired } from './errors.js';

/** Weak entity tag for a versioned record. */
export function etagFor(version: number): string {
  return `W/"${version}"`;
}

/** Ensures the If-Match header matches the current version (docs/API.md, concurrency). */
export function assertIfMatch(ifMatch: string | undefined, currentVersion: number): void {
  if (ifMatch === undefined || ifMatch === '') {
    throw preconditionRequired();
  }
  const accepted = ifMatch.split(',').map((tag) => tag.trim());
  if (!accepted.includes('*') && !accepted.includes(etagFor(currentVersion))) {
    throw preconditionFailed();
  }
}
