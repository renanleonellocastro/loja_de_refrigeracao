<script setup lang="ts">
import { CONDITION_OPTIONS } from '~/utils/products';

/** Fields of the product form shared by Cadastrar and Editar Produto (RF-12). */
const props = defineProps<{ categories: Category[]; errors: FieldErrors; creating?: boolean }>();
const values = defineModel<ProductForm>({ required: true });

const categoryOptions = computed<SelectOption[]>(() =>
  props.categories.map((category) => ({ value: String(category.id), label: category.name })),
);
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="sm:col-span-2">
      <BaseTextField v-model="values.name" label="Nome do produto" :error="errors.name" required />
    </div>
    <FormSelect
      v-model="values.categoryId"
      label="Categoria"
      placeholder="Escolha a categoria"
      :options="categoryOptions"
      :error="errors.categoryId"
      required
    />
    <FormSelect v-model="values.condition" label="Condição" :options="CONDITION_OPTIONS" required />
    <BaseTextField v-model="values.brand" label="Marca" :error="errors.brand" />
    <BaseTextField v-model="values.model" label="Modelo" :error="errors.model" />
    <BaseMaskedField
      v-model="values.priceCents"
      mask="money"
      label="Preço"
      :error="errors.priceCents"
      required
    />
    <BaseTextField
      v-if="creating"
      v-model="values.initialStock"
      label="Estoque inicial"
      inputmode="numeric"
      hint="Vira a primeira entrada do histórico de estoque."
      :error="errors.initialStock"
    />
    <BaseTextField
      v-model="values.stockMin"
      label="Estoque mínimo"
      inputmode="numeric"
      hint="Abaixo dele o produto ganha o aviso de estoque baixo. Vazio usa o padrão da loja."
      :error="errors.stockMin"
    />
    <div class="sm:col-span-2">
      <BaseTextArea
        v-model="values.description"
        label="Descrição"
        :rows="5"
        :maxlength="5000"
        :error="errors.description"
      />
    </div>
  </div>
</template>
