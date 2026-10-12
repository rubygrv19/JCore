<script setup lang="ts">
import { useServicesStore } from '~/stores/services'
import { normalizeBaseUrl } from '~/utils/service-clients'
import type { ServiceKey, ServiceMode } from '~/types/services'

useSeoMeta({ title: 'Settings' })

const servicesStore = useServicesStore()
const services: Array<{ key: ServiceKey, label: string, icon: string }> = [
  { key: 'vps', label: 'VPS', icon: 'i-lucide-server' },
  { key: 'timeshit', label: 'Timeshit', icon: 'i-lucide-clock-3' },
  { key: 'code-review', label: 'Code Review', icon: 'i-lucide-git-pull-request' },
  { key: 'quota-tracker', label: 'Quota Tracker', icon: 'i-lucide-chart-no-axes-column-increasing' }
]
const serviceModeOptions: Array<{ value: Exclude<ServiceMode, ''>, label: string, description: string, icon: string, color: 'neutral' }> = [
  { value: 'coming-soon', label: 'Coming Soon', description: 'Mark this service as not yet available.', icon: 'i-lucide-sparkles', color: 'neutral' },
  { value: 'maintenance', label: 'Maintenance', description: 'Mark this service as under maintenance.', icon: 'i-lucide-wrench', color: 'neutral' },
  { value: 'shutdown', label: 'Shutdown', description: 'Mark this service as inactive.', icon: 'i-lucide-power', color: 'neutral' }
]
const serviceCards = computed(() => services.map(service => ({
  ...service,
  mode: serviceModeOptions.find(mode => mode.value === servicesStore.configs[service.key].mode)
})))

const selectedServiceKey = ref<ServiceKey>()
const selectedService = computed(() => services.find(service => service.key === selectedServiceKey.value)?.label ?? '')
const configModalOpen = ref(false)
const connectionAccordion = ref<string | undefined>('connection')
const dangerZoneAccordion = ref<string | undefined>()
const baseUrlDraft = ref('')
const baseUrlError = ref('')
const serviceModeDraft = ref<Exclude<ServiceMode, ''>>()
const shutdownConfirmed = ref(false)

function openConfig(serviceKey: ServiceKey) {
  const config = servicesStore.configs[serviceKey]
  selectedServiceKey.value = serviceKey
  baseUrlDraft.value = config.baseUrl
  baseUrlError.value = ''
  serviceModeDraft.value = config.mode || undefined
  shutdownConfirmed.value = false
  connectionAccordion.value = 'connection'
  dangerZoneAccordion.value = undefined
  configModalOpen.value = true
}

