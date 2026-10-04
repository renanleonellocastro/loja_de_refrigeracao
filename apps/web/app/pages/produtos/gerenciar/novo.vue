<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

/** UC Cadastrar Produto (RF-12): the initial stock becomes the first entry; photos come next, on the edit page. */
definePageMeta({ layout: 'area', permission: 'products.manage', title: 'Novo produto' });
useHead({ title: 'Novo produto | Refrigeração Castro' });

const api = useApi();
const toast = useToast();
const categories = ref<Category[]>([]);
const failed = ref(false);

const form = useForm(productFormFrom(null), { validate: (values) => validateProductForm(values, true) });

async function loadCategories(): Promise<void> {
  failed.value = false;
  try {
    categories.value = await unwrap(api.GET('/api/v1/categories'));
  } catch {
    failed.value = true;
  }
}

async function save(): Promise<void> {
  await form.submit(async (values) => {
    const product = await unwrap(
      api.POST('/api/v1/products', {
        body: { ...productToApi(values), initialStock: Number(String(values.initialStock).trim()) },
      }),
    );
    toast.success({ title: 'Produto cadastrado.', description: 'Agora adicione as fotos.' });
    await navigateTo(`/produtos/gerenciar/${product.id}?aba=fotos`);
  });
}

onMounted(loadCategories);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <NuxtLink
      to="/produtos/gerenciar"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Produtos
    </NuxtLink>
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="loadCategories" />
    <BaseCard v-else title="Dados do produto" description="Depois de salvar, você adiciona as fotos.">
      <form id="product-create-form" novalidate @submit.prevent="save">
        <ProductsFields v-model="form.values" :categories="categories" :errors="form.errors.value" creating />
      </form>
      <template #footer>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton variant="secondary" to="/produtos/gerenciar">Cancelar</BaseButton>
          <BaseButton type="submit" form="product-create-form" :loading="form.pending.value">
            Cadastrar produto
          </BaseButton>
        </div>
      </template>
    </BaseCard>
  </div>
</template>
