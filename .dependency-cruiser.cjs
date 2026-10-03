/** Module boundaries of the API (docs/ARQUITETURA.md section 2). */
module.exports = {
  forbidden: [
    {
      name: 'routes-do-not-touch-repositories',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/routes\\.ts$' },
      to: { path: 'repository\\.ts$' },
    },
    {
      name: 'modules-talk-through-services',
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/' },
      to: { path: 'src/modules/([^/]+)/(?!service\\.ts|schemas\\.ts)', pathNot: 'src/modules/$1/' },
    },
    {
      name: 'shared-is-independent',
      severity: 'error',
      from: { path: 'src/shared/' },
      to: { path: 'src/(modules|infra)/' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
