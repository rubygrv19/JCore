<script setup lang="ts">
import { useTimeshitStore } from '~/stores/timeshit'
import { saveTimeshitConnection, removeTimeshitConnection } from '~/utils/timeshit-client'
import { useServicesStore } from '~/stores/services'
import { normalizeBaseUrl } from '~/utils/service-clients'
import type { ServiceKey, ServiceMode } from '~/types/services'

useSeoMeta({ title: 'Settings' })

const servicesStore = useServicesStore()
const timeshit = useTimeshitStore()
onMounted(() => {
  void timeshit.load()
})
const timeshitCardLabel = computed(() => timeshit.loading ? 'Checking connection' : timeshit.error ? 'Status unavailable' : timeshit.connection?.state === 'connected' ? 'Connected' : timeshit.connection?.state === 'locked' ? 'Connection locked' : 'Not configured')
const tokenDraft = ref('')
const revealToken = ref(false)
const connectionBusy = ref(false)
const connectionError = ref('')
const connectionNotice = ref('')
const disconnectConfirmed = ref(false)

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

watch(configModalOpen, (open) => {
  if (!open) clearTokenDraft()
})
let formMounted = true
onBeforeUnmount(() => {
  formMounted = false
  clearTokenDraft()
})
function clearTokenDraft() {
  tokenDraft.value = ''
  revealToken.value = false
  disconnectConfirmed.value = false
}

async function updateConnection(disconnect = false) {
  if (!timeshit.connection || connectionBusy.value) return
  connectionBusy.value = true
  connectionError.value = ''
  connectionNotice.value = ''
  try {
    const result = disconnect
      ? await removeTimeshitConnection(timeshit.connection.generation)
      : await saveTimeshitConnection({ token: tokenDraft.value, expectedGeneration: timeshit.connection.generation })
    if (!formMounted) return
    timeshit.connection = result
    connectionNotice.value = disconnect ? 'GitHub disconnected. Saved token removed.' : 'GitHub identity verified. Connection saved.'
  } catch (error) {
    if (!formMounted) return
    const data = (error as { data?: { data?: { code?: string, retryAfterSeconds?: number } } }).data?.data
    const messages: Record<string, string> = { GITHUB_AUTH_FAILED: 'GitHub rejected this token. Check its validity.', GITHUB_RESTRICTED: 'GitHub denied access. Check permissions.', GITHUB_RATE_LIMITED: `Rate limited. Try again in ${data?.retryAfterSeconds ?? 60} seconds.`, CONNECTION_CHANGED: 'Connection changed. Status has been reloaded; review it before retrying.', STORAGE_LOCKED: 'Saved token is locked. Restore the server key or disconnect first.' }
    connectionError.value = messages[data?.code ?? ''] ?? 'Connection could not be saved. Check server configuration and try again.'
    await timeshit.load()
  } finally {
    connectionBusy.value = false
    clearTokenDraft()
  }
}

