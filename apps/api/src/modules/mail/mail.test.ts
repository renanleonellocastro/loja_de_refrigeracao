import { describe, expect, it } from 'vitest';
import { MemoryMailer } from '../../infra/mail/mailer.js';
import { testConfig } from '../../../test/harness.js';
import { emailHandler } from './service.js';
import { DEFAULT_FOOTER, escapeHtml, templates } from './templates.js';

const footer = { ...DEFAULT_FOOTER, appOrigin: 'https://refrigeracaocastro.com.br' };

describe('email templates', () => {
  it('escapes user provided values', () => {
    expect(escapeHtml(`<b>"Zé" & 'Ana'</b>`)).toBe('&lt;b&gt;&quot;Zé&quot; &amp; &#39;Ana&#39;&lt;/b&gt;');
    const email = templates.welcome({ name: '<script>x</script> Silva', email: 'a@b.com' }, footer);
    expect(email.html).not.toContain('<script>');
  });

  it('renders the branded layout and a plain text version', () => {
    const email = templates.passwordReset(
      { name: 'Eduardo Castro', link: 'https://x/redefinir-senha/abc' },
      footer,
    );
    expect(email.subject).toBe('Redefinição de senha');
    expect(email.html).toContain('https://refrigeracaocastro.com.br/brand/logo-email.png');
    expect(email.html).toContain('Olá, Eduardo!');
    expect(email.text).toContain('Criar nova senha: https://x/redefinir-senha/abc');
    expect(email.text).toContain('Rua Doutor Ulhoa Cintra, 91');
    expect(email.text).not.toContain('<');
  });

  it('renders generic notices with an optional action', () => {
    const withLink = templates.notice(
      {
        name: 'Ana Souza',
        subject: 'Pedido pronto',
        heading: 'Pode retirar',
        paragraphs: ['Seu pedido <RC-1> está pronto.'],
        link: 'https://x/p/1',
      },
      footer,
    );
    expect(withLink.html).toContain('Seu pedido &lt;RC-1&gt; está pronto.');
    expect(withLink.text).toContain('Ver detalhes: https://x/p/1');
    const custom = templates.notice(
      { name: 'Ana', subject: 's', heading: 'h', paragraphs: [], link: 'l', actionLabel: 'Responder' },
      footer,
    );
    expect(custom.text).toContain('Responder: l');
    const plain = templates.notice({ name: 'Ana', subject: 's', heading: 'h', paragraphs: ['p'] }, footer);
    expect(plain.text).not.toContain('Ver detalhes');
  });

  it('covers every template', () => {
    const all = [
      templates.invitation({ name: 'Ana', link: 'l', roleLabel: 'Gerente' }, footer),
      templates.passwordChanged({ name: 'Ana' }, footer),
      templates.emailVerification({ name: 'Ana', link: 'l' }, footer),
      templates.welcome({ name: 'Ana', email: 'ana@x.com' }, footer),
    ];
    expect(all.map((e) => e.subject)).toEqual([
      'Seu acesso à Refrigeração Castro',
      'Sua senha foi alterada',
      'Confirme seu novo email',
      'Bem vindo à Refrigeração Castro',
    ]);
    expect(all[1]!.text).not.toContain(': ');
  });
});

describe('emailHandler', () => {
  it('renders the template and sends it', async () => {
    const mailer = new MemoryMailer();
    const handler = emailHandler({ mailer, config: testConfig() });
    await handler({ to: 'ana@x.com', template: 'passwordChanged', data: { name: 'Ana' } });
    expect(mailer.sent[0]).toMatchObject({ to: 'ana@x.com', subject: 'Sua senha foi alterada' });
  });

  it('fails loudly for unknown templates', async () => {
    const handler = emailHandler({ mailer: new MemoryMailer(), config: testConfig() });
    await expect(handler({ to: 'a', template: 'nope', data: {} })).rejects.toThrowError(
      'Unknown email template nope',
    );
  });
});
