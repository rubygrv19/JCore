<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Tooltip, type ChartData, type ChartOptions } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { formatBytes } from '~/utils/vps-status'

ChartJS.register(ArcElement, Tooltip)

const props = defineProps<{
  segments: Array<{ label: string, value: number, color: string }>
  centerValue: string
  chartLabel: string
  unit: 'percent' | 'rate'
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const prefersReducedMotion = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const chartData = computed<ChartData<'doughnut'>>(() => {
  const hasData = props.segments.some(segment => segment.value > 0)
  const segments = hasData
    ? props.segments
    : [{ label: 'Unavailable', value: 1, color: '#9ca3af' }]

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
  animation: prefersReducedMotion ? false : { duration: 250 },
  transitions: { active: { animation: { duration: 0 } } },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: props.segments.some(segment => segment.value > 0),
      backgroundColor: isDark.value ? 'rgb(32, 35, 38)' : 'rgb(255, 255, 255)',
      titleColor: isDark.value ? '#f9fafb' : '#111827',
      bodyColor: isDark.value ? '#d1d5db' : '#374151',
      borderColor: isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label: context => ` ${context.label}: ${props.unit === 'rate' ? `${formatBytes(context.parsed)}/s` : `${context.parsed.toFixed(0)}%`}`
      }
    }
  }
}))
</script>

<template>
  <div
    role="img"
    :aria-label="chartLabel"
    class="relative size-44 shrink-0 sm:size-48"
  >
    <Doughnut
      class="relative z-10"
      :data="chartData"
      :options="options"
    />
    <div class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-center">
      <span class="max-w-28 truncate text-[24px] font-semibold tracking-tight text-gray-900 dark:text-white">{{ centerValue }}</span>
    </div>
  </div>
</template>
