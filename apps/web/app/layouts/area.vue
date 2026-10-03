<script setup lang="ts">
/**
 * Signed in area for customers and staff: sidebar on desktop, icon rail on tablet, bottom bar on phones.
 * Menu items come from the permission matrix through navigationFor().
 */
const actor = useCurrentActor();
const route = useRoute();

const navigation = computed(() => navigationFor(actor.value));

const title = computed(() => {
  if (typeof route.meta.title === 'string') return route.meta.title;
  return navigation.value.items.find((item) => item.to === route.path)?.label ?? 'Refrigeração Castro';
});
</script>

<template>
  <div class="flex min-h-dvh bg-bg">
    <LayoutSkipLink />
    <LayoutAreaSideNav :navigation="navigation" />
    <div class="flex min-w-0 flex-1 flex-col">
      <LayoutAreaTopBar :title="title" />
      <main
        id="conteudo"
        tabindex="-1"
        class="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-8 md:pt-8 md:pb-12"
      >
        <slot />
      </main>
    </div>
    <LayoutAreaBottomNav :navigation="navigation" />
  </div>
</template>
