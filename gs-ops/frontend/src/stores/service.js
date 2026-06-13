import { defineStore } from 'pinia'
import {
  createService,
  createConfigBackup,
  fetchConfigBackups,
  fetchService,
  fetchServices,
  fetchServiceTemplates,
  fetchVersions,
  restoreConfigBackup,
  rollbackService,
  runServiceAction,
  updateServiceConfig,
  upgradeService,
} from '../api/service'

export const useServiceStore = defineStore('service', {
  state: () => ({
    services: [],
    templates: [],
    current: null,
    backups: [],
    versions: [],
    loading: false,
    error: '',
  }),
  getters: {
    runningCount: (state) => state.services.filter((service) => service.status === 'running').length,
    stoppedCount: (state) => state.services.filter((service) => service.status === 'stopped').length,
    errorCount: (state) => state.services.filter((service) => service.status === 'error').length,
  },
  actions: {
    async loadServices() {
      this.loading = true
      this.error = ''
      try {
        const response = await fetchServices()
        this.services = response.data
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },
    async loadService(id) {
      this.loading = true
      this.error = ''
      try {
        const response = await fetchService(id)
        this.current = response.data
      } catch (error) {
        this.error = error.message
      } finally {
        this.loading = false
      }
    },
    async loadTemplates() {
      const response = await fetchServiceTemplates()
      this.templates = response.data
      return this.templates
    },
    async create(payload) {
      const response = await createService(payload)
      const created = response.data
      this.services = [...this.services, created]
      return created
    },
    async action(id, action) {
      const response = await runServiceAction(id, action)
      const updated = response.data
      this.services = this.services.map((service) => (service.id === id ? updated : service))
      if (this.current?.id === id) this.current = updated
      return updated
    },
    async saveConfig(id, config) {
      const response = await updateServiceConfig(id, config)
      const updated = response.data
      this.services = this.services.map((service) => (service.id === id ? updated : service))
      if (this.current?.id === id) this.current = updated
      await this.loadBackups(id)
      return updated
    },
    async loadBackups(id) {
      const response = await fetchConfigBackups(id)
      this.backups = response.data
    },
    async createBackup(id) {
      const response = await createConfigBackup(id)
      this.backups = [response.data, ...this.backups]
      return response.data
    },
    async restoreBackup(id, backupId) {
      const response = await restoreConfigBackup(id, backupId)
      const updated = response.data
      this.services = this.services.map((service) => (service.id === id ? updated : service))
      if (this.current?.id === id) this.current = updated
      return updated
    },
    async loadVersions(id) {
      const response = await fetchVersions(id)
      this.versions = response.data
    },
    async upgrade(id, version) {
      const response = await upgradeService(id, version)
      const updated = response.data.service
      this.services = this.services.map((service) => (service.id === id ? updated : service))
      if (this.current?.id === id) this.current = updated
      await this.loadVersions(id)
      return response.data
    },
    async rollback(id, version) {
      const response = await rollbackService(id, version)
      const updated = response.data.service
      this.services = this.services.map((service) => (service.id === id ? updated : service))
      if (this.current?.id === id) this.current = updated
      await this.loadVersions(id)
      return response.data
    },
  },
})
