import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { isRole, type Role } from '@rc/contracts';
import { SECOND } from '../../shared/clock.js';

export interface AccessClaims {
  userId: number;
  role: Role;
  sessionId: string;
}

const ISSUER = 'refrigeracao-castro';
const ALGORITHM = 'HS256';
const OPAQUE_TOKEN_BYTES = 32;

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessClaims, secret: string, ttlSeconds: number, now: Date) {
  const issuedAt = Math.floor(now.getTime() / SECOND);
  return new SignJWT({ role: claims.role, sid: claims.sessionId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(claims.userId))
    .setIssuer(ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(key(secret));
}

function claimsOf(payload: JWTPayload): AccessClaims | null {
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || !isRole(payload.role) || typeof payload.sid !== 'string') {
    return null;
  }
  return { userId, role: payload.role, sessionId: payload.sid };
}

/** Returns the claims of a valid token, or null for any invalid, expired or malformed token. */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now: Date,
): Promise<AccessClaims | null> {
  try {
    const options = { issuer: ISSUER, algorithms: [ALGORITHM], currentDate: now };
    const { payload } = await jwtVerify(token, key(secret), options);
    return claimsOf(payload);
  } catch {
    return null;
  }
}

/** A random opaque token for cookies and email links, and the hash we store. */
export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
