<script setup lang="ts">
import { GitMerge, RefreshCw } from 'lucide-vue-next';
import { CONFLICT_AUTHOR_LABELS, type ConflictRow } from '~/utils/product-conflict';

/**
 * Edit conflict of a product (RF-12): lists what differs between the version saved now and what the person typed,
 * then lets the person keep the edits on top of the saved version or drop them. Without the saved version (it could
 * not be read) only the reload is offered.
 */
defineProps<{ rows: ConflictRow[] | null }>();
const emit = defineEmits<{ keepMine: []; useSaved: [] }>();
</script>

<template>
  <BaseAlert tone="warning" title="Outra pessoa alterou este produto">
    <template v-if="rows">
      <p>Enquanto você editava, alguém salvou outra versão. Confira as diferenças antes de salvar de novo.</p>
      <p v-if="rows.length === 0" class="mt-2">
        Os dados deste formulário são iguais nas duas versões; a mudança foi em outra parte do produto.
      </p>
      <ul v-else class="mt-3 flex flex-col gap-3" aria-label="Diferenças entre as versões">
        <li
          v-for="row in rows"
          :key="row.field"
          class="rounded-md border border-on-warning-soft/20 bg-surface p-3 text-text"
        >
          <p class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-semibold">{{ row.label }}</span>
            <span class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-text">
              {{ CONFLICT_AUTHOR_LABELS[row.changedBy] }}
            </span>
          </p>
          <dl class="mt-2 grid gap-2 sm:grid-cols-2">
            <div class="min-w-0">
              <dt class="text-xs font-semibold text-text-muted">Versão salva agora</dt>
              <dd class="break-words whitespace-pre-line">{{ row.saved }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs font-semibold text-text-muted">Sua edição</dt>
              <dd class="break-words whitespace-pre-line">{{ row.mine }}</dd>
            </div>
          </dl>
        </li>
      </ul>
      <p class="mt-3">
        <strong>Manter minhas alterações</strong> junta as duas: os campos que você mudou ficam com o seu
        valor e os outros vêm da versão salva. Depois é só conferir e salvar.
      </p>
      <div class="mt-3 flex flex-col gap-2 sm:flex-row">
        <BaseButton size="sm" @click="emit('keepMine')">
          <GitMerge class="size-4" aria-hidden="true" />
          Manter minhas alterações
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="emit('useSaved')">
          <RefreshCw class="size-4" aria-hidden="true" />
          Usar a versão salva
        </BaseButton>
      </div>
    </template>
    <template v-else>
      Enquanto você editava, alguém salvou outra versão. Carregue a versão atual, confira e salve de novo.
      <div class="mt-3">
        <BaseButton variant="secondary" size="sm" @click="emit('useSaved')">
          <RefreshCw class="size-4" aria-hidden="true" />
          Carregar versão atual
        </BaseButton>
      </div>
    </template>
  </BaseAlert>
</template>
