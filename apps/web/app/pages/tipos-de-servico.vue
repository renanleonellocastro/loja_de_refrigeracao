<script setup lang="ts">
import { Clock, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-vue-next';
import type { ConfirmOptions } from '~/composables/useConfirm';
import type { ToastOptions } from '~/composables/useToast';
import { holdWhile, runOrToast } from '~/helpers/actions';
import { countLabel } from '~/utils/catalog';
import { durationLabel, type ServiceType } from '~/utils/service-requests';
import {
  SERVICE_TYPE_LIMITS,
  serviceTypeFormFrom,
  serviceTypeFormToApi,
  validateServiceTypeForm,
} from '~/utils/service-types';

/**
 * UCs Cadastrar, Consultar, Alterar e Excluir tipos de Reparo/Manutenção (RF-24). A type already used by
 * requests or quotes is deactivated by the API instead of deleted, so its history stays readable.
 */
definePageMeta({ layout: 'area', permission: 'serviceTypes.manage', title: 'Tipos de serviço' });
useHead({ title: 'Tipos de serviço | Refrigeração Castro' });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const types = ref<ServiceType[]>([]);
const loading = ref(true);
const failed = ref(false);
/** Id of the type whose activation or deletion is in flight, to block repeated clicks. */
const busy = ref<number | null>(null);

const activeCount = computed(() => types.value.filter((type) => type.active).length);
const summary = computed(() => {
  const inactive = types.value.length - activeCount.value;
  const active = countLabel(activeCount.value, 'serviço ativo', 'serviços ativos');
  return inactive > 0 ? `${active} e ${countLabel(inactive, 'inativo', 'inativos')}` : active;
});

/** Type being created (null id) or edited, or null when the dialog is closed. */
const editing = ref<{ id: number | null; name: string } | null>(null);
const dialogOpen = computed({
  get: () => editing.value !== null,
  // The dialog only writes false (closing); opening goes through startCreate and startEdit.
  set: () => {
    editing.value = null;
  },
});
const form = useForm(serviceTypeFormFrom(), { validate: validateServiceTypeForm });

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    types.value = await unwrap(
      api.GET('/api/v1/service-types', { params: { query: { includeInactive: 'true' } } }),
    );
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function startCreate(): void {
  form.reset(serviceTypeFormFrom());
  editing.value = { id: null, name: '' };
}

function startEdit(type: ServiceType): void {
  form.reset(serviceTypeFormFrom(type));
  editing.value = { id: type.id, name: type.name };
}

type ServiceTypeBody = ReturnType<typeof serviceTypeFormToApi>;

async function createServiceType(body: ServiceTypeBody): Promise<void> {
  await unwrap(api.POST('/api/v1/service-types', { body }));
  toast.success({ title: `Serviço ${body.name} cadastrado.` });
}

async function updateServiceType(id: number, body: ServiceTypeBody): Promise<void> {
  await unwrap(api.PATCH('/api/v1/service-types/{id}', { params: { path: { id } }, body }));
  toast.success({ title: `Serviço ${body.name} atualizado.` });
}

async function save(): Promise<void> {
  const target = editing.value!;
  const done = await form.submit((values) => {
    const body = serviceTypeFormToApi(values);
    return target.id === null ? createServiceType(body) : updateServiceType(target.id, body);
  });
  if (!done) return;
  editing.value = null;
  await load();
}

function activationToast(name: string, isActive: boolean): ToastOptions {
  if (isActive)
    return { title: `Serviço ${name} ativado.`, description: 'Ele volta a aparecer para os clientes.' };
  return {
    title: `Serviço ${name} desativado.`,
    description: 'Ele não aparece mais no agendamento nem no orçamento.',
  };
}

function replaceType(updated: ServiceType): void {
  types.value = types.value.map((item) => (item.id === updated.id ? updated : item));
}

async function flipActive(type: ServiceType): Promise<void> {
  const updated = await unwrap(
    api.PATCH('/api/v1/service-types/{id}', {
      params: { path: { id: type.id } },
      body: { active: !type.active },
    }),
  );
  replaceType(updated);
  toast.success(activationToast(type.name, updated.active));
}

async function toggleActive(type: ServiceType): Promise<void> {
  await holdWhile(busy, type.id, null, () => runOrToast(() => flipActive(type)));
}

function removalQuestion(type: ServiceType): ConfirmOptions {
  return {
    title: `Excluir o serviço ${type.name}?`,
    description:
      'Se ele já foi usado em solicitações ou orçamentos, fica apenas desativado para manter o histórico.',
    confirmLabel: 'Excluir serviço',
    danger: true,
  };
}

function showRemoval(name: string, result: string): void {
  if (result === 'deleted') {
    toast.success({ title: `Serviço ${name} excluído.` });
    return;
  }
  toast.info({
    title: `Serviço ${name} desativado.`,
    description: 'Ele já foi usado em solicitações ou orçamentos, então o histórico foi mantido.',
  });
}

async function deleteServiceType(type: ServiceType): Promise<void> {
  const params = { path: { id: type.id } };
  const { result } = await unwrap(api.DELETE('/api/v1/service-types/{id}', { params }));
  showRemoval(type.name, result);
  await load();
}

async function remove(type: ServiceType): Promise<void> {
  if (!(await confirm(removalQuestion(type)))) return;
  await holdWhile(busy, type.id, null, () => runOrToast(() => deleteServiceType(type)));
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-text-muted">
        Os serviços ativos aparecem no site, no agendamento e no orçamento, nesta ordem.
      </p>
      <BaseButton class="shrink-0" @click="startCreate">
        <Plus class="size-5" aria-hidden="true" />
        Novo serviço
      </BaseButton>
    </div>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <div v-else-if="loading" class="flex flex-col gap-2" role="status">
      <span class="sr-only">Carregando tipos de serviço…</span>
      <BaseSkeleton v-for="index in 4" :key="index" class="h-24 w-full rounded-lg" />
    </div>
    <BaseEmptyState
      v-else-if="types.length === 0"
      title="Nenhum tipo de serviço ainda"
      text="Cadastre os serviços que a loja oferece, como Conserto de geladeira ou Instalação de ar condicionado."
    />
    <template v-else>
      <p class="text-sm text-text-muted" aria-live="polite">{{ summary }}</p>
      <ul class="flex flex-col gap-2" aria-label="Tipos de serviço">
        <li
          v-for="type in types"
          :key="type.id"
          class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-start"
          :data-active="type.active"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-semibold text-text" :class="type.active ? '' : 'text-text-muted'">
                {{ type.name }}
              </p>
              <span
                v-if="!type.active"
                class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-text-muted ring-1 ring-border-strong/20"
                >Inativo</span
              >
            </div>
            <p v-if="type.description" class="mt-1 line-clamp-2 text-sm text-text-muted">
              {{ type.description }}
            </p>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Clock class="size-4" aria-hidden="true" />
              <span>Duração estimada: {{ durationLabel(type.estimatedMinutes) }}</span>
            </p>
          </div>
          <div class="-ml-2 flex items-center sm:ml-0">
            <BaseIconButton :label="`Editar ${type.name}`" size="sm" @click="startEdit(type)">
              <Pencil class="size-5" aria-hidden="true" />
            </BaseIconButton>
            <BaseIconButton
              :label="`${type.active ? 'Desativar' : 'Ativar'} ${type.name}`"
              size="sm"
              :disabled="busy === type.id"
              @click="toggleActive(type)"
            >
              <PowerOff v-if="type.active" class="size-5" aria-hidden="true" />
              <Power v-else class="size-5" aria-hidden="true" />
            </BaseIconButton>
            <BaseIconButton
              :label="`Excluir ${type.name}`"
              size="sm"
              :disabled="busy === type.id"
              @click="remove(type)"
            >
              <Trash2 class="size-5" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </li>
      </ul>
    </template>

    <BaseDialog v-model:open="dialogOpen" :title="editing?.id ? `Editar ${editing.name}` : 'Novo serviço'">
      <form id="service-type-form" class="flex flex-col gap-4" novalidate @submit.prevent="save">
        <BaseTextField
          v-model="form.values.name"
          label="Nome do serviço"
          :error="form.error('name')"
          required
        />
        <BaseTextArea
          v-model="form.values.description"
          label="Descrição"
          hint="Aparece para o cliente na página de serviços."
          :rows="3"
          :maxlength="SERVICE_TYPE_LIMITS.descriptionMax"
          :error="form.error('description')"
        />
        <BaseTextField
          v-model="form.values.estimatedMinutes"
          label="Duração estimada"
          inputmode="numeric"
          suffix="minutos"
          :hint="`De ${SERVICE_TYPE_LIMITS.minutesMin} a ${SERVICE_TYPE_LIMITS.minutesMax} minutos. Sugere o tempo da visita na agenda.`"
          :error="form.error('estimatedMinutes')"
          required
        />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="dialogOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="service-type-form" :loading="form.pending.value">
          {{ editing?.id ? 'Salvar alterações' : 'Cadastrar serviço' }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
