import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { useVpsMonitoring } from '../../app/composables/use-vps-monitoring'
import fixture from '../../public/mock/vps-dashboard.json'

const processFetch = vi.hoisted(() => vi.fn())
vi.mock('../../app/utils/vps-processes-client', () => ({ fetchVpsProcesses: processFetch }))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('VPS monitoring lifecycle', () => {
  it('loads the process snapshot on mount and stops polling on unmount', async () => {
    vi.useFakeTimers()
    processFetch.mockResolvedValue({ source: 'linux-procfs', collectedAt: '2026-10-15T00:00:00Z', items: [] })
    const refresh = vi.fn().mockResolvedValue(undefined)
    const source = { data: ref(fixture), error: ref(undefined), refresh, pending: ref(false) } as never
    let processSource!: ReturnType<typeof useVpsMonitoring>['processSource']
    const wrapper = mount(defineComponent({
      setup() {
        const monitoring = useVpsMonitoring(source)
        processSource = monitoring.processSource
        return () => h('div')
      }
    }))

    await vi.waitFor(() => expect(processFetch).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(processSource.value).toBe('Live · Linux /proc'))
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(processFetch).toHaveBeenCalledOnce()
    expect(refresh).not.toHaveBeenCalled()
  })
})
