import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { REFRESH_COOKIE, clearSessionCookie, sendSession as sendWithCookie } from '../../plugins/session.js';
import { defineRoute, registerRoutes } from '../../shared/routes.js';
import { errorResponses, noContentSchema } from '../../shared/schemas.js';
import {
  changePasswordBodySchema,
  loginBodySchema,
  newPasswordBodySchema,
  passwordResetRequestSchema,
  sessionResponseSchema,
  tokenParamSchema,
} from './schemas.js';
import * as auth from './service.js';

const tags = ['Autenticação'];
const publicRoute = { public: true };
const expiredLinkResponse = { 410: errorResponses[404] };

type PasswordTokenRedemption = (
  ctx: AppContext,
  token: string,
  password: string,
  meta: auth.ClientMeta,
) => Promise<auth.IssuedSession>;

function meta(request: FastifyRequest): auth.ClientMeta {
  return { ip: request.ip, userAgent: request.headers['user-agent'] };
}

const sendSession = (ctx: AppContext, reply: FastifyReply, session: auth.IssuedSession) =>
  sendWithCookie(ctx.config, reply, session);

const passwordTokenRequest = {
  params: tokenParamSchema,
  body: newPasswordBodySchema,
  response: { 200: sessionResponseSchema, ...expiredLinkResponse, ...errorResponses },
};

/** Password reset and invitation links share one shape: redeem the token, set the password, sign in. */
function passwordTokenRoute(path: string, summary: string, redeem: PasswordTokenRedemption) {
  return defineRoute({
    method: 'POST',
    url: `/auth/${path}/:token`,
    config: publicRoute,
    schema: { tags, summary, ...passwordTokenRequest },
    handle: async ({ ctx, request, reply }) => {
      const session = await redeem(ctx, request.params.token, request.body.password, meta(request));
      return sendSession(ctx, reply, session);
    },
  });
}

const loginRoute = defineRoute({
  method: 'POST',
  url: '/auth/sessions',
  config: publicRoute,
  schema: {
    tags,
    summary: 'Entrar com email e senha',
    body: loginBodySchema,
    response: { 200: sessionResponseSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) =>
    sendSession(ctx, reply, await auth.login(ctx, request.body, meta(request))),
});

const refreshRoute = defineRoute({
  method: 'POST',
  url: '/auth/sessions/refresh',
  config: publicRoute,
  schema: {
    tags,
    summary: 'Renovar o token de acesso com o cookie de refresh',
    response: { 200: sessionResponseSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    try {
      const session = await auth.refresh(ctx, request.cookies[REFRESH_COOKIE], meta(request));
      return sendSession(ctx, reply, session);
    } catch (error) {
      clearSessionCookie(reply);
      throw error;
    }
  },
});

const logoutRoute = defineRoute({
  method: 'DELETE',
  url: '/auth/sessions/current',
  config: publicRoute,
  schema: { tags, summary: 'Sair neste dispositivo', response: { 204: noContentSchema } },
  handle: async ({ ctx, request, reply }) => {
    await auth.logout(ctx, request.cookies[REFRESH_COOKIE], request.auth?.sessionId);
    clearSessionCookie(reply);
    return reply.code(204).send();
  },
});

const requestPasswordResetRoute = defineRoute({
  method: 'POST',
  url: '/auth/password-resets',
  config: { public: true, rateLimit: { max: 5, timeWindow: '15 minutes' } },
  schema: {
    tags,
    summary: 'Pedir link de recuperação de senha',
    description: 'Responde 202 sempre, exista ou não a conta.',
    body: passwordResetRequestSchema,
    response: { 202: noContentSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    await auth.requestPasswordReset(ctx, request.body.email);
    return reply.code(202).send();
  },
});

const resetPasswordRoute = passwordTokenRoute(
  'password-resets',
  'Definir nova senha com o link recebido',
  auth.resetPassword,
);

const acceptInvitationRoute = passwordTokenRoute(
  'invitations',
  'Aceitar convite e definir a senha',
  auth.acceptInvitation,
);

const confirmEmailRoute = defineRoute({
  method: 'POST',
  url: '/auth/email-verifications/:token',
  config: publicRoute,
  schema: {
    tags,
    summary: 'Confirmar novo email',
    params: tokenParamSchema,
    response: { 204: noContentSchema, ...expiredLinkResponse, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    await auth.confirmEmail(ctx, request.params.token);
    return reply.code(204).send();
  },
});

const changePasswordRoute = defineRoute({
  method: 'PUT',
  url: '/me/password',
  config: { permission: 'profile.manage' },
  schema: {
    tags,
    summary: 'Trocar a própria senha',
    security: [{ bearerAuth: [] }],
    body: changePasswordBodySchema,
    response: { 204: noContentSchema, ...errorResponses },
  },
  handle: async ({ ctx, request, reply }) => {
    await auth.changePassword(ctx, requireAuth(request), request.body);
    return reply.code(204).send();
  },
});

const AUTH_ROUTES = [
  loginRoute,
  refreshRoute,
  logoutRoute,
  requestPasswordResetRoute,
  resetPasswordRoute,
  acceptInvitationRoute,
  confirmEmailRoute,
  changePasswordRoute,
];

export function authRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => registerRoutes(app, ctx, AUTH_ROUTES);
}
