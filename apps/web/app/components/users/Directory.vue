<script setup lang="ts">
import { can } from '@rc/contracts';
import { Search, UserPlus } from 'lucide-vue-next';
import { formatCpf, formatDate, formatPhone } from '~/utils/masks';

/**
 * UCs Listar e Buscar Clientes, Colaboradores e Gerentes (RF-05, RF-07, RF-08): instant search over
 * GET /users?role=&q=, a table that turns into cards on phones, pagination and the registration dialog.
 */
const props = defineProps<{ kind: DirectoryKind }>();

const api = useApi();
const auth = useAuthStore();
const config = computed(() => DIRECTORIES[props.kind]);
const canCreate = computed(() => can(auth.actor, config.value.createPermission));

const query = ref('');
const creating = ref(false);
/** Text of the search whose results are on screen, for the empty state. */
const searched = ref('');

const columns: TableColumn[] = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefone' },
  { key: 'cpf', label: 'CPF', priority: 'low' },
  { key: 'createdAt', label: 'Desde', priority: 'low' },
];

const { page, rows, total, pages, loading, failed, load, restart } = usePagedList(async (current) => {
  const q = query.value.trim();
  const result = await unwrap(
    api.GET('/api/v1/users', {
      params: { query: { role: props.kind, q: q || undefined, page: current, pageSize: USERS_PAGE_SIZE } },
    }),
  );
  searched.value = q;
  return result;
}, USERS_PAGE_SIZE);

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(restart, SEARCH_DEBOUNCE_MS);
});
onBeforeUnmount(() => clearTimeout(timer));
onMounted(load);

/** Shows the full list again so the new person is easy to find; clearing the search reloads it. */
function onCreated(): void {
  if (query.value) query.value = '';
  else restart();
}

const optional = (value: string | null, format: (text: string) => string) => (value ? format(value) : '—');
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="flex-1">
        <BaseTextField
          v-model="query"
          :label="`Buscar ${config.title.toLowerCase()}`"
          type="search"
          inputmode="search"
          placeholder="Nome, email, telefone ou CPF"
          autocomplete="off"
        >
          <template #prefix><Search class="size-5" aria-hidden="true" /></template>
        </BaseTextField>
      </div>
      <BaseButton v-if="canCreate" class="sm:mb-px" @click="creating = true">
        <UserPlus class="size-5" aria-hidden="true" />
        Cadastrar {{ config.noun }}
      </BaseButton>
    </div>

    <p class="sr-only" role="status">
      {{ loading ? `Carregando ${config.title.toLowerCase()}…` : `${total} encontrados` }}
    </p>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <BaseResponsiveTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
      :caption="`Lista de ${config.title.toLowerCase()}`"
      :loading="loading"
    >
      <template #cell-name="{ row }">
        <NuxtLink
          :to="`${config.path}/${row.id}`"
          class="font-semibold text-link underline-offset-4 hover:underline"
          >{{ row.name }}</NuxtLink
        >
        <span
          v-if="row.role === 'ADMIN'"
          class="ml-2 rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-on-info-soft"
          >Super usuário</span
        >
      </template>
      <template #cell-email="{ row }"
        ><span class="break-all">{{ row.email }}</span></template
      >
      <template #cell-phone="{ row }">{{ optional(row.phone, formatPhone) }}</template>
      <template #cell-cpf="{ row }">{{ optional(row.cpf, formatCpf) }}</template>
      <template #cell-createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      <template #empty>
        <BaseEmptyState
          v-if="searched"
          :title="`Nada encontrado para “${searched}”`"
          text="Confira a grafia ou busque pelo email, telefone ou CPF."
        >
          <template #illustration>
            <img src="/illustrations/vazio-busca.svg" alt="" class="h-32 w-auto" />
          </template>
        </BaseEmptyState>
        <BaseEmptyState v-else :title="config.emptyTitle" :text="config.emptyText">
          <template v-if="canCreate" #action>
            <BaseButton @click="creating = true">Cadastrar {{ config.noun }}</BaseButton>
          </template>
        </BaseEmptyState>
      </template>
    </BaseResponsiveTable>

    <BasePagination v-if="!failed" v-model:page="page" :total="pages" :label="`Páginas de ${config.title}`" />

    <UsersCreateDialog v-if="canCreate" v-model:open="creating" :kind="kind" @created="onCreated" />
  </div>
</template>
