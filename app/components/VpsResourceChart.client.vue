<script setup lang="ts">
import { Chart as ChartJS, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip, type ChartData, type ChartOptions, type TooltipItem } from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip)

const props = defineProps<{
  labels: string[]
  datasets: Array<{ label: string, values: Array<number | null>, color: string }>
  unit: 'percent' | 'rate'
  chartLabel: string
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const data = computed<ChartData<'line'>>(() => ({
  labels: props.labels,
  datasets: props.datasets.map(series => ({
    label: series.label,
    data: series.values,
    borderColor: series.color,
    backgroundColor: `${series.color}1a`,
    fill: props.datasets.length === 1,
    tension: 0.34,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
    spanGaps: false
  }))
}))

const options = computed<ChartOptions<'line'>>(() => {
  const muted = isDark.value ? '#9ca3af' : '#6b7280'
  const grid = isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)'

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: props.datasets.length > 1, position: 'bottom', labels: { color: muted, usePointStyle: true, boxWidth: 6, boxHeight: 6, padding: 16, font: { family: 'Inter', size: 10 } } },
      tooltip: {
        displayColors: true,
        backgroundColor: isDark.value ? '#202326' : '#ffffff',
        titleColor: isDark.value ? '#f9fafb' : '#111827',
        bodyColor: isDark.value ? '#d1d5db' : '#374151',
        borderColor: grid,
        borderWidth: 1,
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const value = context.parsed.y
            if (value === null) return `${context.dataset.label}: —`
            const formatted = props.unit === 'percent' ? `${value}%` : `${(value / 1024 ** 2).toFixed(2)} MiB/s`
            return `${context.dataset.label}: ${formatted}`
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: muted, maxTicksLimit: 6, font: { family: 'Inter', size: 10 } } },
      y: {
        min: props.unit === 'percent' ? 0 : undefined,
        max: props.unit === 'percent' ? 100 : undefined,
        ticks: { color: muted, maxTicksLimit: 5, padding: 8, font: { family: 'Inter', size: 10 }, callback: value => props.unit === 'percent' ? `${value}%` : `${(Number(value) / 1024 ** 2).toFixed(1)} MiB/s` },
        grid: { color: grid, borderDash: [4, 4], drawTicks: false },
        border: { display: false }
      }
    }
  }
})
</script>

<template>
  <div class="relative h-52 w-full">
    <Line
      :data="data"
      :options="options"
      :aria-label="chartLabel"
    />
  </div>
</template>
