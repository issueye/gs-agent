import { defineStore } from 'pinia'
import {
  deleteAgentInstance,
  drainAgentInstance,
  listAgentInstances,
  restartAgentInstance,
  startAgentInstance,
  stopAgentInstance,
} from '@/services/gateway/agentInstances'

export const useAgentInstancesStore = defineStore('agentInstances', {
  state: () => ({
    items: [],
    loading: false,
    startingAgentId: '',
    actionId: '',
    deletingId: '',
    error: '',
  }),

  actions: {
    async fetchInstances(baseUrl) {
      this.loading = true
      this.error = ''
      try {
        this.items = await listAgentInstances(baseUrl)
        return this.items
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async startInstance(baseUrl, input) {
      this.startingAgentId = input.agentId
      this.error = ''
      try {
        const instance = await startAgentInstance(baseUrl, input)
        await this.fetchInstances(baseUrl)
        return instance
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.startingAgentId = ''
      }
    },

    async stopInstance(baseUrl, instanceId) {
      await this.runInstanceAction(baseUrl, instanceId, stopAgentInstance)
    },

    async restartInstance(baseUrl, instanceId) {
      await this.runInstanceAction(baseUrl, instanceId, restartAgentInstance)
    },

    async drainInstance(baseUrl, instanceId) {
      await this.runInstanceAction(baseUrl, instanceId, drainAgentInstance)
    },

    async removeInstance(baseUrl, instanceId) {
      this.deletingId = instanceId
      this.error = ''
      try {
        await deleteAgentInstance(baseUrl, instanceId)
        this.items = this.items.filter((item) => item.id !== instanceId)
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.deletingId = ''
      }
    },

    async runInstanceAction(baseUrl, instanceId, action) {
      this.actionId = instanceId
      this.error = ''
      try {
        await action(baseUrl, instanceId)
        await this.fetchInstances(baseUrl)
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.actionId = ''
      }
    },
  },
})
