import type { FastifyReply } from 'fastify';
import type { Config } from '../config.js';

export const REFRESH_COOKIE = 'rc_refresh';
export const REFRESH_PATH = '/api/v1/auth';

export interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: { id: number; name: string; email: string; role: string };
}

/** Sets the refresh cookie and answers with the access token and the user. */
export function sendSession(config: Config, reply: FastifyReply, session: SessionPayload, status = 200) {
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'strict',
    path: REFRESH_PATH,
    expires: session.refreshExpiresAt,
  });
  return reply
    .code(status)
    .send({ accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
}
