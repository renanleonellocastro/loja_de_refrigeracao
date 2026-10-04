<script setup lang="ts">
import type { ApiSchemas } from '@rc/contracts';
import { BellOff, CheckCheck } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';

/** UC Consultar Notificações (RF-40): newest first; opening one marks it read and follows its link. */
definePageMeta({ layout: 'area', permission: 'notifications.read', title: 'Notificações' });
useHead({ title: 'Notificações | Refrigeração Castro' });

type Notification = ApiSchemas['Notification'];
const PAGE_SIZE = 20;

const api = useApi();
const toast = useToast();
const { count, refresh: refreshCount } = useUnreadCount();

const items = ref<Notification[]>([]);
const loaded = ref(false);
const pages = ref(0);
const page = ref(1);
const failed = ref(false);
const markingAll = ref(false);

async function load(): Promise<void> {
  failed.value = false;
  try {
    const result = await unwrap(
      api.GET('/api/v1/me/notifications', { params: { query: { page: page.value, pageSize: PAGE_SIZE } } }),
    );
    items.value = result.data;
    loaded.value = true;
    pages.value = Math.ceil(result.meta.total / PAGE_SIZE);
    count.value = result.meta.unread;
  } catch {
    failed.value = true;
  }
}

async function open(item: Notification): Promise<void> {
  if (!item.readAt) {
    try {
      await unwrap(api.POST('/api/v1/me/notifications/{id}/read', { params: { path: { id: item.id } } }));
      item.readAt = new Date().toISOString();
      void refreshCount();
    } catch {
      // Marking as read is a convenience; the link still opens.
    }
  }
  if (item.link) await navigateTo(item.link);
}

async function markAll(): Promise<void> {
  markingAll.value = true;
  try {
    await unwrap(api.POST('/api/v1/me/notifications/read-all'));
    const now = new Date().toISOString();
    for (const item of items.value) item.readAt ??= now;
    count.value = 0;
    toast.success({ title: 'Pronto! Tudo marcado como lido.' });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    markingAll.value = false;
  }
}

watch(page, load);
onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-text-muted" aria-live="polite">
        {{
          count === 0 ? 'Nenhuma notificação nova.' : `${count} ${count === 1 ? 'não lida' : 'não lidas'}.`
        }}
      </p>
      <BaseButton v-if="count > 0" variant="secondary" size="sm" :loading="markingAll" @click="markAll">
        <CheckCheck class="size-4" aria-hidden="true" />
        Marcar todas como lidas
      </BaseButton>
    </div>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <div v-else-if="!loaded" class="flex flex-col gap-3" role="status">
      <span class="sr-only">Carregando notificações…</span>
      <BaseSkeleton v-for="n in 3" :key="n" class="h-20 w-full rounded-xl" />
    </div>

    <BaseEmptyState
      v-else-if="items.length === 0"
      title="Nenhuma notificação por aqui"
      text="Quando houver novidade nos seus pedidos, orçamentos ou visitas, ela aparece aqui."
    >
      <template #illustration><BellOff class="size-10 text-text-muted" aria-hidden="true" /></template>
    </BaseEmptyState>

    <template v-else>
      <ul class="flex flex-col gap-3">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-sunken"
            :class="item.readAt ? '' : 'border-l-4 border-l-primary'"
            @click="open(item)"
          >
            <span
              class="mt-1.5 size-2.5 shrink-0 rounded-full"
              :class="item.readAt ? 'bg-transparent' : 'bg-primary'"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-baseline justify-between gap-x-3">
                <span class="font-semibold text-text" :class="item.readAt ? '' : 'font-bold'">{{
                  item.title
                }}</span>
                <time :datetime="item.createdAt" class="text-xs text-text-muted tabular-nums">
                  {{ formatDateTime(item.createdAt) }}
                </time>
              </span>
              <span class="mt-1 block text-sm text-text-muted">{{ item.body }}</span>
              <span v-if="!item.readAt" class="sr-only">Não lida.</span>
            </span>
          </button>
        </li>
      </ul>
      <BasePagination v-if="pages > 1" v-model:page="page" :total="pages" label="Páginas de notificações" />
    </template>
  </div>
</template>
