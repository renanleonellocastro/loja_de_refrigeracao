<script setup lang="ts">
import { ChevronLeft, ChevronRight, GripVertical, Star, Trash2, Upload } from 'lucide-vue-next';
import { MAX_PHOTOS_PER_UPLOAD, MAX_PRODUCT_PHOTOS, moveItem } from '~/utils/products';

/**
 * UC Gerenciar Fotos do Produto (RF-13): multi upload with progress, drag (or arrow buttons) to reorder,
 * choose the cover and remove. Every change answers the whole gallery, which replaces the one on screen.
 */
const props = defineProps<{ productId: number; images: ProductImageItem[] }>();
const emit = defineEmits<{ change: [images: ProductImageItem[]] }>();

const api = useApi();
const auth = useAuthStore();
const config = useRuntimeConfig();
const toast = useToast();
const { confirm } = useConfirm();

const files = ref<File[]>([]);
const progress = ref<number | null>(null);
const saving = ref(false);
const dragging = ref<number | null>(null);

const remaining = computed(() => MAX_PRODUCT_PHOTOS - props.images.length);
const uploadMax = computed(() => Math.max(1, Math.min(MAX_PHOTOS_PER_UPLOAD, remaining.value)));

async function upload(): Promise<void> {
  const form = new FormData();
  for (const file of files.value) form.append('files', file, file.name);
  progress.value = 0;
  try {
    const result = await uploadWithProgress(
      `${config.public.apiBase}/api/v1/products/${props.productId}/images`,
      form,
      auth.accessToken,
      (percent) => (progress.value = percent),
    );
    if (result.status !== 201) throw problemToError(result.status, result.body);
    emit('change', result.body as ProductImageItem[]);
    toast.success({
      title: files.value.length === 1 ? 'Foto enviada.' : `${files.value.length} fotos enviadas.`,
    });
    files.value = [];
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    progress.value = null;
  }
}

async function saveOrder(imageIds: number[], coverId?: number): Promise<void> {
  saving.value = true;
  try {
    const images = await unwrap(
      api.PUT('/api/v1/products/{id}/images/order', {
        params: { path: { id: props.productId } },
        body: { imageIds, coverId },
      }),
    );
    emit('change', images);
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    saving.value = false;
  }
}

function move(from: number, to: number): void {
  if (from === to) return;
  void saveOrder(moveItem(props.images, from, to).map((image) => image.id));
}

function makeCover(image: ProductImageItem): void {
  void saveOrder(
    props.images.map((item) => item.id),
    image.id,
  );
}

function onDrop(index: number): void {
  if (dragging.value !== null) move(dragging.value, index);
  dragging.value = null;
}

async function remove(image: ProductImageItem, index: number): Promise<void> {
  const confirmed = await confirm({
    title: `Remover a foto ${index + 1}?`,
    description: image.isCover
      ? 'Ela é a capa: a próxima foto vira a capa.'
      : 'Ela sai da galeria do produto.',
    confirmLabel: 'Remover foto',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await unwrap(
      api.DELETE('/api/v1/products/{id}/images/{imageId}', {
        params: { path: { id: props.productId, imageId: image.id } },
      }),
    );
    const rest = props.images.filter((item) => item.id !== image.id);
    // The API promotes the next photo when the cover leaves.
    emit(
      'change',
      rest.map((item, position) => ({
        ...item,
        position,
        isCover: image.isCover ? position === 0 : item.isCover,
      })),
    );
    toast.success({ title: 'Foto removida.' });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <BaseCard
      title="Galeria"
      :heading-level="3"
      description="Arraste para mudar a ordem ou use as setas. A capa aparece primeiro no catálogo."
    >
      <p v-if="images.length === 0" class="text-text-muted">
        Nenhuma foto ainda. Envie a primeira logo abaixo.
      </p>
      <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Fotos do produto">
        <li
          v-for="(image, index) in images"
          :key="image.id"
          class="flex flex-col overflow-hidden rounded-lg border bg-surface transition-shadow"
          :class="[
            image.isCover ? 'border-primary ring-2 ring-primary/30' : 'border-border',
            dragging === index ? 'opacity-50' : '',
          ]"
          draggable="true"
          :data-image="image.id"
          @dragstart="dragging = index"
          @dragover.prevent
          @drop.prevent="onDrop(index)"
          @dragend="dragging = null"
        >
          <div class="relative aspect-square bg-surface-sunken">
            <CatalogProductImage :image="image" :alt="`Foto ${index + 1}`" sizes="200px" />
            <span
              v-if="image.isCover"
              class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary"
            >
              <Star class="size-3" aria-hidden="true" />
              Capa
            </span>
            <GripVertical
              class="absolute top-2 right-2 hidden size-5 cursor-grab text-white drop-shadow md:block"
              aria-hidden="true"
            />
          </div>
          <div class="flex items-center justify-between gap-1 p-1">
            <BaseIconButton
              :label="`Mover a foto ${index + 1} para trás`"
              size="sm"
              :disabled="index === 0 || saving"
              @click="move(index, index - 1)"
            >
              <ChevronLeft class="size-5" aria-hidden="true" />
            </BaseIconButton>
            <BaseIconButton
              v-if="!image.isCover"
              :label="`Usar a foto ${index + 1} como capa`"
              size="sm"
              :disabled="saving"
              @click="makeCover(image)"
            >
              <Star class="size-5" aria-hidden="true" />
            </BaseIconButton>
            <BaseIconButton :label="`Remover a foto ${index + 1}`" size="sm" @click="remove(image, index)">
              <Trash2 class="size-5" aria-hidden="true" />
            </BaseIconButton>
            <BaseIconButton
              :label="`Mover a foto ${index + 1} para frente`"
              size="sm"
              :disabled="index === images.length - 1 || saving"
              @click="move(index, index + 1)"
            >
              <ChevronRight class="size-5" aria-hidden="true" />
            </BaseIconButton>
          </div>
        </li>
      </ul>
    </BaseCard>

    <BaseCard title="Adicionar fotos" :heading-level="3">
      <p v-if="remaining <= 0" class="text-text-muted">
        O produto já tem {{ MAX_PRODUCT_PHOTOS }} fotos, o máximo. Remova uma para enviar outra.
      </p>
      <div v-else class="flex flex-col gap-4">
        <BasePhotoUpload
          v-model="files"
          label="Novas fotos"
          :max="uploadMax"
          type="image/webp"
          :hint="`JPEG, PNG ou WebP. Cabem mais ${remaining}.`"
        />
        <BaseProgressBar v-if="progress !== null" label="Enviando fotos" :value="progress" show-value />
        <div class="flex justify-end">
          <BaseButton :disabled="files.length === 0" :loading="progress !== null" @click="upload">
            <Upload class="size-5" aria-hidden="true" />
            Enviar fotos
          </BaseButton>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
