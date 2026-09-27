<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { VpsDashboardResponse, VpsStatus } from '~/types/vps'
import { formatBytes, formatServicePorts, formatUptime, percent, VPS_STATUS_META } from '~/utils/vps-status'
import { useVpsDashboard } from '~/utils/vps-client'

type VpsServiceUnit = VpsDashboardResponse['current']['services']['units'][number]

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
const expandedServiceRows = ref<Record<string, boolean>>({})
const serviceColumns: TableColumn<VpsServiceUnit>[] = [
  { id: 'expand', header: '', size: 48, enableSorting: false },
  { accessorKey: 'name', header: 'Service' },
  { accessorKey: 'actualState', header: 'State' },
  { accessorKey: 'expectedState', header: 'Ekspektasi' },
  { accessorKey: 'status', header: 'Kondisi' }
]
function toggleServiceRow(rowId: string) {
  expandedServiceRows.value = {
    ...expandedServiceRows.value,
    [rowId]: !expandedServiceRows.value[rowId]
  }
}
const sampleCount = computed(() => points.value.length)
const clampPercent = (value: number | null) => value === null ? 0 : Math.min(100, Math.max(0, value))
const overviewCards = computed(() => {
  if (!latest.value || !dashboard.value) return []

  const cpu = latest.value.cpu
  const memory = latest.value.memory
  const storage = primaryFilesystem.value
  const iface = networkInterface.value
  const cpuUsed = clampPercent(cpu.usagePercent)
  const memoryUsed = clampPercent(memoryUsedPercent.value)
  const diskUsed = clampPercent(storageUsedPercent.value)
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
        { label: 'Digunakan', value: percent(cpu.usagePercent), color: statusMeta(cpu.status).hex },
        { label: 'Tersedia', value: cpu.usagePercent === null ? '—' : percent(100 - cpuUsed), color: '#e5e7eb' }
      ],
      total: { label: 'CPU cores', value: dashboard.value.host.cpuCores === null ? '—' : `${dashboard.value.host.cpuCores} cores` },
      footerRows: [{ label: 'Load average · 1 / 5 / 15m', value: `${cpu.loadAverage['1m'] ?? '—'} / ${cpu.loadAverage['5m'] ?? '—'} / ${cpu.loadAverage['15m'] ?? '—'}` }],
      meter: null,
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
        { label: 'Digunakan', value: formatBytes(memory.totalBytes === null || memory.availableBytes === null ? null : memory.totalBytes - memory.availableBytes), color: statusMeta(memory.status).hex },
        { label: 'Tersedia', value: formatBytes(memory.availableBytes), color: '#e5e7eb' }
      ],
      total: { label: 'Total memory', value: formatBytes(memory.totalBytes) },
      footerRows: [{ label: 'Swap terpakai', value: `${formatBytes(memory.swapUsedBytes)} / ${formatBytes(memory.swapTotalBytes)} · ${percent(swapUsedPercent.value)}` }],
      meter: swapUsedPercent.value,
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
        { label: 'Digunakan', value: formatBytes(storage?.usedBytes ?? null), color: statusMeta(latest.value.storage.status).hex },
        { label: 'Tersedia', value: formatBytes(storage?.totalBytes == null || storage.usedBytes === null ? null : storage.totalBytes - storage.usedBytes), color: '#e5e7eb' }
      ],
      total: { label: `Total · ${storage?.mountPoint ?? '—'}`, value: formatBytes(storage?.totalBytes ?? null) },
      footerRows: [{ label: 'Inode terpakai', value: percent(storage?.inodeUsedPercent ?? null) }],
      meter: storage?.inodeUsedPercent ?? null,
      footnote: `Kapasitas: peringatan ${dashboard.value.thresholds.storageUsed.warningPercent}% · kritis ${dashboard.value.thresholds.storageUsed.criticalPercent}%`
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
        { label: 'Masuk · RX', value: formatRate(iface?.rxBytesPerSecond), color: '#0ea5e9' },
        { label: 'Keluar · TX', value: formatRate(iface?.txBytesPerSecond), color: '#8b5cf6' }
      ],
      total: { label: 'Interface', value: iface?.name ?? '—' },
      footerRows: [
        { label: 'Errors · RX / TX', value: `${iface?.rxErrorsPerSecond ?? '—'} / ${iface?.txErrorsPerSecond ?? '—'} per detik` },
        { label: 'Drops · RX / TX', value: `${iface?.rxDropsPerSecond ?? '—'} / ${iface?.txDropsPerSecond ?? '—'} per detik` }
      ],
      meter: null,
      footnote: 'Donut menunjukkan rasio traffic. Kapasitas bandwidth belum ditentukan.'
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
        class="grid gap-4 xl:grid-cols-2"
      >
        <UCard
          v-for="card in overviewCards"
          :key="card.title"
          class="h-full rounded-xl border-gray-200/80 shadow-none dark:border-gray-800"
        >
          <div class="flex h-full flex-col">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">{{ card.title }}</span><UBadge
                :color="statusMeta(card.status).color"
                variant="subtle"
                size="xs"
              >
                {{ statusMeta(card.status).label }}
              </UBadge>
            </div>
            <div class="mt-6 grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <VpsDonutChart
                :segments="card.segments"
                :center-value="card.centerValue"
                :center-label="card.centerLabel"
                :chart-label="card.chartLabel"
              />
              <dl class="min-w-0 space-y-3 text-xs sm:text-sm">
                <div
                  v-for="detail in card.details"
                  :key="detail.label"
                  class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                >
                  <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <span
                      class="size-2 shrink-0 rounded-full"
                      :style="{ backgroundColor: detail.color }"
                      aria-hidden="true"
                    />
                    {{ detail.label }}
                  </dt>
                  <dd class="ml-auto font-medium text-gray-800 tabular-nums dark:text-gray-200">
                    {{ detail.value }}
                  </dd>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                  <dt class="text-[10px] tracking-wide text-gray-500 uppercase dark:text-gray-400">
                    {{ card.total.label }}
                  </dt>
                  <dd class="ml-auto font-medium text-gray-800 tabular-nums dark:text-gray-200">
                    {{ card.total.value }}
                  </dd>
                </div>
              </dl>
            </div>
            <div class="mt-6 flex flex-1 flex-col border-t border-gray-200 pt-4 dark:border-gray-800">
              <div class="space-y-2">
                <div
                  v-for="row in card.footerRows"
                  :key="row.label"
                  class="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs"
                >
                  <span class="text-gray-500 dark:text-gray-400">{{ row.label }}</span>
                  <span class="ml-auto font-medium text-gray-800 tabular-nums dark:text-gray-200">{{ row.value }}</span>
                </div>
              </div>
              <UProgress
                v-if="card.meter !== null"
                :model-value="card.meter"
                :color="statusMeta(card.status).color"
                :aria-label="card.footerRows[0]?.label"
                size="xs"
                class="mt-3"
              />
              <p class="mt-auto pt-3 text-xs leading-5 text-gray-500 dark:text-gray-400">
                {{ card.footnote }}
              </p>
            </div>
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

      <section class="space-y-4">
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
          <div class="mt-4 overflow-x-auto">
            <UTable
              v-model:expanded="expandedServiceRows"
              :data="serviceItems"
              :columns="serviceColumns"
              :get-row-id="row => row.name"
              :expanded-options="{ getRowCanExpand: () => true }"
              empty="Belum ada unit systemd yang dipantau."
              class="min-w-[680px]"
              :ui="{ th: 'text-xs', td: 'align-middle text-xs' }"
            >
              <template #expand-cell="{ row }">
                <UButton
                  :icon="row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  :aria-label="row.getIsExpanded() ? `Tutup detail ${row.original.name}` : `Buka detail ${row.original.name}`"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="cursor-pointer"
                  @click="toggleServiceRow(row.id)"
                />
              </template>
              <template #name-cell="{ row }">
                <span class="font-medium text-gray-900 dark:text-white">{{ row.original.name }}</span>
              </template>
              <template #status-cell="{ row }">
                <UBadge
                  :color="statusMeta(row.original.status).color"
                  variant="subtle"
                  size="xs"
                >
                  {{ statusMeta(row.original.status).label }}
                </UBadge>
              </template>
              <template #expanded="{ row }">
                <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50 sm:p-5">
                  <dl class="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Description
                      </dt>
                      <dd class="mt-1 text-gray-700 dark:text-gray-300">
                        {{ row.original.description ?? '—' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Port
                      </dt>
                      <dd class="mt-1 text-gray-700 dark:text-gray-300">
                        {{ formatServicePorts(row.original.ports) }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        PID
                      </dt>
                      <dd class="mt-1 font-mono text-gray-700 dark:text-gray-300">
                        {{ row.original.pid ?? '—' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Uptime
                      </dt>
                      <dd class="mt-1 text-gray-700 dark:text-gray-300">
                        {{ formatUptime(row.original.uptimeSeconds) }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Path
                      </dt>
                      <dd class="mt-1 break-all font-mono text-gray-700 dark:text-gray-300">
                        {{ row.original.path ?? '—' }}
                      </dd>
                    </div>
                    <div class="sm:col-span-2 xl:col-span-1">
                      <dt class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Command Line
                      </dt>
                      <dd class="mt-1 break-all font-mono text-gray-700 dark:text-gray-300">
                        {{ row.original.commandLine ?? '—' }}
                      </dd>
                    </div>
                  </dl>
                </div>
              </template>
            </UTable>
          </div>
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
            class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
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
