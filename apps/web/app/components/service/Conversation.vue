<script setup lang="ts">
import { Send } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';

/**
 * Conversation between the customer and the store about a request (GET and POST /messages). A message of the
 * store moves the request to "Em conversa" and the answer of the customer brings it back to the queue, so the
 * page reloads the request after each message (`sent`).
 */
const props = defineProps<{ requestId: number; open: boolean; placeholder?: string }>();
const emit = defineEmits<{ sent: [] }>();

const api = useApi();
const toast = useToast();

const messages = ref<RequestMessage[] | null>(null);
const failed = ref(false);
const body = ref('');
const error = ref('');
const sending = ref(false);

const path = () => ({ path: { id: props.requestId } });

async function load(): Promise<void> {
  failed.value = false;
  try {
    messages.value = await unwrap(api.GET('/api/v1/service-requests/{id}/messages', { params: path() }));
  } catch {
    failed.value = true;
  }
}

async function send(): Promise<void> {
  const text = body.value.trim();
  if (!text) {
    error.value = 'Escreva a mensagem antes de enviar.';
    return;
  }
  error.value = '';
  sending.value = true;
  try {
    messages.value = await unwrap(
      api.POST('/api/v1/service-requests/{id}/messages', { params: path(), body: { body: text } }),
    );
    body.value = '';
    toast.success({ title: 'Mensagem enviada.' });
    emit('sent');
  } catch (caught) {
    toast.error({ title: toApiError(caught).message });
  } finally {
    sending.value = false;
  }
}

onMounted(load);
</script>

<template>
  <BaseCard title="Conversa" :heading-level="3">
    <p v-if="failed" class="text-sm text-danger">
      Não conseguimos carregar a conversa.
      <button type="button" class="min-h-11 font-semibold text-link underline" @click="load">
        Tentar de novo
      </button>
    </p>
    <div v-else-if="!messages" role="status">
      <span class="sr-only">Carregando a conversa…</span>
      <BaseSkeleton class="h-20 w-full rounded-lg" />
    </div>
    <p v-else-if="messages.length === 0" class="text-sm text-text-muted">
      Nenhuma mensagem ainda. Use a conversa para tirar dúvidas sobre a visita.
    </p>
    <ol v-else class="flex flex-col gap-3" aria-label="Mensagens">
      <li
        v-for="message in messages"
        :key="message.id"
        class="flex flex-col"
        :class="message.mine ? 'items-end' : 'items-start'"
      >
        <div
          class="max-w-[85%] rounded-2xl px-4 py-2.5"
          :class="
            message.mine
              ? 'rounded-br-sm bg-primary text-on-primary'
              : 'rounded-bl-sm bg-surface-sunken text-text'
          "
        >
          <p class="whitespace-pre-line">{{ message.body }}</p>
        </div>
        <p class="mt-1 text-xs text-text-muted">
          {{ message.mine ? 'Você' : message.author.name }} ·
          <time :datetime="message.createdAt">{{ formatDateTime(message.createdAt) }}</time>
        </p>
      </li>
    </ol>

    <form v-if="open && messages" class="mt-5 flex flex-col gap-3" @submit.prevent="send">
      <BaseTextArea
        v-model="body"
        label="Sua mensagem"
        :placeholder="placeholder"
        :maxlength="2000"
        :rows="3"
        :error="error"
      />
      <BaseButton type="submit" class="self-end" :loading="sending">
        <Send class="size-4.5" aria-hidden="true" />
        Enviar mensagem
      </BaseButton>
    </form>
  </BaseCard>
</template>
