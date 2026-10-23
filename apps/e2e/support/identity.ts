import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';

/**
 * An email that no other test, repeat or run uses. A timestamp is not enough: parallel repeats of the same test start
 * in the same millisecond and would try to create the same account.
 */
export function uniqueEmail(prefix: string, testInfo: TestInfo): string {
  return `${prefix}.${testInfo.project.name}.${randomUUID()}@exemplo.com`;
}
