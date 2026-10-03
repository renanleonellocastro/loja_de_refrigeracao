import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { requireAuth } from '../../plugins/auth.js';
import { hashPassword, passwordProblem, verifyPassword } from './passwords.js';
import { generateOpaqueToken, hashToken, signAccessToken, verifyAccessToken } from './tokens.js';
import type { FastifyRequest } from 'fastify';

const SECRET = 'a-test-secret-with-at-least-32-characters';
const NOW = new Date('2026-10-05T12:00:00Z');

describe('access tokens', () => {
  it('round trips the claims until they expire', async () => {
    const token = await signAccessToken({ userId: 7, role: 'EMPLOYEE', sessionId: 's1' }, SECRET, 60, NOW);
    expect(await verifyAccessToken(token, SECRET, NOW)).toEqual({
      userId: 7,
      role: 'EMPLOYEE',
      sessionId: 's1',
    });
    expect(await verifyAccessToken(token, SECRET, new Date(NOW.getTime() + 61_000))).toBeNull();
    expect(await verifyAccessToken(token, 'another-secret-with-at-least-32-characters', NOW)).toBeNull();
  });

  it('rejects tokens with unexpected claims', async () => {
    const key = new TextEncoder().encode(SECRET);
    const sign = (payload: Record<string, unknown>, sub: string) =>
      new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(sub)
        .setIssuer('refrigeracao-castro')
        .setIssuedAt(NOW.getTime() / 1000)
        .setExpirationTime(NOW.getTime() / 1000 + 60)
        .sign(key);
    expect(await verifyAccessToken(await sign({ role: 'ROOT', sid: 's' }, '1'), SECRET, NOW)).toBeNull();
    expect(await verifyAccessToken(await sign({ role: 'CLIENT', sid: 's' }, 'abc'), SECRET, NOW)).toBeNull();
    expect(await verifyAccessToken(await sign({ role: 'CLIENT' }, '1'), SECRET, NOW)).toBeNull();
  });

  it('generates opaque tokens and stable hashes', () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});

describe('passwords', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('Uma-Senha-Boa-1');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'Uma-Senha-Boa-1')).toBe(true);
    expect(await verifyPassword(hash, 'outra')).toBe(false);
    expect(await verifyPassword('not a hash', 'x')).toBe(false);
  });

  it.each([
    ['curta', 'A senha precisa ter pelo menos 8 caracteres.'],
    ['x'.repeat(129), 'A senha pode ter no máximo 128 caracteres.'],
    ['Senha123', 'Essa senha é muito comum. Escolha outra.'],
    ['ana@exemplo.com', 'A senha não pode ser igual ao email.'],
    ['Geladeira-Nova-2026', null],
  ])('passwordProblem(%s)', (password, expected) => {
    expect(passwordProblem(password, 'ANA@exemplo.com')).toBe(expected);
  });

  it('accepts any long password when no email is known', () => {
    expect(passwordProblem('ana@exemplo.com')).toBeNull();
  });
});

describe('requireAuth', () => {
  it('returns the claims or throws 401', () => {
    const claims = { userId: 1, role: 'CLIENT' as const, sessionId: 's' };
    expect(requireAuth({ auth: claims } as FastifyRequest)).toBe(claims);
    expect(() => requireAuth({ auth: null } as FastifyRequest)).toThrowError(
      expect.objectContaining({ status: 401 }),
    );
  });
});
