<script setup lang="ts">
/**
 * UCs Cadastrar Cliente, Colaborador e Gerente (RF-05, RF-07, RF-08). The API sends an invitation email
 * so the person chooses the password; nobody types a password for someone else.
 */
const props = defineProps<{ kind: DirectoryKind }>();
const emit = defineEmits<{ created: [user: UserDetail] }>();
const open = defineModel<boolean>('open', { default: false });

const api = useApi();
const toast = useToast();
const config = computed(() => DIRECTORIES[props.kind]);

const form = useForm(personFromUser(null), {
  validate: (values) => validatePersonForm(values, props.kind),
});

// Every opening starts from a blank form.
watch(open, (now) => {
  if (now) form.reset(personFromUser(null));
});

async function save(): Promise<void> {
  const done = await form.submit(async (values) => {
    const user = await unwrap(
      api.POST('/api/v1/users', { body: { role: props.kind, ...personToApi(values) } }),
    );
    toast.success({
      title: `Pronto! ${firstName(user.name)} foi cadastrado.`,
      description: `Enviamos o convite para ${user.email} criar a senha.`,
    });
    emit('created', user);
  });
  if (done) open.value = false;
}
</script>

<template>
  <BaseDialog
    v-model:open="open"
    :title="`Cadastrar ${config.noun}`"
    description="Preencha os dados principais. O restante a pessoa completa depois."
    size="lg"
  >
    <form id="users-create-form" class="flex flex-col gap-5" novalidate @submit.prevent="save">
      <BaseAlert tone="info">
        Enviamos um convite por email com o link para criar a senha. O link vale por 7 dias.
      </BaseAlert>
      <UsersPersonFields v-model="form.values" :kind="kind" :errors="form.errors.value" />
    </form>
    <template #footer>
      <BaseButton variant="secondary" @click="open = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="users-create-form" :loading="form.pending.value">
        Cadastrar e enviar convite
      </BaseButton>
    </template>
  </BaseDialog>
</template>
