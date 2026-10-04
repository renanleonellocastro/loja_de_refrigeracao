<script setup lang="ts">
import { PUBLIC_NAV } from '~/utils/store';
import { Menu, ShoppingCart } from 'lucide-vue-next';

const cartCount = useCartCount();
const auth = useAuthStore();
const accountLink = computed(() => (auth.user ? accountHomeFor(auth.user.role) : '/entrar'));
const drawerOpen = ref(false);

const cartLabel = computed(() =>
  cartCount.value === 0
    ? 'Carrinho vazio'
    : `Carrinho com ${cartCount.value} ${cartCount.value === 1 ? 'item' : 'itens'}`,
);
</script>

<template>
  <header class="rc-wall sticky top-0 z-30 shadow-md shadow-castro-950/20">
    <div class="rc-container flex h-16 items-center gap-3 pt-[env(safe-area-inset-top)] lg:h-20">
      <NuxtLink
        to="/"
        class="-ml-1 flex h-11 items-center rounded-md px-1"
        aria-label="Refrigeração Castro, página inicial"
      >
        <AppLogo relief class="h-8 lg:h-10" aria-hidden="true" />
      </NuxtLink>

      <nav aria-label="Principal" class="ml-auto hidden lg:block">
        <ul class="flex items-center gap-1">
          <li v-for="item in PUBLIC_NAV" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="relative inline-flex h-11 items-center rounded-md px-3.5 text-[0.9375rem] font-medium text-castro-100 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:text-white after:absolute after:inset-x-3.5 after:bottom-1.5 after:h-0.5 after:scale-x-0 after:rounded-full after:bg-frost-300 after:transition-transform after:duration-300 aria-[current=page]:after:scale-x-100"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div class="ml-auto flex items-center gap-1 lg:ml-4 lg:gap-2">
        <NuxtLink
          to="/carrinho"
          class="relative inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/12"
          :aria-label="cartLabel"
        >
          <ShoppingCart class="size-5.5" aria-hidden="true" />
          <span
            v-if="cartCount > 0"
            class="absolute top-1 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-frost-300 px-1 text-xs font-bold text-castro-950 tabular-nums ring-2 ring-castro-700"
            aria-hidden="true"
          >
            {{ cartCount > 99 ? '99+' : cartCount }}
          </span>
        </NuxtLink>
        <NuxtLink
          v-if="auth.user"
          :to="accountLink"
          class="hidden h-11 items-center gap-2 rounded-full bg-white/10 pr-4 pl-1 text-[0.9375rem] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20 sm:inline-flex"
        >
          <BaseAvatar :name="auth.user.name" size="sm" />
          Minha conta
        </NuxtLink>
        <NuxtLink
          v-else
          to="/entrar"
          class="hidden h-11 items-center rounded-md bg-white px-5 text-[0.9375rem] font-semibold text-castro-800 shadow-sm transition-colors hover:bg-castro-50 sm:inline-flex"
        >
          Entrar
        </NuxtLink>
        <BaseIconButton
          label="Abrir menu"
          variant="on-brand"
          class="lg:hidden"
          aria-haspopup="dialog"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <Menu />
        </BaseIconButton>
      </div>
    </div>
    <LayoutSiteDrawer v-model:open="drawerOpen" />
  </header>
</template>