function saveConfig() {
  if (!selectedServiceKey.value) return
  let baseUrl = ''
  try {
    baseUrl = selectedServiceKey.value === 'vps' ? '' : normalizeBaseUrl(baseUrlDraft.value)
  } catch {
    baseUrlError.value = 'Enter an HTTP(S) URL without credentials, a query, or a fragment.'
    return
  }

  servicesStore.saveConfig(selectedServiceKey.value, { baseUrl, mode: serviceModeDraft.value ?? '' })
  configModalOpen.value = false
}
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 lg:px-10">
    <div class="mb-10 border-b border-gray-300 pb-6 dark:border-gray-700">
      <h1 class="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
        Settings
      </h1>
      <p class="mt-1 text-sm text-muted">
        Service configuration.
      </p>
    </div>
    <section
      aria-label="Service settings"
      class="grid gap-4 md:grid-cols-2"
    >
      <UButton
        v-for="service in serviceCards"
        :key="service.label"
        type="button"
        variant="outline"
        color="neutral"
        class="h-auto cursor-pointer flex-col items-stretch rounded-none border-gray-300 bg-app-sidebar p-5 text-left shadow-none transition-colors hover:border-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-app-sidebar-dark dark:hover:border-gray-100 dark:hover:bg-gray-900"
        @click="openConfig(service.key)"
      >
        <span class="mb-5 flex w-full items-start justify-between gap-3">
          <span class="grid size-10 place-items-center rounded-none bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"><UIcon
            :name="service.icon"
            class="size-5"
          /></span>
          <UBadge
            v-if="service.mode"
            :color="service.mode.color"
            variant="subtle"
            size="sm"
          >
            <UIcon
              :name="service.mode.icon"
              class="mr-1 size-3.5"
            />{{ service.mode.label }}
          </UBadge>
          <UBadge
            v-else
            color="neutral"
            variant="subtle"
            size="sm"
          >{{ service.key === 'vps' ? 'Local collector' : 'Not configured' }}</UBadge>
        </span>
        <span class="block text-sm font-semibold">{{ service.label }}</span>
        <span class="mt-1 block text-xs font-normal text-muted">Service configuration</span>
        <span class="mt-5 inline-flex items-center gap-1 text-xs font-medium text-gray-800 dark:text-gray-200">Manage configuration<UIcon
          name="i-lucide-arrow-up-right"
          class="size-3.5"
        /></span>
      </UButton>
    </section>

    <UModal
      v-model:open="configModalOpen"
      :title="selectedService"
    >
      <template #body>
        <div class="space-y-3">
          <UAccordion
            v-model="connectionAccordion"
            :items="[{ label: 'Connection', value: 'connection', icon: 'i-lucide-plug-zap' }]"
            type="single"
            class="overflow-hidden rounded-none border border-gray-300 dark:border-gray-700"
            :ui="{ item: 'border-0', trigger: 'cursor-pointer px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50', content: 'px-4', body: 'pb-4 pt-1' }"
          >
            <template #body>
              <div
                v-if="selectedServiceKey === 'vps'"
                class="rounded-none border border-gray-300 bg-gray-50 p-3 text-sm leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
              >
                Host metrics are read from the loopback Prometheus endpoint configured by NUXT_VPS_PROMETHEUS_URL. Process details use Linux /proc. Live VPS data requires Nuxt and the collectors to run on Linux; other hosts use demo data.
              </div>
              <UFormField
                v-else
                label="Base URL"
                :error="baseUrlError || undefined"
                description="Base API URL for this service."
                class="w-full"
              >
                <UInput
                  v-model="baseUrlDraft"
                  type="url"
                  placeholder="https://api.example.com"
                  class="mt-2 w-full"
                  @update:model-value="baseUrlError = ''"
                />
              </UFormField>
            </template>
          </UAccordion>

          <UAccordion
            v-model="dangerZoneAccordion"
            :items="[{ label: 'Danger Zone', value: 'danger-zone', icon: 'i-lucide-triangle-alert' }]"
            type="single"
            class="overflow-hidden rounded-none border border-gray-500 bg-gray-100/70 dark:border-gray-500 dark:bg-gray-950/40"
            :ui="{ item: 'border-0', trigger: 'cursor-pointer px-4 py-3.5 text-sm font-semibold text-gray-900 hover:bg-gray-200/70 dark:text-gray-100 dark:hover:bg-gray-800/70', leadingIcon: 'text-gray-800 dark:text-gray-200', label: 'text-gray-900 dark:text-gray-100', content: 'px-4', body: 'pb-4 pt-1' }"
          >
            <template #body>
              <div class="space-y-3">
                <p class="text-xs leading-5 text-gray-700 dark:text-gray-300">
                  Choose how this service is presented. This mock setting does not change the service itself.
                </p>
                <URadioGroup
                  v-model="serviceModeDraft"
                  :items="serviceModeOptions"
                  variant="card"
                  color="neutral"
                  legend="Service mode"
                  name="service-mode"
                  class="w-full"
                  :ui="{ fieldset: 'w-full gap-y-2', item: 'w-full cursor-pointer items-start rounded-none border-gray-300 bg-app-sidebar/80 p-3 transition hover:border-gray-700 dark:border-gray-700 dark:bg-app-sidebar-dark/70 dark:hover:border-gray-300', container: 'mt-0.5', wrapper: 'min-w-0 flex-1', label: 'flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100', description: 'mt-1 text-xs leading-5 text-muted dark:text-muted' }"
                  @update:model-value="shutdownConfirmed = false"
                >
                  <template #label="{ item }">
                    <UIcon
                      :name="item.icon"
                      class="size-4 text-gray-800 dark:text-gray-200"
                    />
                    {{ item.label }}
                  </template>
                </URadioGroup>
                <div
                  v-if="serviceModeDraft === 'shutdown'"
                  class="block rounded-none border border-gray-500 bg-gray-100 p-3 text-xs leading-5 text-gray-900 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-100"
                >
                  <UCheckbox
                    v-model="shutdownConfirmed"
                    color="neutral"
                    label="I understand this mode will mark the service as inactive."
                    class="cursor-pointer"
                  />
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-between gap-4">
          <p class="text-xs text-muted">
            Development mock; changes are not saved to the backend
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              class="cursor-pointer"
              @click="configModalOpen = false"
            />
            <UButton
              label="Save"
              color="neutral"
              icon="i-lucide-check"
              :class="serviceModeDraft === 'shutdown' && !shutdownConfirmed ? 'cursor-not-allowed' : 'cursor-pointer'"
              :disabled="serviceModeDraft === 'shutdown' && !shutdownConfirmed"
              @click="saveConfig"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
