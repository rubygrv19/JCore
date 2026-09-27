import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SERVICE_KEYS, type ServiceConfig, type ServiceConfigs, type ServiceKey } from '../types/services'

function createInitialConfigs(): ServiceConfigs {
  return Object.fromEntries(
    SERVICE_KEYS.map(key => [key, { baseUrl: '', mode: '' }])
  ) as ServiceConfigs
}

export const useServicesStore = defineStore('services', () => {
  const configs = ref<ServiceConfigs>(createInitialConfigs())

  function saveConfig(key: ServiceKey, config: ServiceConfig) {
    configs.value[key] = { ...config }
  }

  return { configs, saveConfig }
})

export { SERVICE_KEYS }
export type { ServiceConfig, ServiceConfigs, ServiceKey, ServiceMode } from '../types/services'
