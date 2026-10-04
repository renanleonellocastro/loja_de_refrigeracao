<script setup lang="ts">
import { ArrowDown, ArrowUp, FolderPlus, Pencil, Trash2 } from 'lucide-vue-next';
import { countLabel } from '~/utils/catalog';
import { moveItem } from '~/utils/products';

/**
 * UCs Cadastrar, Renomear, Ordenar e Excluir Categoria (RF-15). A category in use is deleted only after
 * choosing where its products go (DELETE /categories/{id}?moveTo=).
 */
definePageMeta({ layout: 'area', permission: 'categories.manage', title: 'Categorias' });
useHead({ title: 'Categorias | Refrigeração Castro' });

const api = useApi();
const toast = useToast();
const { confirm } = useConfirm();

const categories = ref<Category[]>([]);
const loading = ref(true);
const failed = ref(false);
const reordering = ref(false);

/** Category being created (null id) or renamed, or null when the dialog is closed. */
const editing = ref<{ id: number | null; name: string } | null>(null);
const dialogOpen = computed({
  get: () => editing.value !== null,
  // The dialog only writes false (closing); opening goes through startCreate and startRename.
  set: () => {
    editing.value = null;
  },
});
const form = useForm(
  { name: '' },
  {
    validate: (values): FieldErrors => {
      const name = values.name.trim();
      if (name.length < 2) return { name: 'Informe o nome, com pelo menos 2 letras.' };
      return name.length > 60 ? { name: 'Use até 60 letras no nome.' } : {};
    },
  },
);

const removing = ref<Category | null>(null);
const moveTo = ref('');
const moveError = ref('');
const deleting = ref(false);
const removeOpen = computed({
  get: () => removing.value !== null,
  set: () => {
    removing.value = null;
  },
});
const removeDescription = computed(() => {
  const count = removing.value?.productCount ?? 0;
  const owned =
    count > 0 ? `Ela tem ${countLabel(count, 'produto', 'produtos')}` : 'Ela tem produtos arquivados';
  return `${owned}. Escolha para onde eles vão antes de excluir.`;
});
const moveOptions = computed<SelectOption[]>(() =>
  categories.value
    .filter((category) => category.id !== removing.value?.id)
    .map((category) => ({ value: String(category.id), label: category.name })),
);

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    categories.value = await unwrap(api.GET('/api/v1/categories'));
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function startCreate(): void {
  form.reset({ name: '' });
  editing.value = { id: null, name: '' };
}

function startRename(category: Category): void {
  form.reset({ name: category.name });
  editing.value = { id: category.id, name: category.name };
}

async function save(): Promise<void> {
  const target = editing.value!;
  const done = await form.submit(async (values) => {
    const body = { name: values.name.trim() };
    if (target.id === null) {
      await unwrap(api.POST('/api/v1/categories', { body }));
      toast.success({ title: `Categoria ${body.name} criada.` });
    } else {
      await unwrap(api.PATCH('/api/v1/categories/{id}', { params: { path: { id: target.id } }, body }));
      toast.success({ title: 'Categoria renomeada.' });
    }
  });
  if (!done) return;
  editing.value = null;
  await load();
}

async function move(index: number, to: number): Promise<void> {
  const ids = moveItem(categories.value, index, to).map((category) => category.id);
  reordering.value = true;
  try {
    categories.value = await unwrap(api.PUT('/api/v1/categories/order', { body: { ids } }));
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    reordering.value = false;
  }
}

function openMove(category: Category): void {
  moveTo.value = '';
  moveError.value = '';
  removing.value = category;
}

async function startRemove(category: Category): Promise<void> {
  if (category.productCount > 0) {
    openMove(category);
    return;
  }
  const confirmed = await confirm({
    title: `Excluir a categoria ${category.name}?`,
    description: 'Ela não tem produtos, então nada mais muda.',
    confirmLabel: 'Excluir categoria',
    danger: true,
  });
  if (confirmed) await remove(category, undefined);
}

