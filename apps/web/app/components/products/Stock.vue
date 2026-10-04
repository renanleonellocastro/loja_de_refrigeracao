<script setup lang="ts">
import { ArrowDownUp } from 'lucide-vue-next';
import { countLabel } from '~/utils/catalog';
import { formatDateTime } from '~/utils/masks';
import {
  MOVEMENT_LABELS,
  MOVEMENT_OPTIONS,
  signedQuantity,
  STOCK_PAGE_SIZE,
  validateMovement,
  type MovementForm,
} from '~/utils/products';

/** UC Movimentar Estoque (RF-14): history of every change and the dialog for entries, adjustments and losses. */
const props = defineProps<{ product: ProductDetail }>();
const emit = defineEmits<{ change: [stock: { stockAvailable: number; lowStock: boolean }] }>();

const api = useApi();
const toast = useToast();
const open = ref(false);

const blank = (): MovementForm => ({ type: 'IN', quantity: '', reason: '' });
const form = useForm(blank(), { validate: validateMovement });
const hint = computed(
  () => MOVEMENT_OPTIONS.find((option) => option.value === form.values.type)!.description,
);

const { page, rows, pages, loading, failed, load, restart } = usePagedList(
  (current) =>
    unwrap(
      api.GET('/api/v1/products/{id}/stock-movements', {
        params: { path: { id: props.product.id }, query: { page: current, pageSize: STOCK_PAGE_SIZE } },
      }),
    ),
  STOCK_PAGE_SIZE,
);
onMounted(load);

watch(open, (now) => {
  if (now) form.reset(blank());
});

async function save(): Promise<void> {
  const done = await form.submit(async (values) => {
    const result = await unwrap(
      api.POST('/api/v1/products/{id}/stock-movements', {
        params: { path: { id: props.product.id } },
        body: {
          type: values.type,
          quantity: Number(String(values.quantity).trim()),
          reason: values.reason.trim() || undefined,
        },
      }),
    );
    emit('change', { stockAvailable: result.stockAvailable, lowStock: result.lowStock });
    toast.success({
      title: `Estoque atualizado: ${countLabel(result.stockAvailable, 'disponível', 'disponíveis')}.`,
    });
    restart();
  });
  if (done) open.value = false;
}
</script>

<template>
  <BaseCard title="Histórico de estoque" :heading-level="3">
    <template #actions>
      <BaseButton size="sm" @click="open = true">
        <ArrowDownUp class="size-4" aria-hidden="true" />
        Movimentar estoque
      </BaseButton>
    </template>

    <div class="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-text-muted">
      <p>
        Disponível agora: <strong class="text-lg text-text tabular-nums">{{ product.stockAvailable }}</strong>
      </p>
      <p>
        Mínimo:
        <span class="tabular-nums">{{ product.stockMin ?? 'padrão da loja' }}</span>
      </p>
    </div>

    <ErrorState v-if="failed" kind="server" :heading-level="3" @retry="load" />
    <div v-else-if="loading" class="flex flex-col gap-2" role="status">
      <span class="sr-only">Carregando o histórico…</span>
      <BaseSkeleton v-for="index in 3" :key="index" class="h-14 w-full rounded-md" />
    </div>
    <p v-else-if="rows.length === 0" class="text-text-muted">Nenhuma movimentação ainda.</p>
    <ul v-else class="divide-y divide-border" aria-label="Movimentações de estoque">
      <li v-for="movement in rows" :key="movement.id" class="flex items-start justify-between gap-3 py-3">
        <div class="min-w-0">
          <p class="font-semibold text-text">
            {{ MOVEMENT_LABELS[movement.type] }}
            <NuxtLink
              v-if="movement.orderId"
              :to="`/pedidos/${movement.orderId}`"
              class="ml-1 text-sm font-medium text-link underline-offset-4 hover:underline"
              >ver pedido</NuxtLink
            >
          </p>
          <p class="text-sm text-text-muted">
            {{ formatDateTime(movement.createdAt)
            }}<template v-if="movement.authorName"> · {{ movement.authorName }}</template>
          </p>
          <p v-if="movement.reason" class="text-sm text-text">{{ movement.reason }}</p>
        </div>
        <p
          class="font-bold tabular-nums"
          :class="movement.quantity > 0 ? 'text-on-success-soft' : 'text-on-danger-soft'"
        >
          {{ signedQuantity(movement.quantity) }}
        </p>
      </li>
    </ul>
    <div class="mt-4">
      <BasePagination v-if="!failed" v-model:page="page" :total="pages" label="Páginas do histórico" />
    </div>

    <BaseDialog
      v-model:open="open"
      title="Movimentar estoque"
      :description="`${product.name}: ${product.stockAvailable} disponíveis agora.`"
      size="sm"
    >
      <form id="stock-form" class="flex flex-col gap-4" novalidate @submit.prevent="save">
        <FormSelect v-model="form.values.type" label="Tipo" :options="MOVEMENT_OPTIONS" :hint="hint" />
        <BaseTextField
          v-model="form.values.quantity"
          label="Quantidade"
          :inputmode="form.values.type === 'ADJUSTMENT' ? 'text' : 'numeric'"
          :error="form.error('quantity')"
          required
        />
        <BaseTextArea
          v-model="form.values.reason"
          label="Motivo"
          :rows="2"
          :maxlength="300"
          :required="form.values.type !== 'IN'"
          :error="form.error('reason')"
        />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="stock-form" :loading="form.pending.value"
          >Salvar movimentação</BaseButton
        >
      </template>
    </BaseDialog>
  </BaseCard>
</template>
