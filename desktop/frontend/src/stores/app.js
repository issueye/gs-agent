import { defineStore } from 'pinia'
import { getGatewayHealth } from '@/services/gateway/health'
import { getAppInfo } from '@/services/wails/config'
import { useAgentInstancesStore } from './agentInstances'
import { useAgentsStore } from './agents'
import { useConversationsStore } from './conversations'
import { useProvidersStore } from './providers'
import { useScheduledTasksStore } from './scheduledTasks'
import { useSettingsStore } from './settings'
import { useSkillsStore } from './skills'

export const useAppStore = defineStore('app', {
  state: () => ({
    booting: false,
    ready: false,
    error: '',
    gatewayStatus: 'unknown',
    gatewayInfo: null,
    lastRefreshedAt: '',
    appInfo: null,
  }),

  actions: {
    async bootstrap() {
      if (this.booting) {
        return
      }
      this.booting = true
      this.error = ''

      const settingsStore = useSettingsStore()
      try {
        await settingsStore.load()
        this.appInfo = await getAppInfo()
      } catch (error) {
        this.error = error?.message || String(error)
      }

      try {
        await this.refreshGatewayData()
      } finally {
        this.ready = true
        this.booting = false
      }
    },

    async refreshGatewayData() {
      const settingsStore = useSettingsStore()
      const agentsStore = useAgentsStore()
      const agentInstancesStore = useAgentInstancesStore()
      const providersStore = useProvidersStore()
      const scheduledTasksStore = useScheduledTasksStore()
      const skillsStore = useSkillsStore()
      const conversationsStore = useConversationsStore()
      const baseUrl = String(settingsStore.settings.gateway.baseUrl || '').trim()

      if (!baseUrl) {
        this.gatewayStatus = 'unconfigured'
        this.gatewayInfo = null
        this.error = ''
        return
      }

      try {
        const resourceFailures = await this.loadGatewayData(
          baseUrl,
          providersStore,
          agentsStore,
          agentInstancesStore,
          conversationsStore,
          scheduledTasksStore,
          skillsStore,
        )
        this.gatewayStatus = 'connected'
        this.lastRefreshedAt = new Date().toISOString()
        this.error = formatResourceFailures(resourceFailures)
      } catch (error) {
        this.gatewayStatus = 'offline'
        this.gatewayInfo = null
        this.error = error?.message || String(error)
      }
    },

    async loadGatewayData(baseUrl, providersStore, agentsStore, agentInstancesStore, conversationsStore, scheduledTasksStore, skillsStore) {
      this.gatewayInfo = await getGatewayHealth(baseUrl)
      const resourceRequests = [
        { label: '供应商', run: () => providersStore.fetchProviders(baseUrl) },
        { label: 'Agent', run: () => agentsStore.fetchAgents(baseUrl) },
        { label: 'Agent 实例', run: () => agentInstancesStore.fetchInstances(baseUrl) },
        { label: '会话', run: () => conversationsStore.fetchConversations(baseUrl) },
        { label: '定时任务', run: () => scheduledTasksStore.fetchTasks(baseUrl) },
        { label: '技能', run: () => skillsStore.fetchSkills(baseUrl) },
      ]

      const results = await Promise.allSettled(resourceRequests.map((request) => request.run()))
      return results
        .map((result, index) => ({ ...result, label: resourceRequests[index].label }))
        .filter((result) => result.status === 'rejected')
    },
  },
})

function formatResourceFailures(failures) {
  if (!failures.length) {
    return ''
  }
  const labels = failures.map((failure) => failure.label).join('、')
  return `网关已连接，但 ${labels} 数据刷新失败。`
}
