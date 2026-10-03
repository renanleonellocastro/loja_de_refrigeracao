import type { Config } from './config.js';
import type { Database } from './infra/db/client.js';
import type { Mailer } from './infra/mail/mailer.js';
import type { Storage } from './infra/storage/storage.js';
import type { Clock } from './shared/clock.js';

/** Everything a service needs from the outside world, injected for testability. */
export interface AppContext {
  config: Config;
  db: Database;
  mailer: Mailer;
  storage: Storage;
  clock: Clock;
}
