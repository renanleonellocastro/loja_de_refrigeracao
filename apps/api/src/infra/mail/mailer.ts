import nodemailer from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** SMTP in production; any Nodemailer transport (for example a JSON transport) can be passed for tests. */
export function createSmtpMailer(
  transportConfig: string | Parameters<typeof nodemailer.createTransport>[0],
  from: string,
): Mailer {
  const transport = nodemailer.createTransport(transportConfig);
  return {
    async send(message) {
      await transport.sendMail({ from, ...message });
    },
  };
}

/** Keeps messages in memory; used in tests. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}
