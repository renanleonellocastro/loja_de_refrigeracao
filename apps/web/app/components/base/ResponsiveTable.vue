<script setup lang="ts" generic="Row extends Record<string, unknown>">
import type { TableColumn } from '~/utils/types';
/**
 * Table on tablets and desktops, stacked cards on phones. The first column is the card title.
 * Slot `#cell-<key>` customizes a cell in both views; `#empty` shows when there are no rows.
 */
const props = withDefaults(
  defineProps<{
    columns: TableColumn[];
    rows: Row[];
    rowKey: keyof Row & string;
    /** Describes the table for screen readers. */
    caption: string;
    loading?: boolean;
    skeletonRows?: number;
  }>(),
  { skeletonRows: 4 },
);

const titleColumn = computed(() => props.columns[0]!);
const detailColumns = computed(() => props.columns.slice(1));

function cellText(row: Row, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? '' : String(value);
}

function alignClass(column: TableColumn): string {
  return column.align === 'end' ? 'text-right tabular-nums' : 'text-left';
}

function priorityClass(column: TableColumn): string {
  return column.priority === 'low' ? 'hidden lg:table-cell' : '';
}
</script>

<template>
  <div :aria-busy="loading || undefined">
    <div v-if="loading" class="flex flex-col gap-3" role="status" aria-label="Carregando">
      <div
        v-for="index in skeletonRows"
        :key="index"
        class="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
      >
        <BaseSkeleton class="size-10 rounded-full" />
        <div class="flex flex-1 flex-col gap-2">
          <BaseSkeleton class="h-4 w-2/5 rounded-sm" />
          <BaseSkeleton class="h-3 w-3/5 rounded-sm" />
        </div>
        <BaseSkeleton class="hidden h-6 w-24 rounded-full sm:block" />
      </div>
    </div>

    <div v-else-if="rows.length === 0">
      <slot name="empty">
        <BaseEmptyState
          title="Nada por aqui ainda"
          text="Quando houver registros, eles aparecem nesta lista."
        />
      </slot>
    </div>

    <template v-else>
      <div class="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-sm md:block">
        <table class="w-full border-collapse text-sm">
          <caption class="sr-only">
            {{
              caption
            }}
          </caption>
          <thead class="bg-surface-sunken/70">
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                scope="col"
                class="px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase first:pl-6 last:pr-6"
                :class="[alignClass(column), priorityClass(column)]"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="row in rows"
              :key="String(row[rowKey])"
              class="transition-colors duration-150 hover:bg-info-soft/40"
            >
              <td
                v-for="column in columns"
                :key="column.key"
                class="px-4 py-3.5 text-text first:pl-6 first:font-semibold last:pr-6"
                :class="[alignClass(column), priorityClass(column)]"
              >
                <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                  {{ cellText(row, column.key) }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="flex flex-col gap-3 md:hidden" :aria-label="caption">
        <li
          v-for="row in rows"
          :key="String(row[rowKey])"
          class="rounded-lg border border-border bg-surface p-4 shadow-sm"
        >
          <p class="font-semibold text-text">
            <slot :name="`cell-${titleColumn.key}`" :row="row" :value="row[titleColumn.key]">
              {{ cellText(row, titleColumn.key) }}
            </slot>
          </p>
          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <template v-for="column in detailColumns" :key="column.key">
              <dt class="text-text-muted">{{ column.label }}</dt>
              <dd class="min-w-0 text-right text-text">
                <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                  {{ cellText(row, column.key) }}
                </slot>
              </dd>
            </template>
          </dl>
        </li>
      </ul>
    </template>
  </div>
</template>
