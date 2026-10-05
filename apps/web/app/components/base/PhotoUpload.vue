<script setup lang="ts">
import { Camera, ImagePlus, X } from 'lucide-vue-next';

/**
 * Picks photos (gallery or camera), compresses them in the browser to at most 2048 px and keeps previews.
 * The model is the list of ready to upload files.
 */
const props = withDefaults(
  defineProps<{
    label?: string;
    hint?: string;
    /** Short call to action shown on phones, where there is no drag and drop. */
    prompt?: string;
    error?: string;
    max?: number;
    type?: 'image/jpeg' | 'image/webp';
  }>(),
  {
    label: 'Fotos',
    hint: undefined,
    prompt: 'Mostre o problema com fotos.',
    error: undefined,
    max: 6,
    type: 'image/jpeg',
  },
);

const model = defineModel<File[]>({ default: () => [] });
const emit = defineEmits<{ change: [files: File[]] }>();

const id = useId();
const busy = ref(false);
const dragging = ref(false);
const previews = shallowRef<{ file: File; url: string }[]>([]);

watch(
  model,
  (files) => {
    const kept = new Map(previews.value.map((preview) => [preview.file, preview.url]));
    previews.value = files.map((file) => {
      const url = kept.get(file) ?? URL.createObjectURL(file);
      kept.delete(file);
      return { file, url };
    });
    for (const url of kept.values()) URL.revokeObjectURL(url);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  for (const preview of previews.value) URL.revokeObjectURL(preview.url);
});

const remaining = computed(() => props.max - model.value.length);
const full = computed(() => remaining.value <= 0);
const counter = computed(() => `${model.value.length} de ${props.max} fotos`);

async function addFiles(list: FileList | null | undefined): Promise<void> {
  const picked = Array.from(list ?? [])
    .filter((file) => file.type.startsWith('image/'))
    .slice(0, Math.max(0, remaining.value));
  if (picked.length === 0) return;
  busy.value = true;
  const compressed = await Promise.all(picked.map((file) => compressImage(file, { type: props.type })));
  busy.value = false;
  model.value = [...model.value, ...compressed];
  emit('change', model.value);
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement;
  void addFiles(input.files);
  input.value = '';
}

function onDrop(event: DragEvent): void {
  dragging.value = false;
  void addFiles(event.dataTransfer?.files);
}

function remove(index: number): void {
  model.value = model.value.filter((_, i) => i !== index);
  emit('change', model.value);
}
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2" :aria-describedby="`${id}-status`">
    <legend class="mb-1.5 text-sm font-semibold text-text">{{ label }}</legend>

    <ul v-if="previews.length" class="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos escolhidas">
      <li
        v-for="(preview, index) in previews"
        :key="preview.url"
        class="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface-sunken animate-rc-rise"
      >
        <img
          :src="preview.url"
          :alt="`Foto ${index + 1}: ${preview.file.name}`"
          class="size-full object-cover"
        />
        <button
          type="button"
          class="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full"
          :aria-label="`Remover foto ${index + 1}`"
          @click="remove(index)"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full bg-steel-950/70 text-white backdrop-blur-sm transition-colors group-hover:bg-danger"
          >
            <X class="size-4" aria-hidden="true" />
          </span>
        </button>
      </li>
    </ul>

    <div
      v-if="!full"
      class="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-200"
      :class="
        dragging
          ? 'border-primary bg-info-soft'
          : error
            ? 'border-danger'
            : 'border-border-strong/40 bg-surface'
      "
      data-testid="dropzone"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <span class="flex size-12 items-center justify-center rounded-full bg-info-soft text-on-info-soft">
        <BaseSpinner v-if="busy" class="size-6" />
        <ImagePlus v-else class="size-6" aria-hidden="true" />
      </span>
      <p class="text-sm text-text-muted">
        <span class="hidden md:inline">Arraste as fotos para cá ou </span>
        <span class="md:hidden">{{ prompt }} </span>
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <label
          :for="`${id}-camera`"
          class="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary focus-within:outline-3 focus-within:outline-focus md:hidden"
        >
          <Camera class="size-5" aria-hidden="true" />
          Tirar foto
          <input
            :id="`${id}-camera`"
            type="file"
            accept="image/*"
            capture="environment"
            class="sr-only"
            :disabled="busy"
            @change="onPick"
          />
        </label>
        <label
          :for="`${id}-gallery`"
          class="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-link focus-within:outline-3 focus-within:outline-focus hover:border-primary"
        >
          <ImagePlus class="size-5" aria-hidden="true" />
          Escolher fotos
          <input
            :id="`${id}-gallery`"
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            :disabled="busy"
            @change="onPick"
          />
        </label>
      </div>
    </div>

    <p :id="`${id}-status`" class="text-sm text-text-muted" aria-live="polite">
      <template v-if="busy">Preparando as fotos…</template>
      <template v-else
        >{{ counter }}<template v-if="hint"> · {{ hint }}</template></template
      >
    </p>
    <p v-if="error" class="text-sm font-medium text-danger">{{ error }}</p>
  </fieldset>
</template>
