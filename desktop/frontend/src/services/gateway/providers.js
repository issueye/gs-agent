import { fetchJSON } from './http'

export async function listProviders(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/providers')
  return (Array.isArray(payload) ? payload : payload?.providers || []).map(normalizeProvider)
}

export async function createProvider(baseUrl, input) {
  const payload = await fetchJSON(baseUrl, '/api/providers', {
    method: 'POST',
    body: providerPayload(input, { includeId: true }),
  })
  return normalizeProvider(payload)
}

export async function updateProvider(baseUrl, providerId, input) {
  const payload = await fetchJSON(baseUrl, `/api/providers/${encodeURIComponent(providerId)}`, {
    method: 'PATCH',
    body: providerPayload(input),
  })
  return normalizeProvider(payload)
}

export async function deleteProvider(baseUrl, providerId) {
  await fetchJSON(baseUrl, `/api/providers/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
  })
}

function providerPayload(input, options = {}) {
  const body = {
    name: input.name || '',
    type: input.type || 'openai',
    baseUrl: input.baseUrl || '',
    defaultModel: input.defaultModel || '',
    apiKey: input.apiKey || '',
    enabled: input.enabled !== false,
  }
  if (options.includeId) {
    body.id = input.id || ''
  }
  return body
}

function normalizeProvider(provider = {}) {
  return {
    id: provider.id,
    name: provider.name || provider.id,
    type: provider.type || 'openai',
    baseUrl: provider.baseUrl || '',
    defaultModel: provider.defaultModel || '',
    enabled: provider.enabled !== false,
    apiKeySet: Boolean(provider.apiKeySet),
    apiKeyPreview: provider.apiKeyPreview || '',
    createdAt: provider.created_at || provider.createdAt || '',
    updatedAt: provider.updated_at || provider.updatedAt || '',
  }
}
