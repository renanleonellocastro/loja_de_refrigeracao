<script setup lang="ts">
import { Send } from 'lucide-vue-next';
import { holdWhile, runOrToast } from '~/composables/useScreenAction';
import { formatDateTime } from '~/utils/masks';

/**
 * Conversation between the customer and the store about a visit request or a quote (GET and POST /messages).
 * A message of the store moves a request to "Em conversa" and the answer of the customer brings it back to the
 * queue, so the page reloads the record after each message (`sent`).
 */
const props = withDefaults(
  defineProps<{
    requestId: number;
    open: boolean;
    placeholder?: string;
    resource?: 'service-requests' | 'quotes';
    emptyText?: string;
  }>(),
  {
    placeholder: undefined,
    resource: 'service-requests',
    emptyText: 'Nenhuma mensagem ainda. Use a conversa para tirar dúvidas sobre a visita.',
  },
);
const emit = defineEmits<{ sent: [] }>();

const api = useApi();
const toast = useToast();

const messages = ref<RequestMessage[] | null>(null);
const failed = ref(false);
const body = ref('');
const error = ref('');
const sending = ref(false);

const path = () => ({ path: { id: props.requestId } });
const isQuote = () => props.resource === 'quotes';

function fetchMessages(): Promise<RequestMessage[]> {
  const options = { params: path() };
  return unwrap(
    isQuote()
      ? api.GET('/api/v1/quotes/{id}/messages', options)
      : api.GET('/api/v1/service-requests/{id}/messages', options),
  );
}

function postMessage(text: string): Promise<RequestMessage[]> {
  const options = { params: path(), body: { body: text } };
  return unwrap(
    isQuote()
      ? api.POST('/api/v1/quotes/{id}/messages', options)
      : api.POST('/api/v1/service-requests/{id}/messages', options),
  );
}

async function load(): Promise<void> {
  failed.value = false;
  try {
    messages.value = await fetchMessages();
  } catch {
    failed.value = true;
  }
}

async function deliver(text: string): Promise<void> {
  messages.value = await postMessage(text);
  body.value = '';
  toast.success({ title: 'Mensagem enviada.' });
  emit('sent');
}

async function send(): Promise<void> {
  const text = body.value.trim();
  if (!text) {
    error.value = 'Escreva a mensagem antes de enviar.';
    return;
  }
  error.value = '';
  await holdWhile(sending, true, false, () => runOrToast(() => deliver(text)));
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
    <p v-else-if="messages.length === 0" class="text-sm text-text-muted">{{ emptyText }}</p>
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
