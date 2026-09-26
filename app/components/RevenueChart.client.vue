<script setup lang="ts">
import { Chart as ChartJS, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const revenue = [5.2, 6.5, 6, 7.3, 6.5, 8, 8.7]
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const data = computed(() => ({
  labels,
  datasets: [{
    label: 'Pendapatan',
    data: revenue,
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    fill: true,
    tension: 0.38,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: '#10b981',
    pointHoverBorderColor: isDark.value ? '#151719' : '#ffffff',
    pointHoverBorderWidth: 3
  }]
}))

const options = computed(() => {
  const muted = isDark.value ? '#9ca3af' : '#6b7280'
  const grid = isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(17, 24, 39, 0.08)'

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: isDark.value ? '#202326' : '#ffffff',
        titleColor: isDark.value ? '#f9fafb' : '#111827',
        bodyColor: isDark.value ? '#d1d5db' : '#374151',
        borderColor: grid,
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: { parsed: { y: number } }) => `Rp ${context.parsed.y.toLocaleString('id-ID')} jt`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: muted, font: { family: 'DM Sans', size: 10 } }
      },
      y: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 2,
          color: muted,
          padding: 8,
          font: { family: 'DM Sans', size: 10 },
          callback: (value: string | number) => `Rp ${value} jt`
        },
        grid: { color: grid, borderDash: [4, 4], drawTicks: false },
        border: { display: false }
      }
    }
  }
})
</script>

<template>
  <div class="relative h-48 w-full">
    <Line
      :data="data"
      :options="options"
      aria-label="Grafik pendapatan contoh per hari selama satu minggu, dalam juta rupiah"
    />
  </div>
</template>
