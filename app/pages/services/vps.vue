<script setup lang="ts">
import type { VpsStatus } from '~/types/vps'
import { formatBytes, formatServicePorts, formatUptime, percent, VPS_STATUS_META } from '~/utils/vps-status'
import { useVpsDashboard } from '~/utils/vps-client'

useSeoMeta({ title: 'VPS' })

const { data, error } = await useVpsDashboard()
const dashboard = computed(() => data.value)
const latest = computed(() => dashboard.value?.current)
const points = computed(() => dashboard.value?.history.samples ?? [])
const chartLabels = computed(() => points.value.map(point => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(point.timestamp))))
const statusMeta = (value: VpsStatus) => ({
  ...VPS_STATUS_META[value],
  hex: value === 'healthy' ? '#10b981' : value === 'warning' ? '#f59e0b' : value === 'critical' ? '#ef4444' : '#9ca3af'
})
const memoryUsedPercent = computed(() => {
  const memory = latest.value?.memory
  if (!memory?.totalBytes || memory.availableBytes === null) return null
  return (1 - memory.availableBytes / memory.totalBytes) * 100
})
const swapUsedPercent = computed(() => {
  const memory = latest.value?.memory
  if (!memory?.swapTotalBytes || memory.swapUsedBytes === null) return null
  return (memory.swapUsedBytes / memory.swapTotalBytes) * 100
})
const primaryFilesystem = computed(() => latest.value?.storage.filesystems.find(item => item.mountPoint === '/') ?? latest.value?.storage.filesystems[0])
const storageUsedPercent = computed(() => {
  if (!primaryFilesystem.value?.totalBytes || primaryFilesystem.value.usedBytes === null) return null
  return (primaryFilesystem.value.usedBytes / primaryFilesystem.value.totalBytes) * 100
})
const networkInterface = computed(() => latest.value?.network.interfaces[0])
const serviceItems = computed(() => (latest.value?.services.units ?? []).map(unit => ({ ...unit, label: unit.name, value: unit.name })))
const sampleCount = computed(() => points.value.length)
const clampPercent = (value: number | null) => value === null ? 0 : Math.min(100, Math.max(0, value))
const overviewCards = computed(() => {
  if (!latest.value || !dashboard.value) return []

  const cpu = latest.value.cpu
  const memory = latest.value.memory
  const storage = primaryFilesystem.value
  const services = latest.value.services
  const iface = networkInterface.value
  const cpuUsed = clampPercent(cpu.usagePercent)
  const memoryUsed = clampPercent(memoryUsedPercent.value)
  const diskUsed = clampPercent(storageUsedPercent.value)
  const active = services.active ?? 0
  const failed = services.failed ?? 0
  const other = Math.max(0, services.units.length - active - failed)
  const rx = iface?.rxBytesPerSecond ?? null
  const tx = iface?.txBytesPerSecond ?? null

  return [
    {
      title: 'CPU',
      status: cpu.status,
      centerValue: percent(cpu.usagePercent),
      centerLabel: 'digunakan',
      chartLabel: `Komposisi penggunaan CPU ${percent(cpu.usagePercent)}`,
      segments: cpu.usagePercent === null
        ? []
        : [
            { label: 'Digunakan', value: cpuUsed, color: statusMeta(cpu.status).hex },
            { label: 'Tersedia', value: Math.max(0, 100 - cpuUsed), color: '#e5e7eb' }
          ],
      details: [
        { label: 'Load', value: `${cpu.loadAverage['1m'] ?? '—'} / ${cpu.loadAverage['5m'] ?? '—'} / ${cpu.loadAverage['15m'] ?? '—'}` }
      ],
      footnote: `Peringatan ${dashboard.value.thresholds.cpu.warningPercent}% · kritis ${dashboard.value.thresholds.cpu.criticalPercent}%`
    },
    {
      title: 'Memory',
      status: memory.status,
      centerValue: percent(memoryUsedPercent.value),
      centerLabel: 'digunakan',
      chartLabel: `Komposisi memory terpakai ${percent(memoryUsedPercent.value)}`,
      segments: memoryUsedPercent.value === null
        ? []
        : [
            { label: 'Digunakan', value: memoryUsed, color: statusMeta(memory.status).hex },
            { label: 'Tersedia', value: Math.max(0, 100 - memoryUsed), color: '#e5e7eb' }
          ],
      details: [
        { label: 'Tersedia', value: `${formatBytes(memory.availableBytes)} / ${formatBytes(memory.totalBytes)}` },
        { label: 'Swap terpakai', value: percent(swapUsedPercent.value) }
      ],
      footnote: `Peringatan <${dashboard.value.thresholds.memoryAvailable.warningBelowPercent}% tersedia · kritis <${dashboard.value.thresholds.memoryAvailable.criticalBelowPercent}%`
    },
    {
      title: 'Storage',
      status: latest.value.storage.status,
      centerValue: percent(storageUsedPercent.value),
      centerLabel: 'digunakan',
      chartLabel: `Komposisi storage terpakai ${percent(storageUsedPercent.value)}`,
      segments: storageUsedPercent.value === null
        ? []
        : [
            { label: 'Digunakan', value: diskUsed, color: statusMeta(latest.value.storage.status).hex },
            { label: 'Tersedia', value: Math.max(0, 100 - diskUsed), color: '#e5e7eb' }
          ],
      details: [
        { label: `${storage?.mountPoint ?? 'Mount'} · terpakai`, value: `${formatBytes(storage?.usedBytes ?? null)} / ${formatBytes(storage?.totalBytes ?? null)}` },
        { label: 'Inode terpakai', value: percent(storage?.inodeUsedPercent ?? null) }
      ],
      footnote: `Peringatan ${dashboard.value.thresholds.storageUsed.warningPercent}% · kritis ${dashboard.value.thresholds.storageUsed.criticalPercent}%`
    },
    {
      title: 'Services',
      status: services.status,
      centerValue: `${services.active ?? '—'} / ${services.units.length}`,
      centerLabel: 'aktif',
      chartLabel: `${services.active ?? '—'} dari ${services.units.length} services aktif`,
      segments: services.active === null || services.failed === null
        ? []
        : [
            { label: 'Aktif', value: active, color: '#10b981' },
            { label: 'Gagal', value: failed, color: '#ef4444' },
            { label: 'Lainnya', value: other, color: '#9ca3af' }
          ],
      details: [
        { label: 'Aktif', value: String(services.active ?? '—') },
        { label: 'Gagal', value: String(services.failed ?? '—') }
      ],
      footnote: `${services.units.length} unit systemd dipantau`
    },
    {
      title: 'Network',
      status: latest.value.network.status,
      centerValue: rx === null || tx === null ? '—' : formatRate(rx + tx),
      centerLabel: 'RX + TX',
      chartLabel: `Komposisi traffic masuk dan keluar pada ${iface?.name ?? 'interface'}`,
      segments: rx === null || tx === null
        ? []
        : [
            { label: 'Masuk · RX', value: rx, color: '#0ea5e9' },
            { label: 'Keluar · TX', value: tx, color: '#8b5cf6' }
          ],
      details: [
        { label: 'Masuk · RX', value: formatRate(iface?.rxBytesPerSecond) },
        { label: 'Keluar · TX', value: formatRate(iface?.txBytesPerSecond) }
      ],
      footnote: `${iface?.name ?? 'Interface tidak tersedia'} · rasio traffic, kapasitas belum diketahui`
    }
  ]
})
const charts = computed(() => [
  {
    title: 'CPU',
    description: 'Utilisasi selama 60 menit',
    unit: 'percent' as const,
    ariaLabel: 'Grafik utilisasi CPU',
    datasets: [{ label: 'Utilisasi', color: '#10b981', values: points.value.map(point => point.cpuUsagePercent) }]
  },
  {
    title: 'Memory & swap',
    description: 'Available memory dan swap terpakai',
    unit: 'percent' as const,
    ariaLabel: 'Grafik available memory dan swap',
    datasets: [
      { label: 'Memory available', color: '#0ea5e9', values: points.value.map(point => point.memoryAvailablePercent) },
      { label: 'Swap terpakai', color: '#a78bfa', values: points.value.map(point => point.swapUsedPercent) }
    ]
  },
  {
    title: 'Storage I/O',
    description: 'Aktivitas baca dan tulis disk',
    unit: 'rate' as const,
    ariaLabel: 'Grafik aktivitas baca dan tulis disk',
    datasets: [
      { label: 'Read', color: '#0ea5e9', values: points.value.map(point => point.diskReadBytesPerSecond) },
      { label: 'Write', color: '#f59e0b', values: points.value.map(point => point.diskWriteBytesPerSecond) }
    ]
  },
  {
    title: 'Network',
    description: 'Traffic masuk dan keluar',
    unit: 'rate' as const,
    ariaLabel: 'Grafik traffic network masuk dan keluar',
    datasets: [
      { label: 'RX', color: '#10b981', values: points.value.map(point => point.networkRxBytesPerSecond) },
      { label: 'TX', color: '#f97316', values: points.value.map(point => point.networkTxBytesPerSecond) }
    ]
  }
])

