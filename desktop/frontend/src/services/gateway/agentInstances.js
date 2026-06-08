import { fetchJSON } from './http'

export async function listAgentInstances(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/agent-instances')
  return (Array.isArray(payload) ? payload : payload?.instances || []).map(normalizeAgentInstance)
}

export async function startAgentInstance(baseUrl, input) {
  const payload = await fetchJSON(baseUrl, '/api/agent-instances', {
    method: 'POST',
    body: input,
  })
  return normalizeAgentInstance(payload)
}

export async function stopAgentInstance(baseUrl, instanceId) {
  const payload = await fetchJSON(baseUrl, `/api/agent-instances/${encodeURIComponent(instanceId)}/stop`, {
    method: 'PATCH',
  })
  return normalizeAgentInstance(payload)
}

export async function restartAgentInstance(baseUrl, instanceId) {
  const payload = await fetchJSON(baseUrl, `/api/agent-instances/${encodeURIComponent(instanceId)}/restart`, {
    method: 'PATCH',
  })
  return normalizeAgentInstance(payload)
}

export async function drainAgentInstance(baseUrl, instanceId) {
  const payload = await fetchJSON(baseUrl, `/api/agent-instances/${encodeURIComponent(instanceId)}/drain`, {
    method: 'PATCH',
  })
  return normalizeAgentInstance(payload)
}

export async function deleteAgentInstance(baseUrl, instanceId) {
  await fetchJSON(baseUrl, `/api/agent-instances/${encodeURIComponent(instanceId)}`, {
    method: 'DELETE',
  })
}

function normalizeAgentInstance(instance = {}) {
  return {
    id: instance.id,
    agentId: instance.agentId || instance.agent_id || '',
    name: instance.name || instance.id,
    status: instance.status || 'unknown',
    pid: Number(instance.pid || 0),
    host: instance.host || '127.0.0.1',
    port: Number(instance.port || 0),
    baseUrl: instance.baseUrl || '',
    transport: instance.transport || 'websocket',
    commandArgs: Array.isArray(instance.commandArgs) ? instance.commandArgs : [],
    providerId: instance.providerId || '',
    modelProvider: instance.modelProvider || '',
    modelName: instance.modelName || '',
    modelBaseUrl: instance.modelBaseUrl || '',
    apiKeySet: Boolean(instance.apiKeySet),
    lastHeartbeatAt: instance.lastHeartbeatAt || '',
    lastError: instance.lastError || '',
    inflight: Number(instance.inflight || 0),
    createdAt: instance.created_at || instance.createdAt || '',
    updatedAt: instance.updated_at || instance.updatedAt || '',
  }
}
