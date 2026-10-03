import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { requireAuth } from '../../plugins/auth.js';
import { etagFor } from '../../shared/concurrency.js';
import { errorResponses, idParamSchema, noContentSchema } from '../../shared/schemas.js';
import { readMultipart } from '../media/service.js';
import * as agenda from './agenda.js';
import {
  appointmentCreationSchema,
  appointmentSchema,
  appointmentUpdateSchema,
  availabilitySchema,
  rangeQuerySchema,
  reportApprovalSchema,
  reportInputSchema,
  reworkSchema,
} from './schemas.js';

const security = [{ bearerAuth: [] }];

export function agendaRoutes(ctx: AppContext): FastifyPluginAsyncZod {
  return async (app) => {
    const tags = ['Agenda'];

    const sendAppointment = async (auth: ReturnType<typeof requireAuth>, id: number) => {
      const view = await agenda.getAppointment(ctx, auth, id);
      return { view, etag: etagFor(view.version) };
    };

    app.get(
      '/appointments',
      {
        config: { permission: 'appointments.read' },
        schema: {
          tags,
          summary: 'Agenda em um período',
          description:
            'O colaborador vê a própria agenda; a gerência vê todos ou filtra por employeeId. Máximo de 62 dias.',
          security,
          querystring: rangeQuerySchema,
          response: { 200: z.array(appointmentSchema), ...errorResponses },
        },
      },
      async (request) => agenda.listAgenda(ctx, requireAuth(request), request.query),
    );

    app.get(
      '/appointments/:id',
      {
        config: { permission: 'appointments.read' },
        schema: {
          tags,
          summary: 'Detalhes de um atendimento',
          security,
          params: idParamSchema,
          response: { 200: appointmentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const { view, etag } = await sendAppointment(requireAuth(request), request.params.id);
        return reply.header('etag', etag).send(view);
      },
    );

    app.post(
      '/appointments',
      {
        config: { permission: 'appointments.manage' },
        schema: {
          tags,
          summary: 'Cadastrar o serviço aprovado na agenda de um colaborador',
          description:
            'Sem endsAt, usa a duração estimada do tipo de serviço. Conflito de horário responde 409.',
          security,
          body: appointmentCreationSchema,
          response: { 201: appointmentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        const created = await agenda.scheduleAppointment(ctx, auth, request.body, request.ip);
        const { view, etag } = await sendAppointment(auth, created.id);
        return reply
          .code(201)
          .header('location', `/api/v1/appointments/${created.id}`)
          .header('etag', etag)
          .send(view);
      },
    );

    app.patch(
      '/appointments/:id',
      {
        config: { permission: 'appointments.manage' },
        schema: {
          tags,
          summary: 'Remarcar ou trocar o colaborador (exige If-Match)',
          security,
          params: idParamSchema,
          body: appointmentUpdateSchema,
          response: { 200: appointmentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        await agenda.rescheduleAppointment(
          ctx,
          auth,
          request.params.id,
          request.headers['if-match'],
          request.body,
          request.ip,
        );
        const { view, etag } = await sendAppointment(auth, request.params.id);
        return reply.header('etag', etag).send(view);
      },
    );

    app.delete(
      '/appointments/:id',
      {
        config: { permission: 'appointments.delete' },
        schema: {
          tags,
          summary: 'Excluir o atendimento da agenda',
          security,
          params: idParamSchema,
          response: { 204: noContentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        await agenda.removeAppointment(ctx, requireAuth(request), request.params.id, request.ip);
        return reply.code(204).send();
      },
    );

    app.get(
      '/employees/availability',
      {
        config: { permission: 'appointments.manage' },
        schema: {
          tags,
          summary: 'Horários ocupados de cada colaborador',
          security,
          querystring: rangeQuerySchema,
          response: { 200: availabilitySchema, ...errorResponses },
        },
      },
      async (request) => agenda.availability(ctx, request.query.from, request.query.to),
    );

    app.post(
      '/appointments/:id/report',
      {
        config: { permission: 'appointments.complete' },
        schema: {
          tags,
          summary: 'Finalizar o serviço (técnico do atendimento)',
          security,
          params: idParamSchema,
          body: reportInputSchema,
          response: { 200: appointmentSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await agenda.submitReport(ctx, auth, request.params.id, request.body);
        return agenda.getAppointment(ctx, auth, request.params.id);
      },
    );

    app.post(
      '/appointments/:id/report/photos',
      {
        config: { permission: 'appointments.complete' },
        schema: {
          tags,
          summary: 'Enviar fotos do serviço realizado (multipart, até 8)',
          security,
          params: idParamSchema,
          response: { 201: appointmentSchema, ...errorResponses },
        },
      },
      async (request, reply) => {
        const auth = requireAuth(request);
        await agenda.getAppointment(ctx, auth, request.params.id);
        const form = await readMultipart(request, agenda.MAX_REPORT_PHOTOS);
        return reply.code(201).send(await agenda.addReportPhotos(ctx, auth, request.params.id, form.files));
      },
    );

    app.post(
      '/appointments/:id/report/approval',
      {
        config: { permission: 'appointments.approve' },
        schema: {
          tags,
          summary: 'Aprovar a finalização com o valor do serviço',
          security,
          params: idParamSchema,
          body: reportApprovalSchema,
          response: { 200: appointmentSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await agenda.approveReport(ctx, auth, request.params.id, request.body.amountCents, request.ip);
        return agenda.getAppointment(ctx, auth, request.params.id);
      },
    );

    app.post(
      '/appointments/:id/report/rework',
      {
        config: { permission: 'appointments.approve' },
        schema: {
          tags,
          summary: 'Devolver a finalização para ajuste',
          security,
          params: idParamSchema,
          body: reworkSchema,
          response: { 200: appointmentSchema, ...errorResponses },
        },
      },
      async (request) => {
        const auth = requireAuth(request);
        await agenda.requestRework(ctx, auth, request.params.id, request.body.comment, request.ip);
        return agenda.getAppointment(ctx, auth, request.params.id);
      },
    );
  };
}
