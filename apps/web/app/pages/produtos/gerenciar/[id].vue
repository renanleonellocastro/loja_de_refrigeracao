<script setup lang="ts">
import { can } from '@rc/contracts';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, RefreshCw, Trash2 } from 'lucide-vue-next';

/**
 * UCs Editar, Arquivar, Excluir e Desarquivar Produto, Gerenciar Fotos and Movimentar Estoque (RF-12 to RF-16).
 * Editing sends If-Match with the version on screen; a 412 means someone else saved first.
 */
definePageMeta({ layout: 'area', permission: 'products.manage', title: 'Produto' });

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const { confirm } = useConfirm();

const product = ref<ProductDetail | null>(null);
const categories = ref<Category[]>([]);
const failed = ref(false);
const notFound = ref(false);
const conflict = ref(false);
const busy = ref(false);
const canDelete = computed(() => can(auth.actor, 'products.delete'));

const TABS: TabItem[] = [
  { value: 'dados', label: 'Dados' },
  { value: 'fotos', label: 'Fotos' },
  { value: 'estoque', label: 'Estoque' },
];
const tab = ref(TABS.some((item) => item.value === route.query.aba) ? String(route.query.aba) : 'dados');
watch(tab, (value) => void router.replace({ query: { ...route.query, aba: value } }));

const form = useForm(productFormFrom(null), { validate: (values) => validateProductForm(values, false) });

useHead({ title: computed(() => `${product.value?.name ?? 'Produto'} | Refrigeração Castro`) });

function show(next: ProductDetail): void {
  product.value = next;
  form.reset(productFormFrom(next));
}

async function load(): Promise<void> {
  failed.value = false;
  conflict.value = false;
  try {
    const id = Number(route.params.id);
    const [detail, list] = await Promise.all([
      unwrap(api.GET('/api/v1/products/{id}', { params: { path: { id: String(id) } } })),
      unwrap(api.GET('/api/v1/categories')),
    ]);
    categories.value = list;
    show(detail);
  } catch (error) {
    notFound.value = toApiError(error).status === 404;
    failed.value = true;
  }
}

async function save(): Promise<void> {
  conflict.value = false;
  await form.submit(async (values) => {
    try {
      const saved = await unwrap(
        api.PATCH('/api/v1/products/{id}', {
          params: { path: { id: product.value!.id } },
          headers: { 'If-Match': ifMatch(product.value!.version) },
          body: productToApi(values),
        }),
      );
      show(saved);
      toast.success({ title: 'Alterações salvas.' });
    } catch (error) {
      if (toApiError(error).status !== 412) throw error;
      conflict.value = true;
    }
  });
}

async function remove(): Promise<void> {
  const confirmed = await confirm({
    title: 'Excluir este produto?',
    description:
      'Se ele já foi vendido, fica arquivado: sai do catálogo e o histórico dos pedidos continua. Se nunca foi vendido, some de vez.',
    confirmLabel: 'Excluir produto',
    danger: true,
  });
  if (!confirmed) return;
  busy.value = true;
  try {
    const { result } = await unwrap(
      api.DELETE('/api/v1/products/{id}', { params: { path: { id: product.value!.id } } }),
    );
    if (result === 'deleted') {
      toast.success({ title: 'Produto excluído.' });
      await navigateTo('/produtos/gerenciar');
    } else {
      toast.success({
        title: 'Produto arquivado.',
        description: 'Ele já tinha vendas, então saiu do catálogo e o histórico dos pedidos continua.',
      });
      await load();
    }
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    busy.value = false;
  }
}

async function unarchive(): Promise<void> {
  busy.value = true;
  try {
    show(
      await unwrap(
        api.POST('/api/v1/products/{id}/unarchive', { params: { path: { id: product.value!.id } } }),
      ),
    );
    toast.success({ title: 'Produto de volta ao catálogo.' });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    busy.value = false;
  }
}

function onImages(images: ProductImageItem[]): void {
  product.value = { ...product.value!, images };
}

function onStock(stock: { stockAvailable: number; lowStock: boolean }): void {
  product.value = { ...product.value!, ...stock, available: stock.stockAvailable > 0 };
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <NuxtLink
      to="/produtos/gerenciar"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Produtos
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!product" class="flex flex-col gap-4" role="status">
      <span class="sr-only">Carregando o produto…</span>
      <BaseSkeleton class="h-10 w-2/3 rounded-md" />
      <BaseSkeleton class="h-96 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 flex-col gap-1.5">
          <h2 class="text-2xl font-extrabold text-text">{{ product.name }}</h2>
          <p class="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span class="tabular-nums">{{ product.stockAvailable }} em estoque</span>
            <ProductsBadges :product="product" />
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseButton v-if="!product.archived" variant="ghost" size="sm" :to="`/produtos/${product.slug}`">
            <ExternalLink class="size-4" aria-hidden="true" />
            Ver no catálogo
          </BaseButton>
          <template v-if="canDelete">
            <BaseButton
              v-if="product.archived"
              variant="secondary"
              size="sm"
              :loading="busy"
              @click="unarchive"
            >
              <ArchiveRestore class="size-4" aria-hidden="true" />
              Desarquivar
            </BaseButton>
            <BaseButton v-else variant="secondary" size="sm" :loading="busy" @click="remove">
              <Trash2 class="size-4" aria-hidden="true" />
              Excluir ou arquivar
            </BaseButton>
          </template>
        </div>
      </div>

      <BaseAlert v-if="product.archived" tone="warning" title="Produto arquivado">
        <span class="inline-flex items-center gap-1.5">
          <Archive class="size-4" aria-hidden="true" />
          Ele não aparece no catálogo. Pedidos antigos continuam com o histórico.
        </span>
      </BaseAlert>

      <BaseTabs v-model="tab" :tabs="TABS" label="Seções do produto">
        <template #dados>
          <BaseCard>
            <form id="product-edit-form" class="flex flex-col gap-5" novalidate @submit.prevent="save">
              <BaseAlert v-if="conflict" tone="warning" title="Outra pessoa alterou este produto">
                Enquanto você editava, alguém salvou outra versão. Carregue a versão atual, confira e salve de
                novo.
                <div class="mt-3">
                  <BaseButton variant="secondary" size="sm" @click="load">
                    <RefreshCw class="size-4" aria-hidden="true" />
                    Carregar versão atual
                  </BaseButton>
                </div>
              </BaseAlert>
              <ProductsFields v-model="form.values" :categories="categories" :errors="form.errors.value" />
            </form>
            <template #footer>
              <div class="flex justify-end">
                <BaseButton type="submit" form="product-edit-form" :loading="form.pending.value">
                  Salvar alterações
                </BaseButton>
              </div>
            </template>
          </BaseCard>
        </template>
        <template #fotos>
          <ProductsPhotos :product-id="product.id" :images="product.images" @change="onImages" />
        </template>
        <template #estoque>
          <ProductsStock :product="product" @change="onStock" />
        </template>
      </BaseTabs>
    </template>
  </div>
</template>
