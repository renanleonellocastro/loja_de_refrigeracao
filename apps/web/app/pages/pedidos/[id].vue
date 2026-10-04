<script setup lang="ts">
import { ArrowLeft, Ban, CircleCheck, Mail, PackageCheck, Phone, Printer } from 'lucide-vue-next';
import { formatDateTime, formatPhone } from '~/utils/masks';
import { orderTimeline } from '~/utils/orders';

/**
 * UCs Separar Pedido, Registrar Retirada, Cancelar Pedido and Imprimir Etiqueta (RF-25 to RF-27).
 * The label is a PDF that needs the access token, so it is fetched and opened as a blob URL.
 */
definePageMeta({ layout: 'area', permission: 'orders.manage', title: 'Pedido' });

const api = useApi();
const route = useRoute();
const toast = useToast();

const order = ref<Order | null>(null);
const failed = ref(false);
const notFound = ref(false);
const acting = ref(false);
const printing = ref(false);
const cancelOpen = ref(false);
const reason = ref('');

useHead({ title: computed(() => `Pedido ${order.value?.number ?? ''} | Refrigeração Castro`) });

async function load(): Promise<void> {
  failed.value = false;
  try {
    order.value = await unwrap(
      api.GET('/api/v1/orders/{id}', { params: { path: { id: Number(route.params.id) } } }),
    );
  } catch (error) {
    notFound.value = toApiError(error).status === 404;
    failed.value = true;
  }
}

async function run(action: () => Promise<Order>, done: string): Promise<void> {
  acting.value = true;
  try {
    order.value = await action();
    toast.success({ title: done });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    acting.value = false;
  }
}

const params = () => ({ path: { id: order.value!.id } });

function markReady(): Promise<void> {
  return run(
    () => unwrap(api.POST('/api/v1/orders/{id}/ready-for-pickup', { params: params() })),
    'Pedido pronto para retirada.',
  );
}

function markPickedUp(): Promise<void> {
  return run(() => unwrap(api.POST('/api/v1/orders/{id}/pickup', { params: params() })), 'Pedido retirado.');
}

async function cancel(): Promise<void> {
  const text = reason.value.trim();
  await run(
    () =>
      unwrap(
        api.POST('/api/v1/orders/{id}/cancellation', {
          params: params(),
          body: text ? { reason: text } : {},
        }),
      ),
    'Pedido cancelado. Os itens voltaram para o estoque.',
  );
  if (order.value!.status === 'CANCELED') cancelOpen.value = false;
}

function openCancel(): void {
  reason.value = '';
  cancelOpen.value = true;
}

async function printLabel(): Promise<void> {
  // Opening the tab inside the click keeps popup blockers quiet; the PDF arrives a moment later.
  const tab = window.open('', '_blank');
  if (!tab) {
    toast.error({ title: 'O navegador bloqueou a nova aba. Libere as janelas deste site e tente de novo.' });
    return;
  }
  printing.value = true;
  try {
    const blob = await unwrap(api.GET('/api/v1/orders/{id}/label', { params: params(), parseAs: 'blob' }));
    tab.location.href = URL.createObjectURL(blob as Blob);
  } catch (error) {
    tab.close();
    toast.error({ title: toApiError(error).message });
  } finally {
    printing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <NuxtLink
      to="/pedidos"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Pedidos
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!order" class="grid gap-5 lg:grid-cols-[1fr_20rem]" role="status">
      <span class="sr-only">Carregando o pedido…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-extrabold text-text tabular-nums">Pedido {{ order.number }}</h2>
          <p class="text-sm text-text-muted">
            Feito em {{ formatDateTime(order.createdAt) }}
            <template v-if="order.channel === 'COUNTER'"> · Venda no balcão</template>
          </p>
        </div>
        <BaseStatusBadge kind="order" :status="order.status" :data-status="order.status" />
      </div>

      <div class="flex flex-wrap gap-2">
        <BaseButton v-if="order.status === 'PENDING_REVIEW'" :loading="acting" @click="markReady">
          <PackageCheck class="size-5" aria-hidden="true" />
          Pronto para retirada
        </BaseButton>
        <BaseButton v-if="order.status === 'READY_FOR_PICKUP'" :loading="acting" @click="markPickedUp">
          <CircleCheck class="size-5" aria-hidden="true" />
          Marcar como retirado
        </BaseButton>
        <BaseButton variant="secondary" :loading="printing" @click="printLabel">
          <Printer class="size-5" aria-hidden="true" />
          Imprimir etiqueta
        </BaseButton>
        <BaseButton v-if="order.canCancel" variant="ghost" @click="openCancel">
          <Ban class="size-5" aria-hidden="true" />
          Cancelar
        </BaseButton>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex flex-col gap-5">
          <BaseCard title="Itens" :heading-level="3">
            <OrderItems :order="order" />
          </BaseCard>
          <BaseCard v-if="order.notes" title="Recado do cliente" :heading-level="3">
            <p class="whitespace-pre-line text-text">{{ order.notes }}</p>
          </BaseCard>
        </div>
        <div class="flex flex-col gap-5">
          <BaseCard title="Cliente" :heading-level="3">
            <div class="flex flex-col gap-2 text-text">
              <NuxtLink
                :to="`/clientes/${order.customer.id}`"
                class="font-semibold text-link underline-offset-4 hover:underline"
                >{{ order.customer.name }}</NuxtLink
              >
              <a
                :href="`mailto:${order.customer.email}`"
                class="inline-flex items-center gap-2 break-all text-sm"
              >
                <Mail class="size-4 shrink-0" aria-hidden="true" />
                {{ order.customer.email }}
              </a>
              <a
                v-if="order.customer.phone"
                :href="`tel:${order.customer.phone}`"
                class="inline-flex items-center gap-2 text-sm"
              >
                <Phone class="size-4 shrink-0" aria-hidden="true" />
                {{ formatPhone(order.customer.phone) }}
              </a>
            </div>
          </BaseCard>
          <BaseCard title="Andamento" :heading-level="3">
            <BaseTimeline :events="orderTimeline(order)" label="Andamento do pedido" />
          </BaseCard>
        </div>
      </div>
    </template>

    <BaseDialog
      v-model:open="cancelOpen"
      title="Cancelar este pedido?"
      description="Os itens voltam para o estoque. O motivo fica no histórico do pedido."
      size="sm"
    >
      <BaseTextArea
        v-model="reason"
        label="Motivo"
        :maxlength="500"
        :rows="3"
        hint="O cliente vê este texto."
      />
      <template #footer>
        <BaseButton variant="secondary" @click="cancelOpen = false">Voltar</BaseButton>
        <BaseButton variant="danger" :loading="acting" @click="cancel">Cancelar pedido</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
