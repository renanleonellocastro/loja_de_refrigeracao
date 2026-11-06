import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';

/**
 * An email that no other test, repeat or run uses. A timestamp is not enough: parallel repeats of the same test start
 * in the same millisecond and would try to create the same account.
 */
export function uniqueEmail(prefix: string, testInfo: TestInfo): string {
  return `${prefix}.${testInfo.project.name}.${randomUUID()}@exemplo.com`;
}

function cpfDigit(digits: string, start: number): number {
  const sum = [...digits].reduce((acc, char, i) => acc + Number(char) * (start - i), 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** A valid CPF that no other test, repeat or run uses, since every device project writes to the same database. */
export function uniqueCpf(): string {
  const base = String(randomUUID().replace(/\D/g, '')).padEnd(9, '7').slice(0, 9);
  const first = cpfDigit(base, 10);
  return `${base}${first}${cpfDigit(`${base}${first}`, 11)}`;
}
