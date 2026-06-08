import { fetchJSON } from './http'

export async function listProviders(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/agent')
  return [normalizeGatewayProvider(payload)]
}

export async function createProvider(baseUrl, input) {
  void baseUrl
  void input
  throw new Error('当前 gs-gateway 暂未提供供应商创建接口，请在 gs-agent 配置中管理模型供应商。')
}

export async function updateProvider(baseUrl, providerId, input) {
  void baseUrl
  void providerId
  void input
  throw new Error('当前 gs-gateway 暂未提供供应商更新接口，请在 gs-agent 配置中管理模型供应商。')
}

export async function deleteProvider(baseUrl, providerId) {
  void baseUrl
  void providerId
  throw new Error('当前 gs-gateway 暂未提供供应商删除接口，请在 gs-agent 配置中管理模型供应商。')
}

function normalizeGatewayProvider(summary = {}) {
  return {
    id: 'gs-gateway',
    name: 'gs-gateway',
    type: 'gateway',
    baseUrl: summary.root || '',
    defaultModel: summary.currentSession?.model || summary.model || '',
    enabled: true,
    apiKeySet: false,
    apiKeyPreview: '',
    createdAt: '',
    updatedAt: summary.generatedAt || '',
  }
}
