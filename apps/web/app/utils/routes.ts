/**
 * Sections that depend on this browser: the signed in area and the cart (kept in localStorage for visitors).
 * They render only in the browser (routeRules in nuxt.config.ts).
 */
export const PRIVATE_ROUTES = [
  '/perfil',
  '/carrinho',
  '/minha-conta',
  '/notificacoes',
  '/painel',
  '/hoje',
  '/clientes',
  '/colaboradores',
  '/gerentes',
  '/auditoria',
  '/configuracoes',
  '/agendar',
  '/solicitacoes',
  '/agenda',
  '/aprovacoes',
  '/orcamento',
  '/orcamentos',
  '/pedidos',
  '/balcao',
  '/produtos/gerenciar',
  '/categorias',
  '/tipos-de-servico',
] as const;