async function remove(category: Category, target: number | undefined): Promise<boolean> {
  deleting.value = true;
  try {
    await unwrap(
      api.DELETE('/api/v1/categories/{id}', {
        params: { path: { id: category.id }, query: { moveTo: target } },
      }),
    );
    toast.success({ title: `Categoria ${category.name} excluída.` });
    await load();
    return true;
  } catch (error) {
    const failure = toApiError(error);
    // Archived products are not counted but still belong to the category: ask where they go.
    if (failure.code === 'category-in-use' && target === undefined) openMove(category);
    else toast.error({ title: failure.message });
    return false;
  } finally {
    deleting.value = false;
  }
}

async function confirmMove(): Promise<void> {
  if (!moveTo.value) {
    moveError.value = 'Escolha a categoria que recebe os produtos.';
    return;
  }
  if (await remove(removing.value!, Number(moveTo.value))) removing.value = null;
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-text-muted">A ordem desta lista é a mesma dos filtros do catálogo.</p>
      <BaseButton @click="startCreate">
        <FolderPlus class="size-5" aria-hidden="true" />
        Nova categoria
      </BaseButton>
    </div>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <div v-else-if="loading" class="flex flex-col gap-2" role="status">
      <span class="sr-only">Carregando categorias…</span>
      <BaseSkeleton v-for="index in 4" :key="index" class="h-16 w-full rounded-lg" />
    </div>
    <BaseEmptyState
      v-else-if="categories.length === 0"
      title="Nenhuma categoria ainda"
      text="Crie as categorias para organizar o catálogo, como Compressores ou Gás refrigerante."
    />
    <ol v-else class="flex flex-col gap-2" aria-label="Categorias em ordem">
      <li
        v-for="(category, index) in categories"
        :key="category.id"
        class="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm"
      >
        <span class="w-6 text-center text-sm font-semibold text-text-muted tabular-nums">{{
          index + 1
        }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-text">{{ category.name }}</p>
          <p class="text-sm text-text-muted">
            {{ countLabel(category.productCount, 'produto', 'produtos') }}
          </p>
        </div>
        <div class="flex items-center">
          <BaseIconButton
            :label="`Subir ${category.name}`"
            size="sm"
            :disabled="index === 0 || reordering"
            @click="move(index, index - 1)"
          >
            <ArrowUp class="size-5" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton
            :label="`Descer ${category.name}`"
            size="sm"
            :disabled="index === categories.length - 1 || reordering"
            @click="move(index, index + 1)"
          >
            <ArrowDown class="size-5" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton :label="`Renomear ${category.name}`" size="sm" @click="startRename(category)">
            <Pencil class="size-5" aria-hidden="true" />
          </BaseIconButton>
          <BaseIconButton :label="`Excluir ${category.name}`" size="sm" @click="startRemove(category)">
            <Trash2 class="size-5" aria-hidden="true" />
          </BaseIconButton>
        </div>
      </li>
    </ol>

    <BaseDialog
      v-model:open="dialogOpen"
      :title="editing?.id ? `Renomear ${editing.name}` : 'Nova categoria'"
      size="sm"
    >
      <form id="category-form" novalidate @submit.prevent="save">
        <BaseTextField
          v-model="form.values.name"
          label="Nome da categoria"
          :error="form.error('name')"
          required
        />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="dialogOpen = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="category-form" :loading="form.pending.value">
          {{ editing?.id ? 'Salvar nome' : 'Criar categoria' }}
        </BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog
      v-model:open="removeOpen"
      :title="`Excluir a categoria ${removing?.name ?? ''}?`"
      :description="removeDescription"
      size="sm"
    >
      <FormSelect
        v-model="moveTo"
        label="Mover produtos para"
        placeholder="Escolha a categoria"
        :options="moveOptions"
        :error="moveError"
        required
      />
      <template #footer>
        <BaseButton variant="secondary" @click="removeOpen = false">Cancelar</BaseButton>
        <BaseButton variant="danger" :loading="deleting" @click="confirmMove">Mover e excluir</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
