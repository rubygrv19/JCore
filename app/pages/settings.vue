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
const serviceModeOptions: Array<{ value: Exclude<ServiceMode, ''>, label: string, description: string, icon: string, color: 'info' | 'warning' | 'error' }> = [
  { value: 'coming-soon', label: 'Coming Soon', description: 'Mark this service as not yet available.', icon: 'i-lucide-sparkles', color: 'info' },
  { value: 'maintenance', label: 'Maintenance', description: 'Mark this service as under maintenance.', icon: 'i-lucide-wrench', color: 'warning' },
  { value: 'shutdown', label: 'Shutdown', description: 'Mark this service as inactive.', icon: 'i-lucide-power', color: 'error' }
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
  <div class="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">
        Settings
      </h1>
      <p class="mt-1 text-sm text-gray-500">
        Service configuration.
      </p>
    </div>
    <section
      aria-label="Service settings"
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <UButton
        v-for="service in serviceCards"
        :key="service.label"
        type="button"
        variant="outline"
        color="neutral"
        class="h-auto cursor-pointer flex-col items-stretch rounded-xl border-gray-200/80 bg-white p-5 text-left shadow-none transition hover:border-emerald-300 hover:shadow-sm dark:border-gray-800 dark:bg-[#151719] dark:hover:border-emerald-700"
        @click="openConfig(service.key)"
      >
        <span class="mb-5 flex w-full items-start justify-between gap-3">
          <span class="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><UIcon
            :name="service.icon"
            class="size-5"
          /></span>
          <UBadge
            v-if="service.mode"
            :color="service.mode.color"
            variant="subtle"
            size="sm"
            class="rounded-full"
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
            class="rounded-full"
          >{{ service.key === 'vps' ? 'Local collector' : 'Not configured' }}</UBadge>
        </span>
        <span class="block text-sm font-semibold">{{ service.label }}</span>
        <span class="mt-1 block text-xs font-normal text-gray-500">Service configuration</span>
        <span class="mt-5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Manage configuration<UIcon
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
            class="overflow-hidden rounded-xl border border-gray-200/80 dark:border-gray-800"
            :ui="{ item: 'border-0', trigger: 'cursor-pointer px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50', content: 'px-4', body: 'pb-4 pt-1' }"
          >
            <template #body>
              <div
                v-if="selectedServiceKey === 'vps'"
                class="rounded-lg border border-gray-200/80 bg-gray-50 p-3 text-sm leading-6 text-gray-600 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-300"
              >
                The VPS process collector reads Linux /proc from the host running Nuxt. It is unavailable on macOS and other non-Linux hosts.
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
            class="overflow-hidden rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/15"
            :ui="{ item: 'border-0', trigger: 'cursor-pointer px-4 py-3.5 text-sm font-semibold text-red-700 hover:bg-red-100/60 dark:text-red-300 dark:hover:bg-red-950/50', leadingIcon: 'text-red-600 dark:text-red-400', label: 'text-red-700 dark:text-red-300', content: 'px-4', body: 'pb-4 pt-1' }"
          >
            <template #body>
              <div class="space-y-3">
                <p class="text-xs leading-5 text-red-800/80 dark:text-red-200/80">
                  Choose how this service is presented. This mock setting does not change the service itself.
                </p>
                <URadioGroup
                  v-model="serviceModeDraft"
                  :items="serviceModeOptions"
                  variant="card"
                  color="error"
                  legend="Service mode"
                  name="service-mode"
                  class="w-full"
                  :ui="{ fieldset: 'w-full gap-y-2', item: 'w-full cursor-pointer items-start rounded-lg border-red-200 bg-white/80 p-3 transition hover:border-red-300 dark:border-red-900/50 dark:bg-[#151719]/70', container: 'mt-0.5', wrapper: 'min-w-0 flex-1', label: 'flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100', description: 'mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400' }"
                  @update:model-value="shutdownConfirmed = false"
                >
                  <template #label="{ item }">
                    <UIcon
                      :name="item.icon"
                      class="size-4 text-red-600 dark:text-red-400"
                    />
                    {{ item.label }}
                  </template>
                </URadioGroup>
                <div
                  v-if="serviceModeDraft === 'shutdown'"
                  class="block rounded-lg border border-red-300 bg-red-100/70 p-3 text-xs leading-5 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                >
                  <UCheckbox
                    v-model="shutdownConfirmed"
                    color="error"
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
          <p class="text-xs text-gray-400">
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
              :color="serviceModeDraft === 'shutdown' ? 'error' : 'success'"
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
