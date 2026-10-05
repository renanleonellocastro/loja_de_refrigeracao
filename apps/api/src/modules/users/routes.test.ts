import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appointments,
  auditLogs,
  orders,
  serviceRequests,
  serviceTypes,
  sessions,
  users,
} from '../../infra/db/schema.js';
import { TEST_PASSWORD, useTestApp } from '../../../test/harness.js';
import { clearCepCache, lookupCep } from './cep.js';

const ADDRESS = {
  cep: '13800-061',
  street: 'Rua Doutor Ulhoa Cintra',
  number: '91',
  complement: '',
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

const registration = {
  name: 'Joana da Silva',
  email: 'Joana@Exemplo.com.br',
  phone: '(19) 99876-5432',
  password: 'Lavadora-Boa-2026',
  acceptPrivacy: true,
};

describe('user routes', () => {
  const t = useTestApp();
  beforeEach(() => clearCepCache());

  describe('POST /customers', () => {
    it('creates the customer, signs in and sends the welcome email', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: { ...registration, cpf: '529.982.247-25', address: ADDRESS },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().user).toMatchObject({ role: 'CLIENT', email: 'joana@exemplo.com.br' });
      expect(response.cookies.some((c) => c.name === 'rc_refresh')).toBe(true);

      const me = await t.app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${response.json().accessToken}` },
      });
      expect(me.json()).toMatchObject({
        phone: '19998765432',
        cpf: '52998224725',
        address: { cep: '13800061', complement: null, state: 'SP' },
        emailVerified: false,
        pendingInvitation: false,
      });
      await t.deliverEmails();
      expect(t.lastEmailTo('joana@exemplo.com.br')?.subject).toBe('Bem vindo à Refrigeração Castro');
      const [row] = await t.db.select().from(users).where(eq(users.email, 'joana@exemplo.com.br'));
      expect(row).toMatchObject({
        privacyVersion: '2026-10-03',
        searchText: 'joana da silva joana@exemplo.com.br 19998765432 52998224725',
      });
    });

    it('validates every field in Portuguese', async () => {
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: {
          name: 'Jo',
          email: 'x',
          phone: '123',
          password: '',
          cpf: '111.111.111-11',
          acceptPrivacy: false,
        },
      });
      expect(response.statusCode).toBe(422);
      const messages = Object.fromEntries(
        response.json().errors.map((e: { path: string; message: string }) => [e.path, e.message]),
      );
      expect(messages).toMatchObject({
        name: 'Informe o nome completo.',
        email: 'Informe um email válido.',
        phone: 'Telefone inválido. Use DDD e número.',
        cpf: 'CPF inválido.',
        acceptPrivacy: 'É preciso aceitar a política de privacidade.',
      });
    });

    it('refuses weak passwords, taken emails and taken CPFs', async () => {
      const weak = await t.app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: { ...registration, password: '12345678' },
      });
      expect(weak.json()).toMatchObject({ status: 422, title: 'Senha fraca' });

      await t.createUser('CLIENT', { email: 'joana@exemplo.com.br' });
      const emailTaken = await t.app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: registration,
      });
      expect(emailTaken.statusCode).toBe(409);
      const plain = await t.app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: { ...registration, email: 'sem-cpf@exemplo.com.br' },
      });
      expect(plain.statusCode).toBe(201);
      expect(emailTaken.json().errors).toEqual([
        { path: 'email', message: 'Este email já está cadastrado.' },
      ]);

      await t.createUser('CLIENT', { cpf: '52998224725' });
      const cpfTaken = await t.app.inject({
        method: 'POST',
        url: '/api/v1/customers',
        payload: { ...registration, email: 'outra@exemplo.com.br', cpf: '52998224725' },
      });
      expect(cpfTaken.json()).toMatchObject({ status: 409, title: 'CPF já cadastrado' });
    });
  });

  describe('POST /users (by the staff)', () => {
    it('lets a manager register a customer, who gets an invitation', async () => {
      const { headers } = await t.as('MANAGER');
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers,
        payload: {
          role: 'CLIENT',
          name: 'Seu Antônio Pereira',
          email: 'antonio@exemplo.com.br',
          address: { ...ADDRESS, complement: 'Fundos' },
        },
      });
      expect(response.statusCode).toBe(201);
      expect(response.headers.location).toBe(`/api/v1/users/${response.json().id}`);
      expect(response.json()).toMatchObject({
        pendingInvitation: true,
        phone: null,
        address: { complement: 'Fundos' },
      });
      await t.deliverEmails();
      expect(t.lastEmailTo('antonio@exemplo.com.br')?.html).toContain('<strong>Cliente</strong>');
      const audit = await t.db.select().from(auditLogs);
      expect(audit[0]).toMatchObject({ action: 'user.create', resourceId: String(response.json().id) });
    });

    it('lets only the super user register staff, always with CPF', async () => {
      const manager = await t.as('MANAGER');
      const employee = {
        role: 'EMPLOYEE',
        name: 'Paulo Técnico',
        email: 'paulo@exemplo.com.br',
        cpf: '111.444.777-35',
        phone: '(19) 99999-1234',
      };
      const denied = await t.app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: manager.headers,
        payload: employee,
      });
      expect(denied.statusCode).toBe(403);

      const admin = await t.as('ADMIN');
      const noCpf = await t.app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: admin.headers,
        payload: { ...employee, cpf: undefined },
      });
      expect(noCpf.json().errors).toEqual([{ path: 'cpf', message: 'CPF é obrigatório para a equipe.' }]);

      for (const payload of [
        employee,
        { ...employee, role: 'MANAGER', email: 'gerente2@exemplo.com.br', cpf: '153.509.460-56' },
      ]) {
        const created = await t.app.inject({
          method: 'POST',
          url: '/api/v1/users',
          headers: admin.headers,
          payload,
        });
        expect(created.statusCode).toBe(201);
      }
    });
  });

  describe('GET /users', () => {
    it('searches ignoring accents and case, ordered by name, with pagination', async () => {
      const { headers } = await t.as('EMPLOYEE');
      await t.createUser('CLIENT', { name: 'João Gonçalves', phone: '19912345678' });
      await t.createUser('CLIENT', { name: 'Ana Joaquina' });
      await t.createUser('CLIENT', { name: 'Zé Ninguém' });
      const search = await t.app.inject({ method: 'GET', url: '/api/v1/users?role=CLIENT&q=JOAO', headers });
      expect(search.json().data.map((u: { name: string }) => u.name)).toEqual(['João Gonçalves']);
      const byPhone = await t.app.inject({
        method: 'GET',
        url: '/api/v1/users?role=CLIENT&q=1234567',
        headers,
      });
      expect(byPhone.json().meta.total).toBe(1);
      const page = await t.app.inject({
        method: 'GET',
        url: '/api/v1/users?role=CLIENT&pageSize=2&page=2',
        headers,
      });
      expect(page.json()).toMatchObject({
        meta: { page: 2, pageSize: 2, total: 3 },
        data: [{ name: 'Zé Ninguém' }],
      });
      const wildcard = await t.app.inject({ method: 'GET', url: '/api/v1/users?role=CLIENT&q=%25', headers });
      expect(wildcard.json().meta.total).toBe(3);
    });

    it('limits which roles each actor can list', async () => {
      const employee = await t.as('EMPLOYEE');
      const listEmployees = await t.app.inject({
        method: 'GET',
        url: '/api/v1/users?role=EMPLOYEE',
        headers: employee.headers,
      });
      expect(listEmployees.statusCode).toBe(403);
      const manager = await t.as('MANAGER');
      const ok = await t.app.inject({
        method: 'GET',
        url: '/api/v1/users?role=EMPLOYEE',
        headers: manager.headers,
      });
      expect(ok.statusCode).toBe(200);
      const managers = await t.app.inject({
        method: 'GET',
        url: '/api/v1/users?role=MANAGER',
        headers: manager.headers,
      });
      expect(managers.statusCode).toBe(403);
      const admin = await t.as('ADMIN');
      const all = await t.app.inject({
        method: 'GET',
        url: '/api/v1/users?role=MANAGER',
        headers: admin.headers,
      });
      expect(
        all
          .json()
          .data.map((u: { role: string }) => u.role)
          .sort(),
      ).toEqual(['ADMIN', 'MANAGER']);
    });
  });

  describe('GET, PATCH and DELETE /users/:id', () => {
    it('shows details only to who may see that role', async () => {
      const client = await t.createUser('CLIENT');
      const staff = await t.createUser('EMPLOYEE');
      const { headers } = await t.as('EMPLOYEE');
      expect(
        (await t.app.inject({ method: 'GET', url: `/api/v1/users/${client.id}`, headers })).statusCode,
      ).toBe(200);
      expect(
        (await t.app.inject({ method: 'GET', url: `/api/v1/users/${staff.id}`, headers })).statusCode,
      ).toBe(404);
      expect((await t.app.inject({ method: 'GET', url: '/api/v1/users/999999', headers })).statusCode).toBe(
        404,
      );
    });

    it('shows the last five orders, requests and appointments to who may open them', async () => {
      const client = await t.createUser('CLIENT');
      const employee = await t.createUser('EMPLOYEE', { cpf: '11144477735' });
      const [type] = await t.db.insert(serviceTypes).values({ name: 'Conserto de geladeira' }).returning();
      for (let i = 0; i < 6; i++) {
        await t.db.insert(orders).values({
          customerId: client.id,
          channel: 'ONLINE',
          status: 'PENDING_REVIEW',
          totalCents: 1000 + i,
          createdById: client.id,
          createdAt: new Date(Date.UTC(2026, 9, 1 + i)),
        });
        const [request] = await t.db
          .insert(serviceRequests)
          .values({
            customerId: client.id,
            serviceTypeId: type!.id,
            productKind: 'Geladeira',
            problem: 'Não gela.',
            address: { ...ADDRESS, cep: '13800061', complement: null },
            status: 'SCHEDULED',
            createdById: client.id,
            createdAt: new Date(Date.UTC(2026, 9, 1 + i)),
          })
          .returning();
        await t.db.insert(appointments).values({
          serviceRequestId: request!.id,
          employeeId: employee.id,
          startsAt: new Date(Date.UTC(2026, 9, 10 + i, 12)),
          endsAt: new Date(Date.UTC(2026, 9, 10 + i, 14)),
          createdById: employee.id,
        });
      }
      const manager = await t.as('MANAGER');
      const customer = (
        await t.app.inject({ method: 'GET', url: `/api/v1/users/${client.id}`, headers: manager.headers })
      ).json();
      expect(customer.recentOrders).toHaveLength(5);
      expect(customer.recentOrders[0]).toMatchObject({ status: 'PENDING_REVIEW', totalCents: 1005 });
      expect(customer.recentOrders[0].number).toMatch(/^RC-\d{6}$/);
      expect(customer.recentServiceRequests).toHaveLength(5);
      expect(customer.recentServiceRequests[0]).toMatchObject({
        serviceType: 'Conserto de geladeira',
        productKind: 'Geladeira',
        status: 'SCHEDULED',
      });
      expect(customer.recentAppointments).toEqual([]);

      const technician = await t.as('EMPLOYEE');
      const limited = (
        await t.app.inject({ method: 'GET', url: `/api/v1/users/${client.id}`, headers: technician.headers })
      ).json();
      expect(limited).toMatchObject({ recentOrders: [], recentServiceRequests: [], recentAppointments: [] });

      const admin = await t.as('ADMIN');
      const staff = (
        await t.app.inject({ method: 'GET', url: `/api/v1/users/${employee.id}`, headers: admin.headers })
      ).json();
      expect(staff.recentAppointments).toHaveLength(5);
      expect(staff.recentAppointments[0]).toMatchObject({
        startsAt: '2026-10-15T12:00:00.000Z',
        customerName: client.name,
        serviceType: 'Conserto de geladeira',
      });
      expect(staff.recentOrders).toEqual([]);
      const self = (
        await t.app.inject({ method: 'GET', url: `/api/v1/users/${admin.user.id}`, headers: admin.headers })
      ).json();
      expect(self).toMatchObject({ recentOrders: [], recentServiceRequests: [], recentAppointments: [] });
    });

    it('lets the super user edit any account with an audit trail', async () => {
      const client = await t.createUser('CLIENT', { cpf: '52998224725' });
      const employee = await t.createUser('EMPLOYEE', { cpf: '11144477735' });
      const { headers } = await t.as('ADMIN');
      const edited = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${client.id}`,
        headers,
        payload: {
          name: 'Nome Corrigido Silva',
          email: 'corrigido@exemplo.com.br',
          address: { ...ADDRESS, complement: null },
          cpf: null,
        },
      });
      expect(edited.json()).toMatchObject({
        name: 'Nome Corrigido Silva',
        email: 'corrigido@exemplo.com.br',
        cpf: null,
      });
      const onlyAddress = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${client.id}`,
        headers,
        payload: { address: null },
      });
      expect(onlyAddress.json().address).toBeNull();
      const removeStaffCpf = await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${employee.id}`,
        headers,
        payload: { cpf: null },
      });
      expect(removeStaffCpf.json()).toMatchObject({ status: 422, title: 'CPF obrigatório' });
      const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'user.update'));
      expect(audit!.before).toMatchObject({ cpf: '52998224725' });
    });

    it('deletes by anonymizing, keeping orders, and never deletes the super user', async () => {
      const client = await t.createUser('CLIENT', { cpf: '52998224725', phone: '19999998888' });
      await t.login(client);
      await t.db.insert(orders).values({
        customerId: client.id,
        channel: 'ONLINE',
        status: 'PICKED_UP',
        totalCents: 1000,
        createdById: client.id,
      });
      const { headers, user: admin } = await t.as('ADMIN');
      const response = await t.app.inject({ method: 'DELETE', url: `/api/v1/users/${client.id}`, headers });
      expect(response.statusCode).toBe(204);
      const [row] = await t.db.select().from(users).where(eq(users.id, client.id));
      expect(row).toMatchObject({ name: 'Conta removida', cpf: null, phone: null, passwordHash: null });
      expect(row!.deletedAt).not.toBeNull();
      expect(await t.db.select().from(orders)).toHaveLength(1);
      const live = await t.db.select().from(sessions).where(eq(sessions.userId, client.id));
      expect(live.every((s) => s.revokedAt)).toBe(true);
      expect((await t.login(client)).response.statusCode).toBe(401);

      const self = await t.app.inject({ method: 'DELETE', url: `/api/v1/users/${admin.id}`, headers });
      expect(self.json()).toMatchObject({ status: 409, title: 'Não é possível excluir' });
      const again = await t.app.inject({ method: 'DELETE', url: `/api/v1/users/${client.id}`, headers });
      expect(again.statusCode).toBe(404);
    });
  });

  describe('/me', () => {
    it('updates the profile and requires confirmation for a new email', async () => {
      const { headers, user } = await t.as('CLIENT');
      const response = await t.app.inject({
        method: 'PATCH',
        url: '/api/v1/me',
        headers,
        payload: {
          name: 'Novo Nome Teste',
          email: 'novo@exemplo.com.br',
          address: { ...ADDRESS, complement: undefined },
        },
      });
      expect(response.json()).toMatchObject({
        profile: { name: 'Novo Nome Teste', email: user.email },
        emailVerificationPending: true,
      });
      await t.deliverEmails();
      expect(t.lastEmailTo('novo@exemplo.com.br')?.subject).toBe('Confirme seu novo email');

      const same = await t.app.inject({
        method: 'PATCH',
        url: '/api/v1/me',
        headers,
        payload: { email: user.email },
      });
      expect(same.json().emailVerificationPending).toBe(false);
    });

    it('refuses an email that belongs to someone else', async () => {
      const other = await t.createUser('CLIENT');
      const { headers } = await t.as('CLIENT');
      const response = await t.app.inject({
        method: 'PATCH',
        url: '/api/v1/me',
        headers,
        payload: { email: other.email },
      });
      expect(response.statusCode).toBe(409);
    });

    it('exports the personal data as a download', async () => {
      const { headers, user } = await t.as('CLIENT');
      const response = await t.app.inject({ method: 'GET', url: '/api/v1/me/data-export', headers });
      expect(response.headers['content-disposition']).toBe('attachment; filename="meus-dados.json"');
      expect(response.json()).toMatchObject({
        profile: { id: user.id },
        orders: [],
        serviceRequests: [],
        quotes: [],
      });
    });

    it('deletes the own account after confirming the password', async () => {
      const { headers, user } = await t.as('CLIENT');
      const wrong = await t.app.inject({
        method: 'DELETE',
        url: '/api/v1/me',
        headers,
        payload: { password: 'errada' },
      });
      expect(wrong.json()).toMatchObject({ status: 422, title: 'Senha incorreta' });
      const ok = await t.app.inject({
        method: 'DELETE',
        url: '/api/v1/me',
        headers,
        payload: { password: TEST_PASSWORD },
      });
      expect(ok.statusCode).toBe(204);
      expect((await t.login(user)).response.statusCode).toBe(401);
      const gone = await t.app.inject({ method: 'GET', url: '/api/v1/me', headers });
      expect(gone.statusCode).toBe(401);
    });

    it('does not let staff delete their own account', async () => {
      const { headers } = await t.as('ADMIN');
      const response = await t.app.inject({
        method: 'DELETE',
        url: '/api/v1/me',
        headers,
        payload: { password: TEST_PASSWORD },
      });
      expect(response.statusCode).toBe(403);
    });

    it('refuses invited users without a password', async () => {
      const { headers, user } = await t.as('CLIENT');
      await t.db.update(users).set({ passwordHash: null }).where(eq(users.id, user.id));
      const response = await t.app.inject({
        method: 'DELETE',
        url: '/api/v1/me',
        headers,
        payload: { password: 'x' },
      });
      expect(response.statusCode).toBe(422);
    });
  });

  describe('lookupCep', () => {
    it('fills missing fields with empty strings and keeps the cache bounded', async () => {
      const cityWide: typeof fetch = async () =>
        new Response(JSON.stringify({ cep: '13800-000', localidade: 'Mogi Mirim', uf: 'SP' }));
      expect(await lookupCep(cityWide, '13800000')).toEqual({
        cep: '13800000',
        street: '',
        district: '',
        city: 'Mogi Mirim',
        state: 'SP',
      });
      let calls = 0;
      const counting: typeof fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ logradouro: 'R', bairro: 'B', localidade: 'C', uf: 'SP' }));
      };
      for (let i = 0; i < 501; i += 1) await lookupCep(counting, String(10000000 + i));
      await lookupCep(counting, '10000000');
      expect(calls).toBe(502);
    });
  });

  describe('GET /addresses/lookup', () => {
    it('fills the address from the CEP and caches it', async () => {
      const response = await t.app.inject({ method: 'GET', url: '/api/v1/addresses/lookup?cep=13800-061' });
      expect(response.json()).toEqual({
        cep: '13800061',
        street: 'Rua Doutor Ulhoa Cintra',
        district: 'Centro',
        city: 'Mogi Mirim',
        state: 'SP',
      });
      const cached = await t.app.inject({ method: 'GET', url: '/api/v1/addresses/lookup?cep=13800061' });
      expect(cached.statusCode).toBe(200);
    });

    it('explains unknown CEPs, invalid CEPs and an unavailable service', async () => {
      expect(
        (await t.app.inject({ method: 'GET', url: '/api/v1/addresses/lookup?cep=99999999' })).json(),
      ).toMatchObject({
        status: 404,
        title: 'CEP não encontrado',
      });
      expect(
        (await t.app.inject({ method: 'GET', url: '/api/v1/addresses/lookup?cep=123' })).statusCode,
      ).toBe(422);
      expect(
        (await t.app.inject({ method: 'GET', url: '/api/v1/addresses/lookup?cep=00000000' })).json(),
      ).toMatchObject({
        status: 503,
        title: 'Consulta de CEP indisponível',
      });
    });
  });
});
