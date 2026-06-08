import { fetchJSON } from './http'

export async function listAgents(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/agents')
  return (Array.isArray(payload) ? payload : payload?.agents || []).map(normalizeAgent)
}

export async function createAgent(baseUrl, input) {
  const payload = await fetchJSON(baseUrl, '/api/agents', {
    method: 'POST',
    body: agentPayload(input, { includeId: true }),
  })
  return normalizeAgent(payload)
}

export async function updateAgent(baseUrl, agentId, input) {
  const payload = await fetchJSON(baseUrl, `/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
    body: agentPayload(input),
  })
  return normalizeAgent(payload)
}

export async function deleteAgent(baseUrl, agentId) {
  await fetchJSON(baseUrl, `/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
  })
}

function agentPayload(input, options = {}) {
  const body = {
    name: input.name || '',
    providerId: input.providerId || '',
    modelProvider: input.modelProvider || 'openai',
    modelName: input.modelName || '',
    baseUrl: input.baseUrl || '',
    transport: input.transport || 'websocket',
    commandArgs: input.commandArgs || [],
    systemPrompt: input.systemPrompt || '',
    maxIterations: Number(input.maxIterations) || 0,
    toolWhitelist: input.toolWhitelist || [],
    networkAllow: input.networkAllow || [],
    mcpServerIds: input.mcpServerIds || [],
    skillIds: input.skillIds || [],
    enabled: input.enabled !== false,
  }
  if (options.includeId) {
    body.id = input.id || ''
  }
  return body
}

function normalizeAgent(agent = {}) {
  return {
    id: agent.id,
    name: agent.name || agent.id,
    providerId: agent.providerId || agent.provider_id || '',
    modelProvider: agent.modelProvider || agent.model_provider || 'openai',
    modelName: agent.modelName || agent.model_name || '',
    baseUrl: agent.baseUrl || '',
    transport: agent.transport || 'websocket',
    commandArgs: Array.isArray(agent.commandArgs) ? agent.commandArgs : [],
    systemPrompt: agent.systemPrompt || '',
    maxIterations: Number(agent.maxIterations || 0),
    toolWhitelist: Array.isArray(agent.toolWhitelist) ? agent.toolWhitelist : [],
    networkAllow: Array.isArray(agent.networkAllow) ? agent.networkAllow : [],
    mcpServerIds: Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : [],
    skillIds: Array.isArray(agent.skillIds) ? agent.skillIds : [],
    enabled: agent.enabled !== false,
    createdAt: agent.created_at || agent.createdAt || '',
    updatedAt: agent.updated_at || agent.updatedAt || '',
  }
}
