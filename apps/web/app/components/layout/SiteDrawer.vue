<script setup lang="ts">
import { PUBLIC_NAV, STORE_INFO } from '~/utils/store';
import { ChevronRight, Clock, MapPin, Phone, X } from 'lucide-vue-next';
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

/** Public menu drawer for phones and tablets. Focus is trapped while open and returns to the menu button. */
const open = defineModel<boolean>('open', { default: false });

const route = useRoute();
const auth = useAuthStore();
const toast = useToast();

async function signOut(): Promise<void> {
  await auth.logout();
  open.value = false;
  toast.success({ title: 'Você saiu da sua conta. Até logo!' });
}
watch(
  () => route.fullPath,
  () => {
    open.value = false;
  },
);
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-castro-950/55 backdrop-blur-[2px] data-[state=open]:animate-rc-fade"
      />
      <DialogContent
        class="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,88vw)] flex-col bg-surface-raised pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-lg outline-none data-[state=open]:animate-rc-slide-left"
        :aria-describedby="undefined"
      >
        <div class="rc-wall flex h-16 items-center justify-between px-4">
          <AppLogo relief class="h-8" aria-hidden="true" />
          <DialogTitle class="sr-only">Menu</DialogTitle>
          <DialogClose
            class="flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/12"
            aria-label="Fechar menu"
          >
            <X class="size-5.5" aria-hidden="true" />
          </DialogClose>
        </div>

        <nav aria-label="Menu" class="flex-1 overflow-y-auto px-3 py-4">
          <ul class="flex flex-col gap-0.5">
            <li v-for="item in PUBLIC_NAV" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="flex h-13 items-center justify-between rounded-md px-3 font-display text-lg font-bold text-text transition-colors hover:bg-surface-sunken aria-[current=page]:bg-info-soft aria-[current=page]:text-on-info-soft"
              >
                {{ item.label }}
                <ChevronRight class="size-5 text-text-muted" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
          <div v-if="auth.user" class="mt-4 grid gap-2 px-1">
            <BaseButton :to="accountHomeFor(auth.user.role)" block>Minha conta</BaseButton>
            <BaseButton variant="secondary" block @click="signOut">Sair</BaseButton>
          </div>
          <div v-else class="mt-4 grid gap-2 px-1">
            <BaseButton to="/entrar" block>Entrar</BaseButton>
            <BaseButton to="/criar-conta" variant="secondary" block>Criar conta</BaseButton>
          </div>
        </nav>

        <div class="border-t border-border px-4 py-4 text-sm text-text-muted">
          <p class="flex items-center gap-2">
            <Phone class="size-4 text-link" aria-hidden="true" />
            <a :href="STORE_INFO.phoneHref" class="font-semibold text-text">{{ STORE_INFO.phone }}</a>
          </p>
          <p class="mt-2 flex items-center gap-2">
            <Clock class="size-4 text-link" aria-hidden="true" />
            {{ STORE_INFO.hours }}
          </p>
          <p class="mt-2 flex items-start gap-2">
            <MapPin class="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
            {{ STORE_INFO.street }}, {{ STORE_INFO.district }}, {{ STORE_INFO.city }}
          </p>
          <div class="mt-4"><ThemeToggle block /></div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
