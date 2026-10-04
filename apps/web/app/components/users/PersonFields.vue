<script setup lang="ts">
/** Name, contact, CPF and address of a person, shared by the registration and edit dialogs. */
const props = defineProps<{ kind: DirectoryKind; errors: FieldErrors }>();
const values = defineModel<PersonForm>({ required: true });
const config = computed(() => DIRECTORIES[props.kind]);
const isClient = computed(() => props.kind === 'CLIENT');
</script>

<template>
  <div class="flex flex-col gap-5">
    <BaseTextField
      v-model="values.name"
      label="Nome completo"
      autocomplete="off"
      :error="errors.name"
      required
    />
    <BaseTextField
      v-model="values.email"
      label="Email"
      type="email"
      inputmode="email"
      autocomplete="off"
      :error="errors.email"
      required
    />
    <div class="grid gap-5 sm:grid-cols-2">
      <BaseMaskedField
        v-model="values.phone"
        mask="phone"
        label="Telefone"
        :hint="isClient ? 'Com DDD. Usamos para combinar visitas.' : 'Opcional.'"
        :error="errors.phone"
        :required="isClient"
      />
      <BaseMaskedField
        v-model="values.cpf"
        mask="cpf"
        label="CPF"
        :hint="config.cpfRequired ? 'Obrigatório para a equipe.' : 'Opcional.'"
        :error="errors.cpf"
        :required="config.cpfRequired"
      />
    </div>
    <fieldset class="flex flex-col gap-3">
      <legend class="mb-3 font-semibold text-text">
        Endereço <span class="font-normal text-text-muted">(opcional)</span>
      </legend>
      <FormAddressFields v-model="values.address" :errors="errors" />
    </fieldset>
  </div>
</template>
