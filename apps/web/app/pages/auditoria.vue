<script setup lang="ts">
import type { ApiSchemas } from '@rc/contracts';
import { ChevronDown, FilterX } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';
import { auditActionLabel, auditResourceLabel, prettyJson } from '~/utils/staff';

/** UC Consultar Auditoria (RF-12, RNF-07): who changed what and when, with the record before and after. */
definePageMeta({ layout: 'area', permission: 'audit.read', title: 'Auditoria' });
useHead({ title: 'Auditoria | Refrigeração Castro' });

type AuditLog = ApiSchemas['AuditLog'];
const PAGE_SIZE = 20;

const api = useApi();
const filters = reactive({ from: '', to: '', resourceType: '', actorId: '' });
const team = ref<Map<number, string>>(new Map());

const filtered = computed(() => Object.values(filters).some(Boolean));
const resourceOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todos os tipos' },
  ...Object.entries(AUDIT_RESOURCES).map(([value, label]) => ({ value, label })),
]);
const authorOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todas as pessoas' },
  ...[...team.value].map(([id, name]) => ({ value: String(id), label: name })),
]);

/** Names of the team, who are the authors of the audited actions. */
async function loadTeam(): Promise<void> {
  const names = new Map<number, string>();
  for (const role of ['MANAGER', 'EMPLOYEE'] as const) {
    try {
      const result = await unwrap(api.GET('/api/v1/users', { params: { query: { role, pageSize: 100 } } }));
      for (const user of result.data) names.set(user.id, user.name);
    } catch {
      // Without names the list still works; authors show by number.
    }
  }
  team.value = names;
}

const {
  page,
  rows: logs,
  pages,
  loading,
  failed,
  load,
  restart,
} = usePagedList(
  (current) =>
    unwrap(
      api.GET('/api/v1/audit-logs', {
        params: {
          query: {
            page: current,
            pageSize: PAGE_SIZE,
            from: dayBoundary(filters.from, false),
            to: dayBoundary(filters.to, true),
            resourceType: filters.resourceType || undefined,
            actorId: filters.actorId ? Number(filters.actorId) : undefined,
          },
        },
      }),
    ),
  PAGE_SIZE,
);

watch(filters, restart);

function clearFilters(): void {
  Object.assign(filters, { from: '', to: '', resourceType: '', actorId: '' });
}

function authorOf(log: AuditLog): string {
  if (log.actorId === null) return 'Sistema';
  return team.value.get(log.actorId) ?? `Pessoa nº ${log.actorId}`;
}

onMounted(() => {
  void loadTeam();
  void load();
});
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <BaseCard padding="md">
      <form
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filtros da auditoria"
        @submit.prevent
      >
        <BaseTextField v-model="filters.from" label="De" type="date" />
        <BaseTextField v-model="filters.to" label="Até" type="date" />
        <BaseSelect v-model="filters.resourceType" label="Tipo de registro" :options="resourceOptions" />
        <BaseSelect v-model="filters.actorId" label="Autor" :options="authorOptions" />
      </form>
      <div v-if="filtered" class="mt-3 flex justify-end">
        <BaseButton variant="ghost" size="sm" @click="clearFilters">
          <FilterX class="size-4" aria-hidden="true" /> Limpar filtros
        </BaseButton>
      </div>
    </BaseCard>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <div v-else-if="loading" class="flex flex-col gap-3" role="status">
      <span class="sr-only">Carregando auditoria…</span>
      <BaseSkeleton v-for="index in 5" :key="index" class="h-20 w-full rounded-lg" />
    </div>

    <BaseEmptyState
      v-else-if="logs.length === 0"
      :title="filtered ? 'Nenhum registro com esses filtros' : 'Nenhuma ação registrada ainda'"
      :text="
        filtered
          ? 'Amplie o período ou limpe os filtros para ver mais.'
          : 'Cada alteração feita pela equipe aparece aqui, com quem fez e quando.'
      "
    >
      <template #illustration>
        <img src="/illustrations/vazio-busca.svg" alt="" class="h-32 w-auto" />
      </template>
    </BaseEmptyState>

    <ul v-else class="flex flex-col gap-3" aria-label="Registros da auditoria">
      <li v-for="log in logs" :key="log.id">
        <details class="group rounded-lg border border-border bg-surface shadow-sm">
          <summary
            class="flex min-h-11 cursor-pointer list-none flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4 [&::-webkit-details-marker]:hidden"
          >
            <span class="min-w-0 flex-1">
              <span class="font-semibold text-text">
                {{ auditActionLabel(log.action) }} em {{ auditResourceLabel(log.resourceType) }}
                <span v-if="log.resourceId" class="text-text-muted">nº {{ log.resourceId }}</span>
              </span>
              <span class="block text-sm text-text-muted">
                {{ authorOf(log) }} ·
                <time :datetime="log.createdAt">{{ formatDateTime(log.createdAt) }}</time>
              </span>
            </span>
            <span class="inline-flex items-center gap-1 text-sm font-semibold text-link">
              Ver antes e depois
              <ChevronDown class="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <div class="grid gap-3 border-t border-border p-4 md:grid-cols-2">
            <div>
              <p class="mb-1 text-sm font-semibold text-text-muted">Antes</p>
              <pre
                class="max-h-80 overflow-auto rounded-md bg-surface-sunken p-3 text-xs leading-relaxed text-text"
                >{{ prettyJson(log.before) }}</pre>
            </div>
            <div>
              <p class="mb-1 text-sm font-semibold text-text-muted">Depois</p>
              <pre
                class="max-h-80 overflow-auto rounded-md bg-surface-sunken p-3 text-xs leading-relaxed text-text"
                >{{ prettyJson(log.after) }}</pre>
            </div>
            <p class="text-xs text-text-muted md:col-span-2">
              Ação {{ log.action }} · IP {{ log.ip ?? 'não registrado' }}
            </p>
          </div>
        </details>
      </li>
    </ul>

    <BasePagination v-if="!failed" v-model:page="page" :total="pages" label="Páginas da auditoria" />
  </div>
</template>
