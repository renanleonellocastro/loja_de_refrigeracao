import type { Component } from 'vue';

/** Prop shapes shared by base components and the pages that feed them. */

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'start' | 'end';
  /** Low priority columns are hidden on tablets and only show on desktop. */
  priority?: 'high' | 'low';
}

export interface TimelineEvent {
  id: string | number;
  title: string;
  /** Already formatted date, for example "03/10/2026 às 14:20". */
  when: string;
  /** ISO date for the <time> element. */
  datetime?: string;
  description?: string;
  icon?: Component;
}

export interface DescriptionItem {
  term: string;
  detail: string;
}

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export interface Crumb {
  label: string;
  /** Omitted on the last crumb, the current page. */
  to?: string;
}

export interface MenuAction {
  label: string;
  icon?: Component;
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a separator before this item. */
  separated?: boolean;
  onSelect?: () => void;
}
