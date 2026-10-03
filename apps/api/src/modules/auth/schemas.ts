import { z } from 'zod';
import { emailSchema } from '../../shared/schemas.js';
import { userSummarySchema } from '../users/schemas.js';

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Informe a senha.' }).max(128),
});

export const sessionResponseSchema = z
  .object({
    accessToken: z.string(),
    expiresIn: z.number().int().describe('Validade do token de acesso em segundos'),
    user: userSummarySchema,
  })
  .meta({ id: 'Session' });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const tokenParamSchema = z.object({ token: z.string().min(20).max(100) });

export const newPasswordBodySchema = z.object({
  password: z.string().min(1, { error: 'Informe a nova senha.' }).max(256),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, { error: 'Informe a senha atual.' }).max(256),
  newPassword: z.string().min(1, { error: 'Informe a nova senha.' }).max(256),
});
