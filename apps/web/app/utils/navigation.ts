import { can, type Actor } from '@rc/contracts';
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  FolderTree,
  Gauge,
  Home,
  Inbox,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Sun,
  UserCog,
  UserRound,
  Users,
  Wrench,
} from 'lucide-vue-next';
import type { Component } from 'vue';

export interface NavItem {
  label: string;
  to: string;
  icon: Component;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface AreaNavigation {
  groups: NavGroup[];
  /** Every item in display order, flattened from the groups. */
  items: NavItem[];
  /** Up to four items for the phone bottom bar. */
  bottom: NavItem[];
  /** The remaining items, shown in the "Mais" sheet on phones. */
  more: NavItem[];
}

interface Entry extends NavItem {
  visible: (actor: Actor) => boolean;
}

export const BOTTOM_NAV_SIZE = 4;

/** Only customers decide on quotes, so this permission identifies the customer area. */
const isCustomer = (actor: Actor) => can(actor, 'quotes.decide');
/** Technicians complete their own services and start the day on "Hoje" instead of the dashboard. */
const isTechnician = (actor: Actor) => can(actor, 'appointments.complete');

/** Screen map from docs/DESIGN.md section 4. Order matters: the first visible items go to the phone bottom bar. */
const GROUPS: ReadonlyArray<{ label: string; entries: Entry[] }> = [
  {
    label: 'Minha conta',
    entries: [
      { label: 'Início', to: '/', icon: Home, visible: isCustomer },
      { label: 'Produtos', to: '/produtos', icon: ShoppingBag, visible: isCustomer },
      { label: 'Carrinho', to: '/carrinho', icon: ShoppingCart, visible: isCustomer },
      { label: 'Pedidos', to: '/minha-conta/pedidos', icon: Package, visible: isCustomer },
      {
        label: 'Agendamentos',
        to: '/minha-conta/agendamentos',
        icon: CalendarDays,
        visible: isCustomer,
      },
      { label: 'Orçamentos', to: '/minha-conta/orcamentos', icon: ReceiptText, visible: isCustomer },
    ],
  },
  {
    label: 'Operação',
    entries: [
      {
        label: 'Painel',
        to: '/painel',
        icon: Gauge,
        visible: (a) => can(a, 'dashboard.read') && !isTechnician(a),
      },
      { label: 'Hoje', to: '/hoje', icon: Sun, visible: isTechnician },
      { label: 'Pedidos', to: '/pedidos', icon: Package, visible: (a) => can(a, 'orders.manage') },
      { label: 'Balcão', to: '/balcao', icon: Store, visible: (a) => can(a, 'counterSales.create') },
      {
        label: 'Agenda',
        to: '/agenda',
        icon: CalendarDays,
        visible: (a) => can(a, 'appointments.read'),
      },
      {
        label: 'Solicitações',
        to: '/solicitacoes',
        icon: Inbox,
        visible: (a) => can(a, 'serviceRequests.manage'),
      },
      { label: 'Orçamentos', to: '/orcamentos', icon: ReceiptText, visible: (a) => can(a, 'quotes.answer') },
      {
        label: 'Aprovações',
        to: '/aprovacoes',
        icon: BadgeCheck,
        visible: (a) => can(a, 'appointments.approve'),
      },
    ],
  },
  {
    label: 'Cadastros',
    entries: [
      {
        label: 'Produtos',
        to: '/produtos/gerenciar',
        icon: ClipboardList,
        visible: (a) => can(a, 'products.manage'),
      },
      { label: 'Clientes', to: '/clientes', icon: Users, visible: (a) => can(a, 'customers.read') },
      {
        label: 'Colaboradores',
        to: '/colaboradores',
        icon: Wrench,
        visible: (a) => can(a, 'employees.read'),
      },
      { label: 'Gerentes', to: '/gerentes', icon: UserCog, visible: (a) => can(a, 'managers.manage') },
      {
        label: 'Categorias',
        to: '/categorias',
        icon: FolderTree,
        visible: (a) => can(a, 'categories.manage'),
      },
      {
        label: 'Tipos de serviço',
        to: '/tipos-de-servico',
        icon: ShieldCheck,
        visible: (a) => can(a, 'serviceTypes.manage'),
      },
    ],
  },
  {
    label: 'Administração',
    entries: [
      {
        label: 'Configurações',
        to: '/configuracoes',
        icon: Settings,
        visible: (a) => can(a, 'store.manage'),
      },
      { label: 'Auditoria', to: '/auditoria', icon: ScrollText, visible: (a) => can(a, 'audit.read') },
    ],
  },
  {
    label: 'Conta',
    entries: [{ label: 'Perfil', to: '/perfil', icon: UserRound, visible: (a) => can(a, 'profile.manage') }],
  },
];

/** Menu of the signed in area for an actor, derived from the permission matrix in @rc/contracts. */
export function navigationFor(actor: Actor): AreaNavigation {
  const groups: NavGroup[] = [];
  for (const group of GROUPS) {
    const items = group.entries
      .filter((entry) => entry.visible(actor))
      .map(({ label, to, icon }) => ({ label, to, icon }));
    if (items.length > 0) groups.push({ label: group.label, items });
  }
  const items = groups.flatMap((group) => group.items);
  return {
    groups,
    items,
    bottom: items.slice(0, BOTTOM_NAV_SIZE),
    more: items.slice(BOTTOM_NAV_SIZE),
  };
}
