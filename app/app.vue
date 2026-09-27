<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'id' },
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})

useSeoMeta({
  titleTemplate: '%s — Ruangkerja',
  description: 'Dashboard layanan dan konfigurasi workspace.'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
