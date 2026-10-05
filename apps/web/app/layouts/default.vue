<!-- Public site: blue storefront header, content and the store footer, with the floating WhatsApp button. -->
<script setup lang="ts">
const store = useStoreInfo();
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <LayoutSkipLink />
    <LayoutSiteHeader />
    <main id="conteudo" tabindex="-1" class="flex-1 outline-none">
      <slot />
    </main>
    <LayoutSiteFooter />
    <WhatsAppButton v-if="store.whatsapp" :phone="store.whatsapp" />
  </div>
</template>
