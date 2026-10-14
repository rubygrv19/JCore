import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UCalendar } from '#components'
import { parseDate, type DateValue } from '@internationalized/date'

describe('Timeshit Nuxt UI calendar interaction', () => {
  it('selects an author date without a native HTML date input and honors the allowed range', async () => {
    const selected = shallowRef<DateValue>(parseDate('2026-10-12'))
    const container = document.createElement('div')
    document.body.append(container)
    const component = defineComponent({ setup: () => () => h(UCalendar, {
      'modelValue': selected.value,
      'minValue': parseDate('2026-10-10'),
      'maxValue': parseDate('2026-10-15'),
      'onUpdate:modelValue': (value) => { if (value && !Array.isArray(value) && 'year' in value) selected.value = value }
    }) })
    const wrapper = await mountSuspended(component, { attachTo: container })
    try {
      await nextTick()
      expect(container.querySelector('input[type="date"]')).toBeNull()
      const day = container.querySelector<HTMLElement>('[data-value="2026-10-13"]')
      expect(day).not.toBeNull()
      day!.click()
      await nextTick()
      expect(selected.value.toString()).toBe('2026-10-13')
      const blocked = container.querySelector<HTMLElement>('[data-value="2026-10-09"]')
      expect(blocked).not.toBeNull()
      expect(blocked?.getAttribute('data-disabled')).not.toBeNull()
    } finally {
      wrapper.unmount()
      container.remove()
    }
  })
})
