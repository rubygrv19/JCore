<script setup lang="ts">
import { Chart as ChartJS, LinearScale, PointElement, ScatterController, Tooltip, type ChartData, type ChartOptions } from 'chart.js'
import { Scatter } from 'vue-chartjs'
import { timeshitHeatmapDayLabel, type TimeshitHeatmapDay } from '#shared/utils/timeshit-heatmap'

ChartJS.register(LinearScale, PointElement, ScatterController, Tooltip)
const props = defineProps<{ days: TimeshitHeatmapDay[], selectedDay: string }>()
const emit = defineEmits<{ selectDay: [date: string] }>()
const colorMode = useColorMode()
const dark = computed(() => colorMode.value === 'dark')
const weeks = computed(() => (props.days.at(-1)?.x ?? 0) + 1)
const palette = computed(() => dark.value ? ['#171717', '#525252', '#737373', '#a3a3a3', '#f5f5f5'] : ['#fafafa', '#d4d4d4', '#a3a3a3', '#737373', '#171717'])
const foreground = computed(() => dark.value ? '#f5f5f5' : '#171717')
const data = computed<ChartData<'scatter'>>(() => ({ datasets: [{
  label: 'Daily commit activity',
  data: props.days.map(day => ({ x: day.x, y: day.y })),
  pointStyle: 'rect',
  pointRadius: 8,
  pointHoverRadius: 9,
  pointBackgroundColor: props.days.map(day => palette.value[day.level]!),
  pointBorderColor: props.days.map(day => day.date === props.selectedDay ? foreground.value : dark.value ? '#737373' : '#525252'),
  pointBorderWidth: props.days.map(day => day.date === props.selectedDay ? 3 : 1)
}] }))
const options = computed<ChartOptions<'scatter'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  onClick: (_event, elements) => {
    const day = props.days[elements[0]?.index ?? -1]
    if (day) emit('selectDay', day.date)
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: dark.value ? '#171717' : '#ffffff',
      titleColor: foreground.value,
      bodyColor: foreground.value,
      borderColor: dark.value ? '#a3a3a3' : '#525252',
      borderWidth: 1,
      displayColors: false,
      callbacks: {
        title: () => 'Asia/Jakarta · author date',
        label: context => timeshitHeatmapDayLabel(props.days[context.dataIndex]!).split(': ')
      }
    }
  },
  scales: {
    x: {
      min: -0.6, max: weeks.value - 1 + 0.6,
      grid: { display: false }, border: { display: false },
      ticks: {
        color: foreground.value, stepSize: 1, maxTicksLimit: 10,
        font: { family: 'Inter', size: 11 },
        callback: (value) => {
          const day = props.days.find(day => day.x === Number(value))
          return day ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`)) : ''
        }
      }
    },
    y: {
      min: -0.6, max: 6.6, reverse: true,
      grid: { display: false }, border: { display: false },
      ticks: { stepSize: 1, autoSkip: false, color: foreground.value, font: { family: 'Inter', size: 11 }, callback: value => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(value)] ?? '' }
    }
  }
}))
</script>

<template>
  <div class="max-w-full overflow-x-auto">
    <div
      class="relative h-56"
      :style="{ minWidth: `${Math.max(280, weeks * 20 + 64)}px` }"
    >
      <Scatter
        class="cursor-pointer"
        :data="data"
        :options="options"
        aria-label="All-branch daily commit heatmap. Use the daily counts table below for keyboard access and exact counts."
      />
    </div>
  </div>
</template>
