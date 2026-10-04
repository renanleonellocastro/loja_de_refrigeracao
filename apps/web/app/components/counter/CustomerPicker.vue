<script setup lang="ts">
import { can } from '@rc/contracts';
import { Search, UserPlus, UserRound } from 'lucide-vue-next';
import { formatPhone } from '~/utils/masks';

/**
 * Customer of a counter sale: search by name, email, phone or CPF. Managers and the super user can register
 * a new customer on the spot; employees pick an existing one.
 */
const model = defineModel<PickedCustomer | null>({ default: null });

const api = useApi();
const auth = useAuthStore();
const canCreate = computed(() => can(auth.actor, 'users.create'));

const query = ref('');
const creating = ref(false);
/** Text of the search whose results are on screen. */
const searched = ref('');

const {
  rows: results,
  failed,
  restart,
} = usePagedList(async (page) => {
  const q = query.value.trim();
  searched.value = '';
  if (!q) return { data: [], meta: { total: 0 } };
  const result = await unwrap(
    api.GET('/api/v1/users', { params: { query: { role: 'CLIENT', q, page, pageSize: 8 } } }),
  );
  searched.value = q;
  return result;
}, 8);

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(restart, SEARCH_DEBOUNCE_MS);
});
onBeforeUnmount(() => clearTimeout(timer));

function pick(user: { id: number; name: string; email: string; phone: string | null }): void {
  model.value = { id: user.id, name: user.name, email: user.email, phone: user.phone };
  query.value = '';
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="model" class="flex items-center gap-3 rounded-lg bg-info-soft p-3 text-on-info-soft">
      <UserRound class="size-6 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-semibold" data-testid="picked-customer">{{ model.name }}</p>
        <p class="truncate text-sm">{{ model.phone ? formatPhone(model.phone) : model.email }}</p>
      </div>
      <BaseButton variant="secondary" size="sm" @click="model = null">Trocar</BaseButton>
    </div>

    <template v-else>
      <BaseTextField
        v-model="query"
        label="Cliente"
        type="search"
        inputmode="search"
        placeholder="Nome, telefone, email ou CPF"
        autocomplete="off"
      >
        <template #prefix><Search class="size-5" aria-hidden="true" /></template>
      </BaseTextField>
      <p class="sr-only" role="status">
        {{ searched ? `${results.length} clientes encontrados` : '' }}
      </p>
      <p v-if="failed" class="text-sm font-medium text-danger">
        Não conseguimos buscar agora. Confira sua conexão e digite de novo.
      </p>
      <ul v-else-if="results.length" class="flex flex-col gap-1" aria-label="Clientes encontrados">
        <li v-for="user in results" :key="user.id">
          <button
            type="button"
            class="flex min-h-11 w-full flex-col rounded-md border border-border bg-surface px-3 py-2 text-left hover:border-primary hover:bg-info-soft"
            @click="pick(user)"
          >
            <span class="font-semibold text-text">{{ user.name }}</span>
            <span class="text-sm text-text-muted">{{
              user.phone ? formatPhone(user.phone) : user.email
            }}</span>
          </button>
        </li>
      </ul>
      <p v-else-if="searched" class="text-sm text-text-muted">
        Nenhum cliente encontrado para “{{ searched }}”.
        <template v-if="!canCreate">Peça para um gerente cadastrar.</template>
      </p>
      <BaseButton v-if="canCreate" variant="secondary" size="sm" class="self-start" @click="creating = true">
        <UserPlus class="size-4" aria-hidden="true" />
        Cadastrar cliente
      </BaseButton>
    </template>

    <UsersCreateDialog v-if="canCreate" v-model:open="creating" kind="CLIENT" @created="pick" />
  </div>
</template>
