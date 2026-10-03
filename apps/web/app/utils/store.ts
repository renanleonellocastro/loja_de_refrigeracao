/**
 * Public store data from docs/LOJA.md. Milestone M8 moves it to the store settings served by the API;
 * until then the site reads it from here.
 */
export const STORE_INFO = {
  name: 'Refrigeração Castro',
  legalName: 'Refrigeração Castro Ltda ME',
  cnpj: '63.060.560/0001-51',
  since: 1990,
  street: 'Rua Doutor Ulhoa Cintra, 91',
  district: 'Centro',
  city: 'Mogi Mirim/SP',
  cep: '13800-061',
  phone: '(19) 3804-1658',
  phoneHref: 'tel:+551938041658',
  /** Placeholder until the owner confirms the WhatsApp number (docs/REQUISITOS.md Q2). */
  whatsapp: '551938041658',
  email: 'refrigeracaocastro@yahoo.com.br',
  hours: 'Segunda a sexta, das 9h às 18h',
} as const;

export const PUBLIC_NAV: ReadonlyArray<{ label: string; to: string }> = [
  { label: 'Início', to: '/' },
  { label: 'Produtos', to: '/produtos' },
  { label: 'Serviços', to: '/servicos' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Contato', to: '/contato' },
];
