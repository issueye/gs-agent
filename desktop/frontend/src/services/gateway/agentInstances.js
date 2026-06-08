import { fetchJSON } from './http'

export async function listAgentInstances(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/agent')
  return [normalizeGatewayInstance(payload)]
}

export async function startAgentInstance(baseUrl, input) {
  void baseUrl
  void input
  throw new Error('当前 gs-gateway 暂未提供 Agent 实例启动接口。')
}

export async function stopAgentInstance(baseUrl, instanceId) {
  void baseUrl
  void instanceId
  throw new Error('当前 gs-gateway 暂未提供 Agent 实例停止接口。')
}

export async function restartAgentInstance(baseUrl, instanceId) {
  void baseUrl
  void instanceId
  throw new Error('当前 gs-gateway 暂未提供 Agent 实例重启接口。')
}

export async function drainAgentInstance(baseUrl, instanceId) {
  void baseUrl
  void instanceId
  throw new Error('当前 gs-gateway 暂未提供 Agent 实例排空接口。')
}

export async function deleteAgentInstance(baseUrl, instanceId) {
  void baseUrl
  void instanceId
  throw new Error('当前 gs-gateway 暂未提供 Agent 实例删除接口。')
}

function normalizeGatewayInstance(summary = {}) {
  return {
    id: 'gs-gateway-agent',
    agentId: 'gs-agent',
    name: 'gs-agent bridge',
    status: 'ready',
    pid: 0,
    host: '127.0.0.1',
    port: 0,
    baseUrl: summary.root || '',
    transport: 'websocket',
    commandArgs: [],
    providerId: 'gs-gateway',
    modelProvider: 'gs-gateway',
    modelName: summary.currentSession?.model || summary.model || '',
    modelBaseUrl: '',
    apiKeySet: false,
    lastHeartbeatAt: summary.generatedAt || '',
    lastError: '',
    inflight: 0,
    createdAt: '',
    updatedAt: summary.generatedAt || '',
  }
}
