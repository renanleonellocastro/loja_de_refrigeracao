<script setup lang="ts">
import { THEME_OPTIONS } from '~/utils/theme';
import { Monitor, Moon, Sun } from 'lucide-vue-next';

/** Claro, escuro or automático. Native radios: arrow keys move, the choice applies and is remembered at once. */
const props = withDefaults(defineProps<{ tone?: 'surface' | 'brand'; block?: boolean }>(), {
  tone: 'surface',
});

const { preference, setPreference } = useTheme();
const name = `theme-${useId()}`;
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

const STYLES = {
  surface: {
    frame: 'bg-surface-sunken ring-1 ring-border',
    active: 'bg-surface text-text shadow-sm ring-1 ring-border',
    idle: 'text-text-muted hover:text-text',
  },
  brand: {
    frame: 'bg-white/10 ring-1 ring-white/20',
    active: 'bg-white text-castro-800 shadow-sm',
    idle: 'text-castro-100 hover:text-white',
  },
} as const;

const style = computed(() => STYLES[props.tone]);
</script>

<template>
  <fieldset class="rounded-full p-1" :class="[style.frame, block ? 'flex w-full' : 'inline-flex']">
    <legend class="sr-only">Tema</legend>
    <label
      v-for="option in THEME_OPTIONS"
      :key="option.value"
      class="relative flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
      :class="[preference === option.value ? style.active : style.idle, block ? 'flex-1 px-2' : 'px-3']"
    >
      <input
        type="radio"
        class="sr-only"
        :name="name"
        :value="option.value"
        :checked="preference === option.value"
        @change="setPreference(option.value)"
      />
      <component :is="ICONS[option.value]" class="size-4 shrink-0" aria-hidden="true" />
      {{ option.label }}
    </label>
  </fieldset>
</template>
