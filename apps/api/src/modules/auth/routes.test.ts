import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { sessions, users } from '../../infra/db/schema.js';
import { DAY, MINUTE } from '../../shared/clock.js';
import { TEST_PASSWORD, useTestApp } from '../../../test/harness.js';
import { inviteUser, requestEmailChange } from './service.js';

const NEW_PASSWORD = 'Ar-Condicionado-9000';

describe('auth routes', () => {
  const t = useTestApp();

  describe('POST /auth/sessions', () => {
    it('signs in and sets an http only refresh cookie restricted to the auth path', async () => {
      const user = await t.createUser('MANAGER');
      const { response } = await t.login(user);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        expiresIn: 900,
        user: { id: user.id, role: 'MANAGER', email: user.email },
      });
      const cookie = response.cookies.find((c) => c.name === 'rc_refresh');
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/v1/auth' });
    });

    it('ignores case and spaces in the email', async () => {
      const user = await t.createUser();
      const { response } = await t.login({ email: `  ${user.email.toUpperCase()} ` });
      expect(response.statusCode).toBe(200);
    });

    it('gives the same answer for an unknown email and a wrong password', async () => {
      const user = await t.createUser();
      const wrong = await t.login(user, 'senha-errada-123');
      const unknown = await t.login({ email: 'ninguem@exemplo.com.br' });
      expect(wrong.response.statusCode).toBe(401);
      expect(unknown.response.json()).toMatchObject({ title: 'Email ou senha incorretos' });
      expect(wrong.response.json().title).toBe(unknown.response.json().title);
    });

    it('refuses invited users that never defined a password', async () => {
      const user = await t.createUser('CLIENT', { passwordHash: null });
      expect((await t.login(user)).response.statusCode).toBe(401);
    });

    it('refuses deleted users', async () => {
      const user = await t.createUser('CLIENT', { deletedAt: new Date() } as never);
      expect((await t.login(user)).response.statusCode).toBe(401);
    });

    it('locks an email for 15 minutes after 5 failures', async () => {
      const user = await t.createUser();
      for (let i = 0; i < 5; i += 1) await t.login(user, 'errada-123456');
      const locked = await t.login(user);
      expect(locked.response.statusCode).toBe(429);
      expect(locked.response.headers['retry-after']).toBe('900');
      t.clock.advance(16 * MINUTE);
      expect((await t.login(user)).response.statusCode).toBe(200);
    });

    it('limits failures per IP across emails', async () => {
      for (let i = 0; i < 20; i += 1) await t.login({ email: `x${i}@exemplo.com.br` }, 'errada-123456');
      const user = await t.createUser();
      expect((await t.login(user)).response.statusCode).toBe(429);
    });

    it('validates the payload with messages in Portuguese', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions',
        payload: { email: 'nao-e-email', password: '' },
      });
      expect(response.statusCode).toBe(422);
      expect(response.json().errors).toEqual(
        expect.arrayContaining([
          { path: 'email', message: 'Informe um email válido.' },
          { path: 'password', message: 'Informe a senha.' },
        ]),
      );
    });

    it('rejects a payload with the wrong shape', async () => {
      const response = await t.app.inject({ method: 'POST', url: '/api/v1/auth/sessions', payload: [] });
      expect(response.statusCode).toBe(422);
      expect(response.json().errors[0].path).toBe('body');
    });
  });

  describe('bearer tokens and permissions', () => {
    it('rejects a malformed or foreign authorization header', async () => {
      for (const authorization of ['Bearer nope', 'Basic abc', 'Bearer']) {
        const response = await t.app.inject({
          method: 'GET',
          url: '/api/v1/audit-logs',
          headers: { authorization },
        });
        expect(response.statusCode).toBe(401);
        expect(response.json().detail).toBe('Sua sessão expirou. Entre novamente.');
      }
    });

    it('rejects an expired access token', async () => {
      const { headers } = await t.as('ADMIN');
      t.clock.advance(16 * MINUTE);
      const response = await t.app.inject({ method: 'GET', url: '/api/v1/audit-logs', headers });
      expect(response.statusCode).toBe(401);
    });

    it('answers 401 to guests and 403 to signed in users without permission', async () => {
      const guest = await t.app.inject({ method: 'GET', url: '/api/v1/audit-logs' });
      expect(guest.statusCode).toBe(401);
      const { headers } = await t.as('MANAGER');
      const manager = await t.app.inject({ method: 'GET', url: '/api/v1/audit-logs', headers });
      expect(manager.statusCode).toBe(403);
      expect(manager.json()).toMatchObject({ title: 'Sem permissão' });
    });
  });

  describe('POST /auth/sessions/refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const user = await t.createUser();
      const first = await t.login(user);
      t.clock.advance(MINUTE);
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: first.refresh! },
      });
      expect(response.statusCode).toBe(200);
      const next = response.cookies.find((c) => c.name === 'rc_refresh')!.value;
      expect(next).not.toBe(first.refresh);
      expect(response.json().user.id).toBe(user.id);
    });

    it('revokes the whole family when an old refresh token is reused', async () => {
      const user = await t.createUser();
      const { refresh } = await t.login(user);
      const rotated = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: refresh! },
      });
      const fresh = rotated.cookies.find((c) => c.name === 'rc_refresh')!.value;

      const reuse = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: refresh! },
      });
      expect(reuse.statusCode).toBe(401);
      expect(reuse.json().detail).toBe('Por segurança, entre novamente.');

      const afterTheft = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: fresh },
      });
      expect(afterTheft.statusCode).toBe(401);
    });

    it('expires after the configured number of days', async () => {
      const { refresh } = await t.login(await t.createUser());
      t.clock.advance(31 * DAY);
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: refresh! },
      });
      expect(response.statusCode).toBe(401);
      expect(response.cookies.find((c) => c.name === 'rc_refresh')?.value).toBe('');
    });

    it('fails without a cookie or with an unknown cookie', async () => {
      const none = await t.app.inject({ method: 'POST', url: '/api/v1/auth/sessions/refresh' });
      expect(none.statusCode).toBe(401);
      const unknown = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: 'x'.repeat(43) },
      });
      expect(unknown.statusCode).toBe(401);
    });

    it('ends the session of a user deleted in the meantime', async () => {
      const user = await t.createUser();
      const { refresh } = await t.login(user);
      await t.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: refresh! },
      });
      expect(response.statusCode).toBe(401);
      const rows = await t.db.select().from(sessions).where(eq(sessions.userId, user.id));
      expect(rows.every((s) => s.revokedAt !== null)).toBe(true);
    });
  });

  describe('DELETE /auth/sessions/current', () => {
    it('revokes the refresh family and the access session', async () => {
      const user = await t.createUser();
      const { token, refresh } = await t.login(user);
      const response = await t.app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/current',
        headers: { authorization: `Bearer ${token}` },
        cookies: { rc_refresh: refresh! },
      });
      expect(response.statusCode).toBe(204);
      const again = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: refresh! },
      });
      expect(again.statusCode).toBe(401);
    });

    it('is harmless without credentials or with an unknown cookie', async () => {
      const none = await t.app.inject({ method: 'DELETE', url: '/api/v1/auth/sessions/current' });
      expect(none.statusCode).toBe(204);
      const unknown = await t.app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/current',
        cookies: { rc_refresh: 'desconhecido' },
      });
      expect(unknown.statusCode).toBe(204);
    });
  });

  describe('password reset', () => {
    it('emails a single use link that signs the user in and ends other sessions', async () => {
      const user = await t.createUser();
      const other = await t.login(user);
      const request = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-resets',
        payload: { email: user.email },
      });
      expect(request.statusCode).toBe(202);
      await t.deliverEmails();
      const email = t.lastEmailTo(user.email)!;
      expect(email.subject).toBe('Redefinição de senha');
      expect(email.html).toContain('http://localhost:3000/redefinir-senha/');
      const token = t.linkToken(email.text);

      const reset = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/password-resets/${token}`,
        payload: { password: NEW_PASSWORD },
      });
      expect(reset.statusCode).toBe(200);
      expect(reset.json().user.id).toBe(user.id);
      expect((await t.login(user, NEW_PASSWORD)).response.statusCode).toBe(200);
      expect((await t.login(user, TEST_PASSWORD)).response.statusCode).toBe(401);

      const oldRefresh = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/sessions/refresh',
        cookies: { rc_refresh: other.refresh! },
      });
      expect(oldRefresh.statusCode).toBe(401);

      const reused = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/password-resets/${token}`,
        payload: { password: 'Outra-Senha-Forte-1' },
      });
      expect(reused.statusCode).toBe(410);

      await t.deliverEmails();
      expect(t.lastEmailTo(user.email)!.subject).toBe('Sua senha foi alterada');
    });

    it('answers 202 for unknown emails without sending anything', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-resets',
        payload: { email: 'ninguem@exemplo.com.br' },
      });
      expect(response.statusCode).toBe(202);
      await t.deliverEmails();
      expect(t.mailer.sent).toHaveLength(0);
    });

    it('keeps only the latest link valid and expires links after 30 minutes', async () => {
      const user = await t.createUser();
      for (let i = 0; i < 2; i += 1) {
        await t.app.inject({
          method: 'POST',
          url: '/api/v1/auth/password-resets',
          payload: { email: user.email },
        });
      }
      await t.deliverEmails();
      const [first, second] = t.mailer.sent.map((m) => t.linkToken(m.text));
      const old = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/password-resets/${first}`,
        payload: { password: NEW_PASSWORD },
      });
      expect(old.statusCode).toBe(410);
      t.clock.advance(31 * MINUTE);
      const late = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/password-resets/${second}`,
        payload: { password: NEW_PASSWORD },
      });
      expect(late.statusCode).toBe(410);
      expect(late.json()).toMatchObject({ title: 'Link inválido ou vencido' });
    });

    it('rejects weak passwords and keeps the link usable', async () => {
      const user = await t.createUser();
      await t.app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-resets',
        payload: { email: user.email },
      });
      await t.deliverEmails();
      const token = t.linkToken(t.mailer.sent[0]!.text);
      const weak = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/password-resets/${token}`,
        payload: { password: 'senha123' },
      });
      expect(weak.statusCode).toBe(422);
      expect(weak.json().errors).toEqual([
        { path: 'password', message: 'Essa senha é muito comum. Escolha outra.' },
      ]);
      const ok = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/password-resets/${token}`,
        payload: { password: NEW_PASSWORD },
      });
      expect(ok.statusCode).toBe(200);
    });
  });

  describe('invitations', () => {
    it('lets an invited user define the password and sign in', async () => {
      const user = await t.createUser('EMPLOYEE', { passwordHash: null, emailVerifiedAt: null });
      await inviteUser(t.ctx, t.db, user);
      await t.deliverEmails();
      const email = t.lastEmailTo(user.email)!;
      expect(email.html).toContain('<strong>Colaborador</strong>');
      const token = t.linkToken(email.text);
      const response = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/invitations/${token}`,
        payload: { password: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(200);
      const [row] = await t.db.select().from(users).where(eq(users.id, user.id));
      expect(row!.emailVerifiedAt).toEqual(t.clock.now());
      await t.deliverEmails();
      expect(t.mailer.sent.filter((m) => m.subject === 'Sua senha foi alterada')).toHaveLength(0);
    });

    it('rejects an unknown invitation token', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/invitations/${'a'.repeat(43)}`,
        payload: { password: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(410);
    });
  });

  describe('PUT /me/password', () => {
    it('changes the password and ends the other devices but not the current one', async () => {
      const user = await t.createUser();
      const here = await t.login(user);
      const elsewhere = await t.login(user);
      const response = await t.app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        headers: { authorization: `Bearer ${here.token}` },
        payload: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(204);
      const refresh = (cookie: string) =>
        t.app.inject({
          method: 'POST',
          url: '/api/v1/auth/sessions/refresh',
          cookies: { rc_refresh: cookie },
        });
      expect((await refresh(here.refresh!)).statusCode).toBe(200);
      expect((await refresh(elsewhere.refresh!)).statusCode).toBe(401);
      await t.deliverEmails();
      expect(t.lastEmailTo(user.email)!.subject).toBe('Sua senha foi alterada');
    });

    it('requires the current password and a strong new one', async () => {
      const { headers, user } = await t.as('CLIENT');
      const wrong = await t.app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        headers,
        payload: { currentPassword: 'errada-errada', newPassword: NEW_PASSWORD },
      });
      expect(wrong.statusCode).toBe(422);
      expect(wrong.json().errors[0].path).toBe('currentPassword');
      const sameAsEmail = await t.app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        headers,
        payload: { currentPassword: TEST_PASSWORD, newPassword: user.email },
      });
      expect(sameAsEmail.json().detail).toBe('A senha não pode ser igual ao email.');
    });

    it('requires a session', async () => {
      const response = await t.app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        payload: { currentPassword: 'a', newPassword: 'b' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('fails for a user removed after signing in', async () => {
      const { headers, user } = await t.as('CLIENT');
      await t.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
      const response = await t.app.inject({
        method: 'PUT',
        url: '/api/v1/me/password',
        headers,
        payload: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('email change confirmation', () => {
    it('applies the new email only after the link is opened', async () => {
      const user = await t.createUser();
      await requestEmailChange(t.ctx, t.db, user, 'novo@exemplo.com.br');
      await t.deliverEmails();
      const email = t.lastEmailTo('novo@exemplo.com.br')!;
      expect(email.subject).toBe('Confirme seu novo email');
      const response = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/email-verifications/${t.linkToken(email.text)}`,
      });
      expect(response.statusCode).toBe(204);
      expect((await t.login({ email: 'novo@exemplo.com.br' })).response.statusCode).toBe(200);
    });

    it('refuses an email taken in the meantime and unknown tokens', async () => {
      const user = await t.createUser();
      await requestEmailChange(t.ctx, t.db, user, 'disputado@exemplo.com.br');
      await t.createUser('CLIENT', { email: 'disputado@exemplo.com.br' });
      await t.deliverEmails();
      const token = t.linkToken(t.lastEmailTo('disputado@exemplo.com.br')!.text);
      const taken = await t.app.inject({ method: 'POST', url: `/api/v1/auth/email-verifications/${token}` });
      expect(taken.statusCode).toBe(409);
      const unknown = await t.app.inject({
        method: 'POST',
        url: `/api/v1/auth/email-verifications/${'b'.repeat(43)}`,
      });
      expect(unknown.statusCode).toBe(410);
    });
  });
});
