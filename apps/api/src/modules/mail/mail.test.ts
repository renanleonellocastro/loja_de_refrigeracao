import { describe, expect, it } from 'vitest';
import { storeSettings } from '../../infra/db/schema.js';
import { useTestApp } from '../../../test/harness.js';
import { FALLBACK_FOOTER, formatAddress, formatPhone, storeFooter } from './footer.js';
import { emailHandler } from './service.js';
import { escapeHtml, templates } from './templates.js';

const footer = { ...FALLBACK_FOOTER, appOrigin: 'https://refrigeracaocastro.com.br' };

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
    expect(email.text).toContain('Rua Doutor Ulhôa Cintra, 91');
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

const ADDRESS = {
  cep: '13800061',
  street: 'Rua das Palmeiras',
  number: '200',
  complement: 'Loja 2',
  district: 'Jardim Santa Helena',
  city: 'Mogi Mirim',
  state: 'SP',
};
const ORIGIN = 'https://refrigeracaocastro.com.br';

describe('store footer', () => {
  it('formats the configured store data for display', () => {
    const contact = { name: 'Castro Peças', phone: '19998765432', whatsapp: '19998761111', address: ADDRESS };
    expect(storeFooter(contact, ORIGIN)).toEqual({
      appOrigin: ORIGIN,
      name: 'Castro Peças',
      phone: '(19) 99876-5432',
      whatsapp: '(19) 99876-1111',
      address: 'Rua das Palmeiras, 200, Loja 2, Jardim Santa Helena, Mogi Mirim/SP',
    });
    expect(formatPhone('1938041658')).toBe('(19) 3804-1658');
    expect(formatPhone(' 0800 ')).toBe('0800');
    expect(formatAddress({ ...ADDRESS, complement: null, state: ' ' })).toBe(
      'Rua das Palmeiras, 200, Jardim Santa Helena, Mogi Mirim',
    );
  });

  it('falls back only for the fields left empty', () => {
    const blank = { ...ADDRESS, street: ' ' };
    expect(storeFooter({ name: ' ', phone: '', whatsapp: null, address: blank }, ORIGIN)).toEqual({
      ...FALLBACK_FOOTER,
      appOrigin: ORIGIN,
    });
    expect(
      storeFooter({ name: 'Castro', phone: '', whatsapp: null, address: ADDRESS }, ORIGIN),
    ).toMatchObject({
      name: 'Castro',
      phone: FALLBACK_FOOTER.phone,
    });
  });
});

describe('emailHandler', () => {
  const t = useTestApp();

  const send = (template: string, data: unknown) => emailHandler(t.ctx)({ to: 'ana@x.com', template, data });

  it('renders the template with the stored store data in the footer', async () => {
    await send('passwordChanged', { name: 'Ana' });
    const first = t.mailer.sent[0]!;
    expect(first).toMatchObject({ to: 'ana@x.com', subject: 'Sua senha foi alterada' });
    expect(
      first.text.endsWith(
        'Refrigeração Castro · Rua Doutor Ulhôa Cintra, 91, Centro, Mogi Mirim/SP · (19) 3804-1658 · WhatsApp (19) 99764-1658',
      ),
    ).toBe(true);
    await t.db
      .update(storeSettings)
      .set({ name: 'Castro & Filhos', phone: '19998765432', whatsapp: '19998761111', address: ADDRESS });
    await send('passwordChanged', { name: 'Ana' });
    const second = t.mailer.sent[1]!;
    expect(second.text).toContain(
      'Castro & Filhos · Rua das Palmeiras, 200, Loja 2, Jardim Santa Helena, Mogi Mirim/SP · (19) 99876-5432 · WhatsApp (19) 99876-1111',
    );
    expect(second.text).toContain('Ligue para a loja no (19) 99876-5432.');
    expect(second.html).toContain('Castro &amp; Filhos · Rua das Palmeiras, 200');
    expect(second.html).not.toContain('3804-1658');
  });

  it('fails loudly for unknown templates', async () => {
    await expect(send('nope', {})).rejects.toThrowError('Unknown email template nope');
  });
});
