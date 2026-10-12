<script setup lang="ts">
import { SERVICE_KEYS, type ServiceKey } from '~/types/services'

const route = useRoute()
const serviceLabels: Record<ServiceKey, { label: string }> = {
  'vps': { label: 'VPS' },
  'timeshit': { label: 'Timeshit' },
  'code-review': { label: 'Code Review' },
  'quota-tracker': { label: 'Quota Tracker' }
}
const serviceKey = String(route.params.service)
if (!SERVICE_KEYS.includes(serviceKey as ServiceKey)) {
  throw createError({ statusCode: 404, statusMessage: 'Service not found' })
}
const service = serviceLabels[serviceKey as ServiceKey]

useSeoMeta({ title: service.label })
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 lg:px-10">
    <div class="mb-10 border-b border-gray-300 pb-6 dark:border-gray-700">
      <h1 class="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
        {{ service.label }}
      </h1>
      <p class="mt-1 text-sm text-muted">
        Service page.
      </p>
    </div>
    <UCard
      class="rounded-none border-gray-300 bg-white shadow-none dark:border-gray-700 dark:bg-[#121212]"
      :ui="{ body: 'p-0' }"
    >
      <div class="grid min-h-64 gap-6 p-6 sm:p-9 md:grid-cols-12 md:gap-10">
        <div class="md:col-span-7">
          <UBadge
            color="neutral"
            variant="outline"
          >
            Coming Soon
          </UBadge>
          <h2 class="mt-5 max-w-xl text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            {{ service.label }} is being prepared
          </h2>
        </div>
        <p class="max-w-md self-end text-sm leading-6 text-gray-600 dark:text-muted md:col-span-5 md:pb-1">
          Content for this service will be available soon.
        </p>
      </div>
    </UCard>
  </div>
</template>
