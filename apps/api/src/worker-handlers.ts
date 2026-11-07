import type { AppContext } from './context.js';
import { EMAIL_TOPIC, emailHandler } from './modules/mail/service.js';
import { IMAGE_VARIANTS_TOPIC, imageVariantsHandler } from './modules/media/service.js';
import type { OutboxHandlers } from './modules/outbox/service.js';

/** What the worker does with each outbox topic (ADR 0009). */
export function workerHandlers(ctx: AppContext): OutboxHandlers {
  return {
    [EMAIL_TOPIC]: emailHandler(ctx),
    [IMAGE_VARIANTS_TOPIC]: imageVariantsHandler(ctx.storage),
  };
}
