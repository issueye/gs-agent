import { defineStore } from 'pinia'
import { createAgent, deleteAgent, listAgents, updateAgent } from '@/services/gateway/agents'
import { useSettingsStore } from './settings'

export const useAgentsStore = defineStore('agents', {
  state: () => ({
    items: [],
    loading: false,
    saving: false,
    deletingId: '',
    error: '',
  }),

  getters: {
    selectedAgent(state) {
      const settingsStore = useSettingsStore()
      return state.items.find((item) => item.id === settingsStore.settings.gateway.defaultAgentId) || null
    },
  },

  actions: {
    async fetchAgents(baseUrl) {
      this.loading = true
      this.error = ''
      try {
        this.items = await listAgents(baseUrl)
        await this.ensureDefaultSelection()
        return this.items
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async saveAgent(baseUrl, agent) {
      this.saving = true
      this.error = ''
      try {
        const saved = agent.editingId
          ? await updateAgent(baseUrl, agent.editingId, agent)
          : await createAgent(baseUrl, agent)
        await this.fetchAgents(baseUrl)
        return saved
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.saving = false
      }
    },

    async removeAgent(baseUrl, agentId) {
      this.deletingId = agentId
      this.error = ''
      try {
        await deleteAgent(baseUrl, agentId)
        this.items = this.items.filter((item) => item.id !== agentId)
        await this.ensureDefaultSelection()
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.deletingId = ''
      }
    },

    async ensureDefaultSelection() {
      const settingsStore = useSettingsStore()
      const current = settingsStore.settings.gateway.defaultAgentId
      if (current && this.items.some((item) => item.id === current)) {
        return
      }
      if (this.items.length > 0) {
        await settingsStore.patch({
          gateway: {
            defaultAgentId: this.items[0].id,
          },
        })
        return
      }

      await settingsStore.patch({
        gateway: {
          defaultAgentId: '',
        },
      })
    },
  },
})
