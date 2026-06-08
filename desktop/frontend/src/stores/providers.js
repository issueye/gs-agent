import { defineStore } from 'pinia'
import {
  createProvider,
  deleteProvider,
  listProviders,
  updateProvider,
} from '@/services/gateway/providers'

export const useProvidersStore = defineStore('providers', {
  state: () => ({
    items: [],
    loading: false,
    saving: false,
    deletingId: '',
    error: '',
  }),

  actions: {
    async fetchProviders(baseUrl) {
      this.loading = true
      this.error = ''
      try {
        this.items = await listProviders(baseUrl)
        return this.items
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async saveProvider(baseUrl, provider) {
      this.saving = true
      this.error = ''
      try {
        const saved = provider.editingId
          ? await updateProvider(baseUrl, provider.editingId, provider)
          : await createProvider(baseUrl, provider)
        await this.fetchProviders(baseUrl)
        return saved
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.saving = false
      }
    },

    async removeProvider(baseUrl, providerId) {
      this.deletingId = providerId
      this.error = ''
      try {
        await deleteProvider(baseUrl, providerId)
        this.items = this.items.filter((item) => item.id !== providerId)
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.deletingId = ''
      }
    },
  },
})
