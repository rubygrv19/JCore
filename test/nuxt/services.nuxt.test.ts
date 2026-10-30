import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useServicesStore } from '../../app/stores/services'
import { SERVICE_KEYS } from '../../app/types/services'

describe('Nuxt service state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('initializes a Pinia configuration for every service', () => {
    const store = useServicesStore()

    expect(Object.keys(store.configs)).toEqual([...SERVICE_KEYS])
  })

  it('keeps saved settings isolated to the selected service', () => {
    const store = useServicesStore()
    store.saveConfig('vps', { baseUrl: 'https://vps.example.test/api', mode: 'maintenance' })

    expect(store.configs.vps).toEqual({ baseUrl: 'https://vps.example.test/api', mode: 'maintenance' })
    expect(store.configs.timeshit).toEqual({ baseUrl: '', mode: '' })
  })
})
