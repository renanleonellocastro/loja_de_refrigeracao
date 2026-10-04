<script setup lang="ts">
import { formatMoney } from '~/utils/masks';

/**
 * Catalog filters, in the sidebar on desktop and inside a sheet on phones and tablets. Every change goes
 * straight to the address through `change`; counts come from GET /products/facets.
 */
const props = defineProps<{ filters: CatalogFilters; facets: CatalogFacets | null; idPrefix: string }>();
const emit = defineEmits<{ change: [changes: Partial<CatalogFilters>]; clear: [] }>();

const minPrice = ref(props.filters.minPrice?.toString() ?? '');
const maxPrice = ref(props.filters.maxPrice?.toString() ?? '');
watch(
  () => [props.filters.minPrice, props.filters.maxPrice],
  ([min, max]) => {
    minPrice.value = min?.toString() ?? '';
    maxPrice.value = max?.toString() ?? '';
  },
);

const RADIO =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-text transition-colors hover:bg-surface-sunken has-[:checked]:font-semibold has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-focus';
const INPUT = 'size-4.5 shrink-0 accent-primary focus-visible:outline-none';

function toReais(value: string): number | undefined {
  const parsed = Number.parseInt(value.replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function applyPrice(): void {
  emit('change', { minPrice: toReais(minPrice.value), maxPrice: toReais(maxPrice.value) });
}

const conditions = computed(() =>
  (['NEW', 'USED'] as const).map((condition) => ({
    condition,
    label: CONDITION_LABELS[condition],
    count: props.facets?.conditions.find((item) => item.condition === condition)?.count ?? 0,
  })),
);

const priceHint = computed(() => {
  const price = props.facets?.price;
  return price
    ? `De ${formatMoney(price.minCents).replace(',00', '')} a ${formatMoney(price.maxCents).replace(',00', '')}`
    : undefined;
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseSwitch
      :model-value="filters.onlyAvailable"
      label="Só disponíveis"
      :description="facets ? `${facets.availability.available} com estoque` : undefined"
      @update:model-value="emit('change', { onlyAvailable: $event })"
    />

    <fieldset>
      <legend class="mb-1 text-sm font-bold text-text">Categoria</legend>
      <label :class="RADIO">
        <input
          type="radio"
          :name="`${idPrefix}-categoria`"
          :class="INPUT"
          :checked="!filters.categoryId"
          @change="emit('change', { categoryId: undefined })"
        />
        Todas
      </label>
      <label v-for="item in facets?.categories ?? []" :key="item.categoryId" :class="RADIO">
        <input
          type="radio"
          :name="`${idPrefix}-categoria`"
          :class="INPUT"
          :checked="filters.categoryId === item.categoryId"
          @change="emit('change', { categoryId: item.categoryId })"
        />
        <span class="flex-1">{{ item.name }}</span>
        <span class="text-xs text-text-muted tabular-nums">{{ item.count }}</span>
      </label>
    </fieldset>

    <fieldset>
      <legend class="mb-1 text-sm font-bold text-text">Condição</legend>
      <label :class="RADIO">
        <input
          type="radio"
          :name="`${idPrefix}-condicao`"
          :class="INPUT"
          :checked="!filters.condition"
          @change="emit('change', { condition: undefined })"
        />
        Novos e usados
      </label>
      <label v-for="item in conditions" :key="item.condition" :class="RADIO">
        <input
          type="radio"
          :name="`${idPrefix}-condicao`"
          :class="INPUT"
          :checked="filters.condition === item.condition"
          @change="emit('change', { condition: item.condition })"
        />
        <span class="flex-1">{{ item.label }}</span>
        <span class="text-xs text-text-muted tabular-nums">{{ item.count }}</span>
      </label>
    </fieldset>

    <fieldset v-if="(facets?.brands.length ?? 0) > 0">
      <legend class="mb-1 text-sm font-bold text-text">Marca</legend>
      <label :class="RADIO">
        <input
          type="radio"
          :name="`${idPrefix}-marca`"
          :class="INPUT"
          :checked="!filters.brand"
          @change="emit('change', { brand: undefined })"
        />
        Todas
      </label>
      <label v-for="item in facets?.brands" :key="item.brand" :class="RADIO">
        <input
          type="radio"
          :name="`${idPrefix}-marca`"
          :class="INPUT"
          :checked="filters.brand === item.brand"
          @change="emit('change', { brand: item.brand })"
        />
        <span class="flex-1">{{ item.brand }}</span>
        <span class="text-xs text-text-muted tabular-nums">{{ item.count }}</span>
      </label>
    </fieldset>

    <fieldset>
      <legend class="mb-1 text-sm font-bold text-text">Faixa de preço</legend>
      <p v-if="priceHint" class="mb-2 text-xs text-text-muted">{{ priceHint }}</p>
      <form class="flex items-end gap-2" @submit.prevent="applyPrice">
        <BaseTextField v-model="minPrice" label="De" prefix="R$" inputmode="numeric" class="min-w-0 flex-1" />
        <BaseTextField
          v-model="maxPrice"
          label="Até"
          prefix="R$"
          inputmode="numeric"
          class="min-w-0 flex-1"
        />
        <BaseButton type="submit" variant="secondary">Aplicar</BaseButton>
      </form>
    </fieldset>

    <BaseButton variant="ghost" @click="emit('clear')">Limpar filtros</BaseButton>
  </div>
</template>
