<script setup lang="ts">
import { can, ROLE_LABELS } from '@rc/contracts';
import { MailCheck, MailWarning, Pencil, Trash2 } from 'lucide-vue-next';
import { formatCpf, formatDate, formatPhone } from '~/utils/masks';

/**
 * UC Consultar Usuário (GET /users/{id}), with the recent orders, service requests or visits. The super user also edits and deletes; deleting anonymizes the
 * account and keeps the history of orders and services (LGPD).
 */
const props = defineProps<{ kind: DirectoryKind }>();

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const toast = useToast();
const { confirm } = useConfirm();
const config = computed(() => DIRECTORIES[props.kind]);
const canManage = computed(() => can(auth.actor, 'users.manage'));

const user = ref<UserDetail | null>(null);
const activity = ref<UserActivity | null>(null);
const state = ref<'loading' | 'ready' | 'not-found' | 'failed'>('loading');
const editing = ref(false);
const deleting = ref(false);

async function load(): Promise<void> {
  state.value = 'loading';
  try {
    const found = await unwrap(
      api.GET('/api/v1/users/{id}', { params: { path: { id: Number(route.params.id) } } }),
    );
    // A person of another role opened from the wrong list reads as not found.
    user.value = found;
    activity.value = found;
    state.value = config.value.roles.includes(found.role) ? 'ready' : 'not-found';
  } catch (caught) {
    const status = toApiError(caught).status;
    state.value = status === 404 || status === 400 ? 'not-found' : 'failed';
  }
}

const crumbs = computed<Crumb[]>(() => [
  { label: config.value.title, to: config.value.path },
  { label: user.value?.name ?? 'Detalhes' },
]);

const details = computed<DescriptionItem[]>(() => {
  const current = user.value!;
  return [
    { term: 'Email', detail: current.email },
    { term: 'Telefone', detail: current.phone ? formatPhone(current.phone) : 'Não informado' },
    { term: 'CPF', detail: current.cpf ? formatCpf(current.cpf) : 'Não informado' },
    { term: 'Endereço', detail: formatAddress(current.address) },
    { term: 'Cadastro', detail: formatDate(current.createdAt) },
  ];
});

async function remove(): Promise<void> {
  const current = user.value!;
  const confirmed = await confirm({
    title: `Excluir ${config.value.thisNoun}?`,
    description: `Os dados pessoais de ${current.name} são apagados na hora e o histórico de pedidos e serviços fica anônimo. Não dá para desfazer.`,
    confirmLabel: `Excluir ${config.value.noun}`,
    danger: true,
  });
  if (!confirmed) return;
  deleting.value = true;
  try {
    await unwrap(api.DELETE('/api/v1/users/{id}', { params: { path: { id: current.id } } }));
    toast.success({ title: `${firstName(current.name)} foi excluído.` });
    await navigateTo(config.value.path);
  } catch (caught) {
    toast.error({ title: toApiError(caught).message });
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-5">
    <BaseBreadcrumbs :items="crumbs" />

    <ErrorState v-if="state === 'failed'" kind="server" :heading-level="2" @retry="load" />
    <ErrorState v-else-if="state === 'not-found'" kind="not-found" :heading-level="2" />

    <template v-else-if="state === 'loading'">
      <div class="flex items-center gap-4 rounded-xl border border-border bg-surface p-5" role="status">
        <span class="sr-only">Carregando dados…</span>
        <BaseSkeleton class="size-16 rounded-full" />
        <div class="flex flex-1 flex-col gap-2">
          <BaseSkeleton class="h-6 w-48 rounded-sm" />
          <BaseSkeleton class="h-4 w-64 max-w-full rounded-sm" />
        </div>
      </div>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
    </template>

    <template v-else-if="user">
      <section
        class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:p-6"
        aria-labelledby="usuario-nome"
      >
        <BaseAvatar :name="user.name" size="lg" />
        <div class="min-w-0 flex-1">
          <h2 id="usuario-nome" class="truncate text-2xl font-extrabold text-text">{{ user.name }}</h2>
          <p class="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span class="rounded-full bg-info-soft px-3 py-0.5 font-semibold text-on-info-soft">
              {{ ROLE_LABELS[user.role] }}
            </span>
            <span
              v-if="user.pendingInvitation"
              class="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-0.5 font-semibold text-on-warning-soft"
            >
              <MailWarning class="size-4" aria-hidden="true" /> Convite pendente
            </span>
            <span
              v-else-if="user.emailVerified"
              class="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-0.5 font-semibold text-on-success-soft"
            >
              <MailCheck class="size-4" aria-hidden="true" /> Email confirmado
            </span>
          </p>
        </div>
        <div v-if="canManage" class="flex flex-col gap-2 sm:flex-row">
          <BaseButton variant="secondary" @click="editing = true">
            <Pencil class="size-4" aria-hidden="true" /> Editar dados
          </BaseButton>
          <BaseButton v-if="user.role !== 'ADMIN'" variant="danger" :loading="deleting" @click="remove">
            <Trash2 class="size-4" aria-hidden="true" /> Excluir {{ config.noun }}
          </BaseButton>
        </div>
      </section>

      <BaseCard title="Dados de contato">
        <BaseDescriptionList :items="details" />
      </BaseCard>

      <UsersActivity :kind="kind" :activity="activity!" />

      <UsersEditDialog
        v-if="canManage"
        v-model:open="editing"
        :kind="kind"
        :user="user"
        @saved="user = $event"
      />
    </template>
  </div>
</template>
