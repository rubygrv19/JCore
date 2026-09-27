<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Tooltip, type ChartData, type ChartOptions } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip)

const props = defineProps<{
  segments: Array<{ label: string, value: number, color: string }>
  centerValue: string
  centerLabel: string
  chartLabel: string
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const chartData = computed<ChartData<'doughnut'>>(() => {
  const hasData = props.segments.some(segment => segment.value > 0)
  const segments = hasData
    ? props.segments
    : [{ label: 'Tidak tersedia', value: 1, color: '#9ca3af' }]

  return {
    labels: segments.map(segment => segment.label),
    datasets: [{
      data: segments.map(segment => Math.max(0, segment.value)),
      backgroundColor: segments.map(segment => segment.color),
      borderWidth: 0,
      hoverOffset: 3
    }]
  }
})

const options = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  cutout: '76%',
  animation: { duration: 250 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDark.value ? '#202326' : '#ffffff',
      titleColor: isDark.value ? '#f9fafb' : '#111827',
      bodyColor: isDark.value ? '#d1d5db' : '#374151',
      borderColor: isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label: context => ` ${context.label}: ${context.formattedValue}`
      }
    }
  }
}))
</script>

<template>
  <div
    role="img"
    :aria-label="chartLabel"
    class="relative size-40 shrink-0 sm:size-44"
  >
    <Doughnut
      :data="chartData"
      :options="options"
    />
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <span class="max-w-20 truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ centerValue }}</span>
      <span class="max-w-20 truncate text-[10px] text-gray-500 dark:text-gray-400">{{ centerLabel }}</span>
    </div>
  </div>
</template>
