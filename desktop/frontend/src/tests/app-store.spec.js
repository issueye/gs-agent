import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getGatewayHealth } from '@/services/gateway/health'
import { listAgentInstances } from '@/services/gateway/agentInstances'
import { listAgents } from '@/services/gateway/agents'
import { listConversations } from '@/services/gateway/conversations'
import { listProviders } from '@/services/gateway/providers'
import { listScheduledTasks } from '@/services/gateway/scheduledTasks'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/services/gateway/health', () => ({
  getGatewayHealth: vi.fn(),
}))

vi.mock('@/services/gateway/providers', () => ({
  listProviders: vi.fn(),
}))

vi.mock('@/services/gateway/agents', () => ({
  createAgent: vi.fn(),
  deleteAgent: vi.fn(),
  listAgents: vi.fn(),
  updateAgent: vi.fn(),
}))

vi.mock('@/services/gateway/agentInstances', () => ({
  deleteAgentInstance: vi.fn(),
  drainAgentInstance: vi.fn(),
  listAgentInstances: vi.fn(),
  restartAgentInstance: vi.fn(),
  startAgentInstance: vi.fn(),
  stopAgentInstance: vi.fn(),
}))

vi.mock('@/services/gateway/conversations', () => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  listConversationMessages: vi.fn(),
  listConversations: vi.fn(),
}))

vi.mock('@/services/gateway/scheduledTasks', () => ({
  createScheduledTask: vi.fn(),
  deleteScheduledTask: vi.fn(),
  listScheduledTasks: vi.fn(),
  updateScheduledTask: vi.fn(),
}))

vi.mock('@/services/wails/config', () => ({
  loadDesktopSettings: vi.fn(),
  saveDesktopSettings: vi.fn(),
}))

describe('app store gateway status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('keeps gateway connected when a secondary resource refresh fails', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.settings.gateway.baseUrl = 'http://127.0.0.1:8080'
    settingsStore.settings.gateway.defaultAgentId = 'agent_a'

    getGatewayHealth.mockResolvedValue({ status: 'ok' })
    listProviders.mockResolvedValue([])
    listAgents.mockResolvedValue([{ id: 'agent_a', name: 'Agent A' }])
    listAgentInstances.mockResolvedValue([])
    listConversations.mockResolvedValue([])
    listScheduledTasks.mockRejectedValue(new Error('tasks failed'))

    const appStore = useAppStore()
    await appStore.refreshGatewayData()

    expect(appStore.gatewayStatus).toBe('connected')
    expect(appStore.gatewayInfo).toEqual({ status: 'ok' })
    expect(appStore.error).toContain('定时任务')
  })

  it('marks gateway offline only when health check fails', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.settings.gateway.baseUrl = 'http://127.0.0.1:8080'
    getGatewayHealth.mockRejectedValue(new Error('health failed'))

    const appStore = useAppStore()
    await appStore.refreshGatewayData()

    expect(appStore.gatewayStatus).toBe('offline')
    expect(appStore.gatewayInfo).toBeNull()
    expect(appStore.error).toBe('health failed')
  })
})
