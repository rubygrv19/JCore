<script setup lang="ts">
useSeoMeta({ title: 'Dashboard' })
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">
        Dashboard
      </h1>
      <p class="mt-1 text-sm text-gray-500">
        Ringkasan workspace.
      </p>
    </div>
    <UCard
      class="rounded-xl border-gray-200/80 bg-white shadow-none dark:border-gray-800 dark:bg-[#151719]"
      :ui="{ body: 'p-8 sm:p-12' }"
    >
      <div class="flex min-h-64 flex-col items-center justify-center text-center">
        <span class="mb-5 grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><UIcon
          name="i-lucide-layout-dashboard"
          class="size-6"
        /></span>
        <UBadge
          color="info"
          variant="subtle"
          class="rounded-full"
        >
          Coming Soon
        </UBadge>
        <h2 class="mt-4 text-lg font-semibold tracking-tight">
          Dashboard sedang disiapkan
        </h2>
        <p class="mt-2 max-w-sm text-sm leading-6 text-gray-500">
          Konten Dashboard akan tersedia segera.
        </p>
      </div>
    </UCard>
  </div>
</template>