function formatRate(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${formatBytes(value)}/s`
}
</script>

<template>
  <div class="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <UBadge
            :color="dashboard?.dataMode === 'mock' ? 'info' : 'success'"
            variant="subtle"
            class="rounded-full"
          >
            {{ dashboard?.dataMode === 'mock' ? 'Data demo' : 'Data VPS' }}
          </UBadge>
          <UBadge
            v-if="dashboard"
            :color="statusMeta(dashboard.health.status).color"
            variant="subtle"
            class="rounded-full"
          >
            <UIcon
              :name="statusMeta(dashboard.health.status).icon"
              class="mr-1 size-3.5"
            />{{ statusMeta(dashboard.health.status).label }}
          </UBadge>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight sm:text-[28px]">
          VPS
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Resource host dan unit systemd dalam satu tampilan.
        </p>
      </div>
      <div
        v-if="dashboard"
        class="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400"
      >
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-[#151719]">
          <UIcon
            name="i-lucide-server"
            class="size-3.5"
          />{{ dashboard.host.hostname }}
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-[#151719]">
          <UIcon
            name="i-lucide-activity"
            class="size-3.5"
          />{{ dashboard.host.os }}
        </span>
      </div>
    </div>

    <UCard
      v-if="!dashboard && !error"
      class="rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
    >
      <div class="flex items-center gap-3 text-sm text-gray-500">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-4 animate-spin"
        />Memuat ringkasan VPS…
      </div>
    </UCard>
    <UCard
      v-else-if="error"
      class="rounded-xl border-red-200 shadow-none dark:border-red-900"
    >
      <div class="flex items-start gap-3">
        <UIcon
          name="i-lucide-circle-alert"
          class="mt-0.5 size-5 text-red-600"
        /><div>
          <h2 class="text-sm font-semibold">
            Data VPS belum dapat dimuat
          </h2><p class="mt-1 text-sm text-gray-500">
            Periksa file mock response atau koneksi API.
          </p>
        </div>
      </div>
    </UCard>

    <template v-else-if="dashboard && latest">
      <section
        aria-label="Informasi host"
        class="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-gray-200 py-4 dark:border-gray-800 sm:grid-cols-4"
      >
        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400">Hostname</span><p class="mt-1 text-sm font-medium">
            {{ dashboard.host.hostname ?? '—' }}
          </p>
        </div>
        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400">Uptime</span><p class="mt-1 text-sm font-medium">
            {{ formatUptime(dashboard.host.uptimeSeconds) }}
          </p>
        </div>
        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400">CPU cores</span><p class="mt-1 text-sm font-medium">
            {{ dashboard.host.cpuCores ?? '—' }}
          </p>
        </div>
        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400">Load average · 1 / 5 / 15m</span><p class="mt-1 text-sm font-medium">
            {{ latest.cpu.loadAverage['1m'] ?? '—' }} / {{ latest.cpu.loadAverage['5m'] ?? '—' }} / {{ latest.cpu.loadAverage['15m'] ?? '—' }}
          </p>
        </div>
      </section>

      <section
        aria-label="Ringkasan resource"
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
      >
        <UCard
          v-for="card in overviewCards"
          :key="card.title"
          class="h-full rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
        >
          <div class="flex min-h-[276px] flex-col">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">{{ card.title }}</span><UBadge
                :color="statusMeta(card.status).color"
                variant="subtle"
                size="xs"
              >
                {{ statusMeta(card.status).label }}
              </UBadge>
            </div>
            <div class="mt-4 flex min-h-28 items-center justify-center">
              <VpsDonutChart
                :segments="card.segments"
                :center-value="card.centerValue"
                :center-label="card.centerLabel"
                :chart-label="card.chartLabel"
              />
            </div>
            <div class="mt-4 space-y-2.5">
              <div
                v-for="detail in card.details"
                :key="detail.label"
                class="flex items-start justify-between gap-3 text-xs"
              >
                <span class="min-w-0 text-gray-500 dark:text-gray-400">{{ detail.label }}</span>
                <span class="shrink-0 text-right font-medium text-gray-800 dark:text-gray-200">{{ detail.value }}</span>
              </div>
            </div>
            <p class="mt-auto pt-3 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
              {{ card.footnote }}
            </p>
          </div>
        </UCard>
      </section>

      <section
        aria-label="Tren resource"
        class="space-y-4"
      >
        <div class="flex items-end justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold tracking-tight">
              Tren resource
            </h2><p class="mt-1 text-xs text-gray-500">
              Rentang {{ dashboard.history.range }} · interval {{ Math.round(dashboard.history.stepSeconds / 60) }} menit · {{ sampleCount }} sampel demo
            </p>
          </div><UBadge
            color="neutral"
            variant="subtle"
            class="rounded-full"
          >
            {{ dashboard.collectedAt ? new Date(dashboard.collectedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Waktu tidak tersedia' }}
          </UBadge>
        </div>
        <div class="grid gap-4 xl:grid-cols-2">
          <UCard
            v-for="chart in charts"
            :key="chart.title"
            class="rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
          >
            <div class="mb-3">
              <h3 class="text-sm font-semibold">
                {{ chart.title }}
              </h3><p class="mt-1 text-xs text-gray-500">
                {{ chart.description }}
              </p>
            </div>
            <VpsResourceChart
              :labels="chartLabels"
              :datasets="chart.datasets"
              :unit="chart.unit"
              :chart-label="chart.ariaLabel"
            />
          </UCard>
        </div>
      </section>

      <section
        aria-label="Storage filesystem"
        class="grid gap-4 xl:grid-cols-2"
      >
        <UCard
          class="rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold">
                Filesystem
              </h2><p class="mt-1 text-xs text-gray-500">
                Kapasitas dan inode per mount point
              </p>
            </div><UBadge
              :color="statusMeta(latest.storage.status).color"
              variant="subtle"
            >
              {{ statusMeta(latest.storage.status).label }}
            </UBadge>
          </div>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[520px] text-left text-xs">
              <thead class="border-y border-gray-100 text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
                <tr>
                  <th class="px-3 py-3 font-medium">
                    Mount
                  </th><th class="px-3 py-3 font-medium">
                    Filesystem
                  </th><th class="px-3 py-3 font-medium">
                    Terpakai
                  </th><th class="px-3 py-3 text-right font-medium">
                    Inode
                  </th>
                </tr>
              </thead><tbody>
                <tr
                  v-for="filesystem in latest.storage.filesystems"
                  :key="filesystem.mountPoint"
                  class="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td class="px-3 py-3 font-medium">
                    {{ filesystem.mountPoint }}
                  </td><td class="px-3 py-3 text-gray-500">
                    {{ filesystem.fileSystem }}
                  </td><td class="px-3 py-3">
                    <div class="flex items-center gap-2">
                      <span>{{ percent(filesystem.totalBytes && filesystem.usedBytes !== null ? filesystem.usedBytes / filesystem.totalBytes * 100 : null) }}</span><UBadge
                        :color="statusMeta(filesystem.status).color"
                        variant="subtle"
                        size="xs"
                      >
                        {{ statusMeta(filesystem.status).label }}
                      </UBadge>
                    </div><span class="mt-1 block text-[10px] text-gray-500">{{ formatBytes(filesystem.usedBytes) }} / {{ formatBytes(filesystem.totalBytes) }}</span>
                  </td><td class="px-3 py-3 text-right text-gray-500">
                    {{ percent(filesystem.inodeUsedPercent) }}
                  </td>
                </tr><tr v-if="!latest.storage.filesystems.length">
                  <td
                    colspan="4"
                    class="px-3 py-8 text-center text-gray-500"
                  >
                    Data filesystem belum tersedia.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <UCard
          class="rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold">
                Network interfaces
              </h2><p class="mt-1 text-xs text-gray-500">
                RX/TX dan kesalahan per interface
              </p>
            </div><UBadge
              :color="statusMeta(latest.network.status).color"
              variant="subtle"
            >
              {{ statusMeta(latest.network.status).label }}
            </UBadge>
          </div>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[470px] text-left text-xs">
              <thead class="border-y border-gray-100 text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
                <tr>
                  <th class="px-3 py-3 font-medium">
                    Interface
                  </th><th class="px-3 py-3 font-medium">
                    RX / TX
                  </th><th class="px-3 py-3 font-medium">
                    Errors
                  </th><th class="px-3 py-3 text-right font-medium">
                    Drops
                  </th>
                </tr>
              </thead><tbody>
                <tr
                  v-for="iface in latest.network.interfaces"
                  :key="iface.name"
                  class="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td class="px-3 py-3 font-medium">
                    {{ iface.name }}<UBadge
                      :color="statusMeta(iface.status).color"
                      variant="subtle"
                      size="xs"
                      class="ml-2"
                    >
                      {{ statusMeta(iface.status).label }}
                    </UBadge>
                  </td><td class="px-3 py-3 text-gray-500">
                    ↓ {{ formatRate(iface.rxBytesPerSecond) }}<br>↑ {{ formatRate(iface.txBytesPerSecond) }}
                  </td><td class="px-3 py-3 text-gray-500">
                    {{ iface.rxErrorsPerSecond ?? '—' }} / {{ iface.txErrorsPerSecond ?? '—' }}
                  </td><td class="px-3 py-3 text-right text-gray-500">
                    {{ iface.rxDropsPerSecond ?? '—' }} / {{ iface.txDropsPerSecond ?? '—' }}
                  </td>
                </tr><tr v-if="!latest.network.interfaces.length">
                  <td
                    colspan="4"
                    class="px-3 py-8 text-center text-gray-500"
                  >
                    Data interface belum tersedia.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="py-3 text-[11px] text-gray-500">
            Status kapasitas memerlukan batas bandwidth dari provider.
          </p>
        </UCard>
      </section>

      <section class="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <UCard
          class="rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold">
                Services · systemd
              </h2><p class="mt-1 text-xs text-gray-500">
                Status unit dibandingkan dengan kondisi yang diharapkan
              </p>
            </div><UBadge
              :color="statusMeta(latest.services.status).color"
              variant="subtle"
            >
              {{ latest.services.active ?? '—' }} aktif
            </UBadge>
          </div>
          <div
            v-if="serviceItems.length"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <UAccordion
              :items="serviceItems"
              type="multiple"
              :ui="{
                root: '',
                item: 'border-b border-gray-100 last:border-0 dark:border-gray-800',
                header: '',
                trigger: 'w-full cursor-pointer py-3.5 text-left transition-colors hover:bg-gray-50/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary dark:hover:bg-gray-900/50',
                label: 'w-full',
                trailingIcon: 'size-4 text-gray-400 transition-transform duration-200',
                content: '',
                body: 'border-t border-gray-100 bg-gray-50/60 py-4 dark:border-gray-800 dark:bg-gray-900/30'
              }"
            >
              <template #default="{ item }">
                <div class="flex w-full min-w-0 items-center justify-between gap-3 text-xs">
                  <div class="min-w-0">
                    <span class="block truncate font-medium text-gray-900 dark:text-white">{{ item.name }}</span>
                    <span class="mt-1 block text-gray-500 dark:text-gray-400">{{ item.actualState }} · Ekspektasi {{ item.expectedState }}</span>
                  </div>
                  <UBadge
                    :color="statusMeta(item.status).color"
                    variant="subtle"
                    size="xs"
                    class="shrink-0"
                  >
                    {{ statusMeta(item.status).label }}
                  </UBadge>
                </div>
              </template>
              <template #body="{ item }">
                <dl class="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Description
                    </dt>
                    <dd class="mt-1 text-gray-700 dark:text-gray-300">
                      {{ item.description ?? '—' }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Port
                    </dt>
                    <dd class="mt-1 text-gray-700 dark:text-gray-300">
                      {{ formatServicePorts(item.ports) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      PID
                    </dt>
                    <dd class="mt-1 font-mono text-gray-700 dark:text-gray-300">
                      {{ item.pid ?? '—' }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Uptime
                    </dt>
                    <dd class="mt-1 text-gray-700 dark:text-gray-300">
                      {{ formatUptime(item.uptimeSeconds) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Path
                    </dt>
                    <dd class="mt-1 break-all font-mono text-gray-700 dark:text-gray-300">
                      {{ item.path ?? '—' }}
                    </dd>
                  </div>
                  <div class="sm:col-span-2 xl:col-span-1">
                    <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Command Line
                    </dt>
                    <dd class="mt-1 break-all font-mono text-gray-700 dark:text-gray-300">
                      {{ item.commandLine ?? '—' }}
                    </dd>
                  </div>
                </dl>
              </template>
            </UAccordion>
          </div>
          <p
            v-else
            class="border-t border-gray-100 py-8 text-center text-xs text-gray-500 dark:border-gray-800"
          >
            Belum ada unit systemd yang dipantau.
          </p>
        </UCard>
        <UCard
          class="rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
        >
          <div class="flex items-start gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><UIcon
              name="i-lucide-clipboard-check"
              class="size-4"
            /></span><div>
              <h2 class="text-sm font-semibold">
                Ringkasan kondisi
              </h2><p class="mt-1 text-xs text-gray-500">
                Penyebab status keseluruhan
              </p>
            </div>
          </div>
          <ul
            v-if="dashboard.health.reasons.length"
            class="mt-4 space-y-3"
          >
            <li
              v-for="(reason, index) in dashboard.health.reasons"
              :key="reason"
              class="flex gap-2.5 text-xs leading-5 text-gray-600 dark:text-gray-300"
            >
              <UIcon
                :name="index === 0 ? 'i-lucide-circle-alert' : 'i-lucide-info'"
                :class="index === 0 ? 'mt-0.5 size-4 shrink-0 text-red-500' : 'mt-0.5 size-4 shrink-0 text-amber-500'"
              />{{ reason }}
            </li>
          </ul>
          <p
            v-else
            class="mt-4 text-xs leading-5 text-gray-500"
          >
            Tidak ada kondisi yang perlu ditampilkan berdasarkan data yang tersedia.
          </p>
          <div class="mt-5 border-t border-gray-100 pt-4 text-[11px] leading-5 text-gray-500 dark:border-gray-800">
            <p>Ambang berlaku setelah kondisi bertahan {{ dashboard.thresholds.cpu.forSeconds ? Math.round(dashboard.thresholds.cpu.forSeconds / 60) : '—' }} menit.</p><p class="mt-1">
              Status network unknown karena kapasitas interface belum ditentukan.
            </p>
          </div>
        </UCard>
      </section>
    </template>
  </div>
</template>
