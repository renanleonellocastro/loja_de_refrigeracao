import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { isRole, type Role } from '@rc/contracts';

export interface AccessClaims {
  userId: number;
  role: Role;
  sessionId: string;
}

const ISSUER = 'refrigeracao-castro';

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessClaims, secret: string, ttlSeconds: number, now: Date) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: claims.role, sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(claims.userId))
    .setIssuer(ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(key(secret));
}

/** Returns the claims of a valid token, or null for any invalid, expired or malformed token. */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now: Date,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      algorithms: ['HS256'],
      currentDate: now,
    });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || !isRole(payload.role) || typeof payload.sid !== 'string') {
      return null;
    }
    return { userId, role: payload.role, sessionId: payload.sid };
  } catch {
    return null;
  }
}

/** A random opaque token for cookies and email links, and the hash we store. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
