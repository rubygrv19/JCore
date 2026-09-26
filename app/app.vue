<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'id' },
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})

useSeoMeta({
  title: 'Ringkasan — Dashboard',
  description: 'Dashboard ringkasan bisnis dengan data demo.'
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
