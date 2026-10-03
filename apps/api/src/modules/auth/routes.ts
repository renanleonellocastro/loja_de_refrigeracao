import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { REFRESH_COOKIE, clearSessionCookie, sendSession as sendWithCookie } from '../../plugins/session.js';
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

function meta(request: FastifyRequest): auth.ClientMeta {
  return { ip: request.ip, userAgent: request.headers['user-agent'] };
}

const sendSession = (ctx: AppContext, reply: FastifyReply, session: auth.IssuedSession) =>
  sendWithCookie(ctx.config, reply, session);

export function authRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const tags = ['Autenticação'];

    app.post(
      '/auth/sessions',
      {
        config: { public: true },
        schema: {
          tags,
          summary: 'Entrar com email e senha',
          body: loginBodySchema,
          response: { 200: sessionResponseSchema, ...errorResponses },
        },
      },
      async (request, reply) => sendSession(ctx, reply, await auth.login(ctx, request.body, meta(request))),
    );

    app.post(
      '/auth/sessions/refresh',
      {
        config: { public: true },
        schema: {
          tags,
          summary: 'Renovar o token de acesso com o cookie de refresh',
          response: { 200: sessionResponseSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        try {
          return sendSession(
            ctx,
            reply,
            await auth.refresh(ctx, request.cookies[REFRESH_COOKIE], meta(request)),
          );
        } catch (error) {
          clearSessionCookie(reply);
          throw error;
        }
      },
    );

    app.delete(
      '/auth/sessions/current',
      {
        config: { public: true },
        schema: { tags, summary: 'Sair neste dispositivo', response: { 204: noContentSchema } },
      },
      async (request, reply) => {
        await auth.logout(ctx, request.cookies[REFRESH_COOKIE], request.auth?.sessionId);
        clearSessionCookie(reply);
        return reply.code(204).send();
      },
    );

    app.post(
      '/auth/password-resets',
      {
        config: { public: true, rateLimit: { max: 5, timeWindow: '15 minutes' } },
        schema: {
          tags,
          summary: 'Pedir link de recuperação de senha',
          description: 'Responde 202 sempre, exista ou não a conta.',
          body: passwordResetRequestSchema,
          response: { 202: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await auth.requestPasswordReset(ctx, request.body.email);
        return reply.code(202).send();
      },
    );

    app.post(
      '/auth/password-resets/:token',
      {
        config: { public: true },
        schema: {
          tags,
          summary: 'Definir nova senha com o link recebido',
          params: tokenParamSchema,
          body: newPasswordBodySchema,
          response: { 200: sessionResponseSchema, 410: errorResponses[404], ...errorResponses },
        },
      },
      async (request, reply) =>
        sendSession(
          ctx,
          reply,
          await auth.resetPassword(ctx, request.params.token, request.body.password, meta(request)),
        ),
    );

    app.post(
      '/auth/invitations/:token',
      {
        config: { public: true },
        schema: {
          tags,
          summary: 'Aceitar convite e definir a senha',
          params: tokenParamSchema,
          body: newPasswordBodySchema,
          response: { 200: sessionResponseSchema, 410: errorResponses[404], ...errorResponses },
        },
      },
      async (request, reply) =>
        sendSession(
          ctx,
          reply,
          await auth.acceptInvitation(ctx, request.params.token, request.body.password, meta(request)),
        ),
    );

    app.post(
      '/auth/email-verifications/:token',
      {
        config: { public: true },
        schema: {
          tags,
          summary: 'Confirmar novo email',
          params: tokenParamSchema,
          response: { 204: noContentSchema, 410: errorResponses[404], ...errorResponses },
        },
      },
      async (request, reply) => {
        await auth.confirmEmail(ctx, request.params.token);
        return reply.code(204).send();
      },
    );

    app.put(
      '/me/password',
      {
        config: { permission: 'profile.manage' },
        schema: {
          tags,
          summary: 'Trocar a própria senha',
          security: [{ bearerAuth: [] }],
          body: changePasswordBodySchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await auth.changePassword(ctx, requireAuth(request), request.body);
        return reply.code(204).send();
      },
    );
  };
}
