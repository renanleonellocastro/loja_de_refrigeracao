import { ACTORS } from '@rc/contracts';
import { describe, expect, it } from 'vitest';
import { BOTTOM_NAV_SIZE, navigationFor } from '~/utils/navigation';

const routes = (actor: Parameters<typeof navigationFor>[0]) =>
  navigationFor(actor).items.map((item) => item.to);

describe('navigationFor', () => {
  it('gives guests no area menu', () => {
    expect(navigationFor('GUEST')).toEqual({ groups: [], items: [], bottom: [], more: [] });
  });

  it('follows the customer screen map', () => {
    expect(routes('CLIENT')).toEqual([
      '/',
      '/produtos',
      '/minha-conta/pedidos',
      '/minha-conta/agendamentos',
      '/minha-conta/orcamentos',
      '/perfil',
    ]);
  });

  it('starts technicians on "Hoje" without the dashboard', () => {
    expect(routes('EMPLOYEE')).toEqual(['/hoje', '/balcao', '/agenda', '/clientes', '/perfil']);
  });

  it('gives managers the operation and catalog, without administration', () => {
    const list = routes('MANAGER');
    expect(list).toContain('/painel');
    expect(list).toContain('/aprovacoes');
    expect(list).toContain('/produtos/gerenciar');
    expect(list).toContain('/colaboradores');
    expect(list).not.toContain('/gerentes');
    expect(list).not.toContain('/auditoria');
    expect(list).not.toContain('/hoje');
  });

  it('gives the super user everything for staff', () => {
    const list = routes('ADMIN');
    for (const route of ['/gerentes', '/categorias', '/tipos-de-servico', '/configuracoes', '/auditoria']) {
      expect(list).toContain(route);
    }
    expect(navigationFor('ADMIN').groups.map((group) => group.label)).toEqual([
      'Operação',
      'Cadastros',
      'Administração',
      'Conta',
    ]);
  });

  it('splits the phone bottom bar from the "Mais" sheet', () => {
    for (const actor of ACTORS) {
      const nav = navigationFor(actor);
      expect(nav.bottom.length).toBeLessThanOrEqual(BOTTOM_NAV_SIZE);
      expect([...nav.bottom, ...nav.more]).toEqual(nav.items);
    }
    expect(navigationFor('MANAGER').bottom.map((item) => item.label)).toEqual([
      'Painel',
      'Pedidos',
      'Balcão',
      'Agenda',
    ]);
  });
});
