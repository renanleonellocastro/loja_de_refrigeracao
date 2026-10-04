<script setup lang="ts">
/** UC Editar Usuário (RF-05, RF-07, RF-08): only the super user changes someone else's data. */
const props = defineProps<{ kind: DirectoryKind; user: UserDetail }>();
const emit = defineEmits<{ saved: [user: UserDetail] }>();
const open = defineModel<boolean>('open', { default: false });

const api = useApi();
const toast = useToast();

const form = useForm(personFromUser(props.user), {
  validate: (values) => validatePersonForm(values, props.kind),
});

watch(open, (now) => {
  if (now) form.reset(personFromUser(props.user));
});

async function save(): Promise<void> {
  const done = await form.submit(async (values) => {
    const user = await unwrap(
      api.PATCH('/api/v1/users/{id}', { params: { path: { id: props.user.id } }, body: personToApi(values) }),
    );
    toast.success({ title: 'Pronto! Os dados foram atualizados.' });
    emit('saved', user);
  });
  if (done) open.value = false;
}
</script>

<template>
  <BaseDialog v-model:open="open" :title="`Editar ${user.name}`" size="lg">
    <form id="users-edit-form" novalidate @submit.prevent="save">
      <UsersPersonFields v-model="form.values" :kind="kind" :errors="form.errors.value" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="users-edit-form" :loading="form.pending.value"
        >Salvar alterações</BaseButton
      >
    </template>
  </BaseDialog>
</template>