function openConfig(serviceKey: ServiceKey) {
  clearTokenDraft()
  connectionError.value = ''
  connectionNotice.value = ''
  if (serviceKey === 'timeshit') void timeshit.load()
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
          >{{ service.key === 'vps' ? 'Local collector' : service.key === 'timeshit' ? timeshitCardLabel : 'Not configured' }}</UBadge>
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
      :dismissible="!connectionBusy"
      :close="!connectionBusy"
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
                Host metrics are read from the loopback Prometheus endpoint configured by NUXT_VPS_PROMETHEUS_URL. Process details use Linux /proc. Live VPS data requires Nuxt and the collectors to run on Linux
                other hosts use demo data.
              </div>
              <div
                v-else-if="selectedServiceKey === 'timeshit'"
                class="space-y-5"
              >
                <p class="text-sm text-muted">
                  GitHub requests run through this Nuxt server. Your token is encrypted at rest and is never returned to the browser.
                </p>
                <UAlert
                  v-if="timeshit.loading"
                  color="neutral"
                  title="Loading connection status…"
                />
                <UAlert
                  v-else-if="timeshit.error"
                  color="neutral"
                  :title="timeshit.error"
                />
                <UButton
                  v-if="timeshit.error"
                  color="neutral"
                  variant="outline"
                  label="Retry status"
                  class="cursor-pointer"
                  @click="timeshit.load()"
                />
                <template v-if="timeshit.connection && !timeshit.loading">
                  <UAlert
                    v-if="timeshit.connection.state === 'unconfigured'"
                    color="neutral"
                    title="Server configuration required"
                    description="Set NUXT_TIMESHIT_ENCRYPTION_KEY and NUXT_TIMESHIT_TRUSTED_ORIGIN before connecting."
                  />
                  <UAlert
                    v-else-if="timeshit.connection.state === 'locked'"
                    color="neutral"
                    title="Saved connection is locked"
                    description="Restore the original server encryption key, or disconnect to remove the saved credential before reconnecting."
                  />
                  <div
                    v-else
                    class="space-y-4"
                  >
                    <div class="border-b border-default pb-3 text-sm">
                      <p class="font-semibold">
                        {{ timeshit.connection.account ? `Connected as ${timeshit.connection.account.login}` : 'GitHub not connected' }}
                      </p>
                      <p
                        v-if="timeshit.connection.account"
                        class="mt-1 text-xs text-muted"
                      >
                        Identity verified · Repository discovery: {{ timeshit.connection.checks.discovery }} · Check repository access in Timeshit
                      </p>
                    </div>
                    <UFormField
                      :label="timeshit.connection.state === 'connected' ? 'Replacement personal access token' : 'Personal access token'"
                      description="Fine-grained PAT: Metadata and Contents read access. Classic PAT: repo scope for private repositories; this scope also grants write capabilities. JCore only reads GitHub data."
                    >
                      <UInput
                        v-model="tokenDraft"
                        :type="revealToken ? 'text' : 'password'"
                        autocomplete="off"
                        :maxlength="1024"
                        placeholder="github_pat_…"
                        class="mt-2 w-full"
                        :disabled="connectionBusy"
                      >
                        <template #trailing>
                          <UButton
                            color="neutral"
                            variant="link"
                            :icon="revealToken ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                            :aria-label="revealToken ? 'Hide token' : 'Show token'"
                            class="cursor-pointer"
                            :disabled="connectionBusy"
                            @click="revealToken = !revealToken"
                          />
                        </template>
                      </UInput>
                    </UFormField>
                    <UButton
                      color="neutral"
                      :label="timeshit.connection.state === 'connected' ? 'Verify and replace token' : 'Verify and connect'"
                      :loading="connectionBusy"
                      :disabled="connectionBusy || tokenDraft.length < 20"
                      class="cursor-pointer"
                      @click="updateConnection()"
                    />
                  </div>
                  <div
                    v-if="timeshit.connection.generation"
                    class="space-y-3 border-t border-default pt-4"
                  >
                    <UCheckbox
                      v-model="disconnectConfirmed"
                      label="Remove the saved GitHub connection and tracked repository selection."
                      :disabled="connectionBusy"
                    />
                    <UButton
                      color="neutral"
                      variant="outline"
                      label="Disconnect GitHub"
                      class="cursor-pointer"
                      :disabled="connectionBusy || !disconnectConfirmed"
                      @click="updateConnection(true)"
                    />
                  </div>
                </template>
                <UAlert
                  v-if="connectionError"
                  color="neutral"
                  :title="connectionError"
                />
                <UAlert
                  v-if="connectionNotice"
                  color="neutral"
                  :title="connectionNotice"
                />
                <p class="text-xs text-muted">
                  Connection actions save immediately. Cancel only closes the form. Token drafts are cleared after each attempt and when the form closes.
                </p>
                <UFormField
                  label="External backend Base URL (reserved)"
                  description="Optional draft only. External Timeshit backends are not supported yet
tokens are always sent to this Nuxt server."
                  :error="baseUrlError || undefined"
                >
                  <UInput
                    v-model="baseUrlDraft"
                    type="url"
                    placeholder="https://api.example.com"
                    class="mt-2 w-full"
                    @update:model-value="baseUrlError = ''"
                  />
                </UFormField>
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
        <div class="flex w-full flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <p class="text-xs text-muted">
            {{ selectedServiceKey === 'timeshit' ? 'GitHub connection persists; modes and Base URL are temporary drafts.' : 'Development mock; changes are not saved to the backend' }}
          </p>
          <div class="flex shrink-0 items-center justify-end gap-2">
            <UButton
              label="Cancel"
              :disabled="connectionBusy"
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
              :disabled="connectionBusy || serviceModeDraft === 'shutdown' && !shutdownConfirmed"
              @click="saveConfig"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
