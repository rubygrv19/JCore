import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { useNuxtApp } from '#app'
import { useColorMode } from '#imports'
import Heatmap from '../../app/components/TimeshitHeatmap.client.vue'
import type { TimeshitHeatmapDay } from '../../shared/utils/timeshit-heatmap'

const captured = vi.hoisted(() => ({ options: null as Record<string, unknown> | null, data: null as Record<string, unknown> | null }))
vi.mock('vue-chartjs', async () => {
  const { defineComponent, h } = await import('vue')
  return { Scatter: defineComponent({
    props: ['data', 'options'],
    setup(props) {
      return () => {
        captured.options = props.options
        captured.data = props.data
        return h('canvas', { 'data-testid': 'heatmap' })
      }
    }
  }) }
})
const apps: ReturnType<typeof createApp>[] = []
afterEach(() => {
  apps.forEach(app => app.unmount())
  apps.length = 0
  document.body.innerHTML = ''
})
const days: TimeshitHeatmapDay[] = [
  { date: '2026-10-12', x: 0, y: 1, count: null, observedCount: 0, level: 0 },
  { date: '2026-10-13', x: 0, y: 2, count: null, observedCount: 4, level: 2 }
]

function mount() {
  const selected = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp(defineComponent({ setup: () => () => h(Heatmap, { days, selectedDay: days[0]!.date, onSelectDay: selected }) }))
  apps.push(app)
  useNuxtApp().runWithContext(() => app.mount(container))
  return { selected, container }
}

describe('Timeshit heatmap chart integration', () => {
  it('emits the exact selected author day and ignores clicks outside cells', async () => {
    const { selected, container } = mount()
    await nextTick()
    const click = captured.options!.onClick as (event: unknown, elements: Array<{ index: number }>) => void
    click({}, [{ index: 1 }])
    expect(selected).toHaveBeenCalledExactlyOnceWith('2026-10-13')
    click({}, [])
    expect(selected).toHaveBeenCalledTimes(1)
    expect(container.querySelector('canvas')?.getAttribute('aria-label')).toContain('keyboard access')
  })
  it('updates grayscale fills and opaque tooltip colors when the theme changes', async () => {
    mount()
    const mode = useColorMode()
    const previous = mode.preference
    try {
      mode.preference = 'dark'
      await nextTick()
      expect((captured.options!.plugins as { tooltip: { backgroundColor: string } }).tooltip.backgroundColor).toBe('#171717')
      expect((captured.data!.datasets as Array<{ pointBackgroundColor: string[] }>)[0]!.pointBackgroundColor).toEqual(['#171717', '#737373'])
      mode.preference = 'light'
      await nextTick()
      expect((captured.options!.plugins as { tooltip: { backgroundColor: string } }).tooltip.backgroundColor).toBe('#ffffff')
      expect((captured.data!.datasets as Array<{ pointBackgroundColor: string[] }>)[0]!.pointBackgroundColor).toEqual(['#fafafa', '#a3a3a3'])
    } finally {
      mode.preference = previous
    }
  })
  it('provides opaque tooltip, unknown-count text, square cells and no animation', async () => {
    mount()
    await nextTick()
    const options = captured.options as { animation: boolean, plugins: { tooltip: { backgroundColor: string, callbacks: { label: (context: { dataIndex: number }) => string[] } } } }
    expect(options.animation).toBe(false)
    expect(options.plugins.tooltip.backgroundColor).toMatch(/^#[0-9a-f]{6}$/)
    expect(options.plugins.tooltip.callbacks.label({ dataIndex: 0 }).join(' ')).toContain('total unknown')
    const data = captured.data as { datasets: Array<{ pointStyle: string, pointBorderWidth: number[] }> }
    expect(data.datasets[0]!.pointStyle).toBe('rect')
    expect(data.datasets[0]!.pointBorderWidth).toEqual([3, 1])
  })
})
