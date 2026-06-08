import { fetchJSON } from './http'

export async function listAgents(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/agent')
  return [normalizeGatewayAgent(payload)]
}

export async function createAgent(baseUrl, input) {
  void baseUrl
  void input
  throw new Error('当前 gs-gateway 暂未提供 Agent 创建接口，请在 gs-agent 配置中管理 Agent。')
}

export async function updateAgent(baseUrl, agentId, input) {
  void baseUrl
  void agentId
  void input
  throw new Error('当前 gs-gateway 暂未提供 Agent 更新接口，请在 gs-agent 配置中管理 Agent。')
}

export async function deleteAgent(baseUrl, agentId) {
  void baseUrl
  void agentId
  throw new Error('当前 gs-gateway 暂未提供 Agent 删除接口，请在 gs-agent 配置中管理 Agent。')
}

function normalizeGatewayAgent(summary = {}) {
  const root = summary.root || summary.agentRoot || ''
  return {
    id: 'gs-agent',
    name: 'gs-agent',
    providerId: '',
    modelProvider: 'gs-gateway',
    modelName: summary.currentSession?.model || summary.model || '',
    baseUrl: root,
    transport: 'websocket',
    commandArgs: [],
    systemPrompt: '通过 gs-gateway 的 IM 入站任务链路运行',
    maxIterations: 0,
    toolWhitelist: [],
    networkAllow: [],
    mcpServerIds: [],
    skillIds: [],
    enabled: true,
    createdAt: '',
    updatedAt: summary.generatedAt || '',
  }
}
