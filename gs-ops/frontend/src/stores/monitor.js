import { defineStore } from 'pinia'
import { fetchServiceMetrics } from '../api/monitor'

export const useMonitorStore = defineStore('monitor', {
  state: () => ({
    metricsByService: {},
    loading: false,
    error: '',
  }),
  actions: {
    async loadMetrics(serviceId) {
      this.loading = true
      this.error = ''
      try {
        const response = await fetchServiceMetrics(serviceId)
        this.metricsByService[serviceId] = response.data
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },
  },
})

