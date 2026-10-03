<script setup lang="ts">
import type { MenuAction } from '~/utils/types';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui';

/** Actions menu (dropdown). The trigger slot must contain a single focusable button. */
withDefaults(defineProps<{ items: MenuAction[]; heading?: string; align?: 'start' | 'end' }>(), {
  heading: undefined,
  align: 'end',
});

const ITEM =
  'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm font-medium outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="align"
        :side-offset="8"
        class="z-50 min-w-56 rounded-lg border border-border bg-surface-raised p-1.5 shadow-lg data-[state=open]:animate-rc-rise"
      >
        <DropdownMenuLabel v-if="heading || $slots.heading" class="px-3 py-2">
          <slot name="heading">
            <span class="text-xs font-semibold tracking-wide text-text-muted uppercase">{{ heading }}</span>
          </slot>
        </DropdownMenuLabel>
        <template v-for="item in items" :key="item.label">
          <DropdownMenuSeparator v-if="item.separated" class="my-1 h-px bg-border" />
          <DropdownMenuItem
            :as-child="Boolean(item.to)"
            :disabled="item.disabled"
            :class="[
              ITEM,
              item.danger
                ? 'text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-on-danger-soft'
                : 'text-text data-[highlighted]:bg-info-soft data-[highlighted]:text-on-info-soft',
            ]"
            @select="item.onSelect?.()"
          >
            <NuxtLink v-if="item.to" :to="item.to" :class="ITEM">
              <component :is="item.icon" v-if="item.icon" class="size-4.5" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
            <template v-else>
              <component :is="item.icon" v-if="item.icon" class="size-4.5" aria-hidden="true" />
              {{ item.label }}
            </template>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
