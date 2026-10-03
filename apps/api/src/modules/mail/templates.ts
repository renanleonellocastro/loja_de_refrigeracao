export interface Email {
  subject: string;
  html: string;
  text: string;
}

export interface StoreFooter {
  appOrigin: string;
  phone: string;
  address: string;
}

export const DEFAULT_FOOTER: Omit<StoreFooter, 'appOrigin'> = {
  phone: '(19) 3804-1658',
  address: 'Rua Doutor Ulhoa Cintra, 91, Centro, Mogi Mirim/SP',
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface Block {
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  note?: string;
}

/** Branded, table based layout that renders in the common email clients. */
function layout(block: Block, footer: StoreFooter): string {
  const paragraphs = block.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#14181F">${p}</p>`)
    .join('');
  const action = block.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(block.action.url)}" style="display:inline-block;background:#184E86;color:#FFFFFF;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:10px">${escapeHtml(block.action.label)}</a></p>`
    : '';
  const note = block.note
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#5B6470">${block.note}</p>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(block.heading)}</title></head><body style="margin:0;background:#F6F7F9;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden"><tr><td style="background:#184E86;padding:24px;text-align:center"><img src="${footer.appOrigin}/brand/logo-email.png" width="220" alt="Refrigeração Castro" style="display:inline-block;border:0"></td></tr><tr><td style="padding:32px 28px"><h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0E2E52">${escapeHtml(block.heading)}</h1>${paragraphs}${action}${note}</td></tr><tr><td style="background:#0E2E52;padding:20px 28px;color:#DCE8F6;font-size:13px;line-height:1.6;text-align:center">Refrigeração Castro · ${escapeHtml(footer.address)}<br>${escapeHtml(footer.phone)} · <a href="${footer.appOrigin}" style="color:#FFFFFF">${footer.appOrigin.replace(/^https?:\/\//, '')}</a></td></tr></table></td></tr></table></body></html>`;
}

function plain(block: Block, footer: StoreFooter): string {
  const strip = (html: string) => html.replace(/<[^>]+>/g, '');
  return [
    block.heading,
    '',
    ...block.paragraphs.map(strip),
    ...(block.action ? ['', `${block.action.label}: ${block.action.url}`] : []),
    ...(block.note ? ['', strip(block.note)] : []),
    '',
    `Refrigeração Castro · ${footer.address} · ${footer.phone}`,
  ].join('\n');
}

function build(subject: string, block: Block, footer: StoreFooter): Email {
  return { subject, html: layout(block, footer), text: plain(block, footer) };
}

const firstName = (name: string) => escapeHtml(name.trim().split(/\s+/, 1).join(''));

export const templates = {
  passwordReset(data: { name: string; link: string }, footer: StoreFooter): Email {
    return build(
      'Redefinição de senha',
      {
        heading: 'Vamos criar uma nova senha',
        paragraphs: [
          `Olá, ${firstName(data.name)}!`,
          'Recebemos um pedido para redefinir a senha da sua conta.',
        ],
        action: { label: 'Criar nova senha', url: data.link },
        note: 'O link vale por 30 minutos e só pode ser usado uma vez. Se você não pediu, ignore este email.',
      },
      footer,
    );
  },
  invitation(data: { name: string; link: string; roleLabel: string }, footer: StoreFooter): Email {
    return build(
      'Seu acesso à Refrigeração Castro',
      {
        heading: 'Seu acesso está pronto',
        paragraphs: [
          `Olá, ${firstName(data.name)}!`,
          `Criamos sua conta como <strong>${escapeHtml(data.roleLabel)}</strong>. Defina sua senha para começar.`,
        ],
        action: { label: 'Definir minha senha', url: data.link },
        note: 'O link vale por 7 dias.',
      },
      footer,
    );
  },
  passwordChanged(data: { name: string }, footer: StoreFooter): Email {
    return build(
      'Sua senha foi alterada',
      {
        heading: 'Senha alterada',
        paragraphs: [
          `Olá, ${firstName(data.name)}!`,
          'A senha da sua conta acabou de ser alterada e as outras sessões foram encerradas.',
        ],
        note: `Não foi você? Ligue para a loja no ${escapeHtml(footer.phone)}.`,
      },
      footer,
    );
  },
  emailVerification(data: { name: string; link: string }, footer: StoreFooter): Email {
    return build(
      'Confirme seu novo email',
      {
        heading: 'Confirme seu novo email',
        paragraphs: [
          `Olá, ${firstName(data.name)}!`,
          'Clique no botão para confirmar este endereço de email.',
        ],
        action: { label: 'Confirmar email', url: data.link },
        note: 'O link vale por 24 horas.',
      },
      footer,
    );
  },
  welcome(data: { name: string; email: string }, footer: StoreFooter): Email {
    return build(
      'Bem vindo à Refrigeração Castro',
      {
        heading: 'Cadastro feito!',
        paragraphs: [
          `Olá, ${firstName(data.name)}! Que bom ter você por aqui.`,
          `Sua conta foi criada com o email <strong>${escapeHtml(data.email)}</strong>. Agora você pode comprar produtos, pedir orçamentos e agendar visitas pelo site.`,
        ],
        action: { label: 'Acessar minha conta', url: `${footer.appOrigin}/perfil` },
      },
      footer,
    );
  },
  /** Generic event notice used by orders, services and quotes. Paragraphs are plain text. */
  notice(
    data: {
      name: string;
      subject: string;
      heading: string;
      paragraphs: string[];
      link?: string;
      actionLabel?: string;
    },
    footer: StoreFooter,
  ): Email {
    return build(
      data.subject,
      {
        heading: data.heading,
        paragraphs: [`Olá, ${firstName(data.name)}!`, ...data.paragraphs.map(escapeHtml)],
        ...(data.link ? { action: { label: data.actionLabel ?? 'Ver detalhes', url: data.link } } : {}),
      },
      footer,
    );
  },
} as const;

export type TemplateName = keyof typeof templates;
