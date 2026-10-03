import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { enqueue, type OutboxHandler } from '../outbox/service.js';
import { DEFAULT_FOOTER, templates, type TemplateName } from './templates.js';

export const EMAIL_TOPIC = 'email.send';

type TemplateData<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];

/** Queues a transactional email; it is sent by the worker after the transaction commits. */
export function queueEmail<T extends TemplateName>(
  db: Executor,
  to: string,
  template: T,
  data: TemplateData<T>,
) {
  return enqueue(db, EMAIL_TOPIC, { to, template, data });
}

export function emailHandler(ctx: Pick<AppContext, 'mailer' | 'config'>): OutboxHandler {
  return async (payload) => {
    const template = payload.template as TemplateName;
    const render = templates[template] as (
      data: unknown,
      footer: typeof DEFAULT_FOOTER & { appOrigin: string },
    ) => {
      subject: string;
      html: string;
      text: string;
    };
    if (!render) throw new Error(`Unknown email template ${String(template)}`);
    const email = render(payload.data, { ...DEFAULT_FOOTER, appOrigin: ctx.config.APP_ORIGIN });
    await ctx.mailer.send({ to: String(payload.to), ...email });
  };
}
