<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next';
import { PRODUCT_FORM_STEPS, type ProductForm } from '~/utils/products';

/**
 * UC Cadastrar Produto (RF-12): the initial stock becomes the first entry; photos come next, on the edit page.
 * On the phone the form goes one step at a time and the last step saves.
 */
definePageMeta({ layout: 'area', permission: 'products.manage', title: 'Novo produto' });
useHead({ title: 'Novo produto | Refrigeração Castro' });

const api = useApi();
const toast = useToast();
const categories = ref<Category[]>([]);
const failed = ref(false);

/** The same checks run on save and, on the phone, for the step on screen before moving on. */
const validate = (): FieldErrors => validateProductForm(form.values, true);
const form = useForm(productFormFrom(null), { validate });
const steps = useFormSteps(PRODUCT_FORM_STEPS, {
  errors: form.errors,
  validate,
});

async function loadCategories(): Promise<void> {
  failed.value = false;
  try {
    categories.value = await unwrap(api.GET('/api/v1/categories'));
  } catch {
    failed.value = true;
  }
}

async function createProduct(values: ProductForm): Promise<void> {
  const product = await unwrap(
    api.POST('/api/v1/products', {
      body: { ...productToApi(values), initialStock: Number(String(values.initialStock).trim()) },
    }),
  );
  toast.success({ title: 'Produto cadastrado.', description: 'Agora adicione as fotos.' });
  await navigateTo(`/produtos/gerenciar/${product.id}?aba=fotos`);
}

async function save(): Promise<void> {
  if (!(await form.submit(createProduct))) await steps.revealFirstError();
}

/** On the phone the main button moves to the next step until the last one, which saves. */
function onSubmit(): Promise<void> {
  return steps.hasNext.value ? steps.next() : save();
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
      <form id="product-create-form" class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
        <FormStepNav :steps="steps" />
        <ProductsFields
          v-model="form.values"
          :categories="categories"
          :errors="form.errors.value"
          :shows="steps.shows"
          creating
        />
      </form>
      <template #footer>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <BaseButton
            v-if="steps.stepped.value && steps.current.value > 0"
            variant="secondary"
            @click="steps.back"
          >
            Voltar
          </BaseButton>
          <BaseButton v-else variant="secondary" to="/produtos/gerenciar">Cancelar</BaseButton>
          <BaseButton v-if="steps.hasNext.value" type="submit" form="product-create-form">
            Continuar
            <ArrowRight class="size-5" aria-hidden="true" />
          </BaseButton>
          <BaseButton v-else type="submit" form="product-create-form" :loading="form.pending.value">
            Cadastrar produto
          </BaseButton>
        </div>
      </template>
    </BaseCard>
  </div>
</template>
