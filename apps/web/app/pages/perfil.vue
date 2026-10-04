<script setup lang="ts">
import { ROLE_LABELS, type ApiSchemas } from '@rc/contracts';
import { BadgeCheck, CalendarDays, Mail } from 'lucide-vue-next';
import { formatDate } from '~/utils/masks';

/** UCs Consultar e Editar Perfil, Alterar Senha, Exportar e Excluir (RF-03, RF-06, RF-10). */
definePageMeta({ layout: 'area', permission: 'profile.manage', title: 'Meu perfil' });
useHead({ title: 'Meu perfil | Refrigeração Castro' });

type Profile = ApiSchemas['UserDetail'];

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const profile = ref<Profile | null>(null);
const failed = ref(false);

const tabs = computed<TabItem[]>(() => [
  { value: 'dados', label: 'Dados' },
  { value: 'endereco', label: 'Endereço' },
  { value: 'seguranca', label: 'Segurança' },
  // Only customers delete their own account; team accounts are removed by the super user.
  ...(auth.actor === 'CLIENT' ? [{ value: 'privacidade', label: 'Privacidade' }] : []),
]);

// The tab lives in the address (?aba=seguranca), so links and the back button land on it.
const tab = computed<string>({
  get: () => {
    const asked = route.query.aba;
    return tabs.value.some((item) => item.value === asked) ? (asked as string) : 'dados';
  },
  set: (value) =>
    void router.replace({ query: { ...route.query, aba: value === 'dados' ? undefined : value } }),
});

async function load(): Promise<void> {
  failed.value = false;
  try {
    profile.value = await unwrap(api.GET('/api/v1/me'));
  } catch {
    failed.value = true;
  }
}

function onSaved(next: Profile): void {
  profile.value = next;
  auth.updateUser({ name: next.name, email: next.email });
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-6">
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <template v-else-if="!profile">
      <div
        class="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 sm:p-6"
        role="status"
      >
        <span class="sr-only">Carregando seu perfil…</span>
        <BaseSkeleton class="size-16 rounded-full" />
        <div class="flex flex-1 flex-col gap-2">
          <BaseSkeleton class="h-6 w-48 rounded-sm" />
          <BaseSkeleton class="h-4 w-64 max-w-full rounded-sm" />
        </div>
      </div>
      <BaseSkeleton class="h-11 w-full rounded-md" />
      <BaseSkeleton class="h-80 w-full rounded-xl" />
    </template>

    <template v-else>
      <section
        class="relative overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        aria-labelledby="perfil-nome"
      >
        <div class="rc-wall relative h-20 sm:h-24">
          <FrostLines class="pointer-events-none absolute -right-10 -bottom-6 w-96 text-frost-300/30" />
        </div>
        <div class="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6 sm:pb-6">
          <BaseAvatar :name="profile.name" size="lg" class="-mt-8 size-20! text-2xl! ring-4!" />
          <div class="min-w-0 flex-1">
            <h2 id="perfil-nome" class="truncate text-2xl font-extrabold text-text">{{ profile.name }}</h2>
            <p class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
              <span class="inline-flex min-w-0 items-center gap-1.5">
                <Mail class="size-4 shrink-0" aria-hidden="true" />
                <span class="truncate">{{ profile.email }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <CalendarDays class="size-4 shrink-0" aria-hidden="true" />
                Conta criada em {{ formatDate(profile.createdAt) }}
              </span>
            </p>
          </div>
          <span
            class="inline-flex items-center gap-1.5 self-start rounded-full bg-info-soft px-3 py-1 text-sm font-semibold text-on-info-soft sm:self-auto"
          >
            <BadgeCheck class="size-4" aria-hidden="true" />
            {{ ROLE_LABELS[profile.role] }}
          </span>
        </div>
      </section>

      <BaseTabs v-model="tab" :tabs="tabs" label="Seções do perfil">
        <template #dados><ProfileDataTab :profile="profile" @saved="onSaved" /></template>
        <template #endereco><ProfileAddressTab :profile="profile" @saved="onSaved" /></template>
        <template #seguranca><ProfileSecurityTab /></template>
        <template #privacidade><ProfilePrivacyTab /></template>
      </BaseTabs>
    </template>
  </div>
</template>
