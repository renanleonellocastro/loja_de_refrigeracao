/** Sections of the signed in area. They render only in the browser (routeRules in nuxt.config.ts). */
export const PRIVATE_ROUTES = [
  '/perfil',
  '/notificacoes',
  '/painel',
  '/hoje',
  '/clientes',
  '/colaboradores',
  '/gerentes',
  '/auditoria',
  '/configuracoes',
] as const;
