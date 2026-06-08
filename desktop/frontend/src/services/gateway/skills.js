import { fetchJSON } from './http'

export async function listSkills(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/skills')
  return (Array.isArray(payload) ? payload : payload?.skills || []).map(normalizeSkill)
}

export async function createSkill(baseUrl, input) {
  const payload = await fetchJSON(baseUrl, '/api/skills', {
    method: 'POST',
    body: skillPayload(input, { includeId: true }),
  })
  return normalizeSkill(payload)
}

export async function updateSkill(baseUrl, skillId, input) {
  const payload = await fetchJSON(baseUrl, `/api/skills/${encodeURIComponent(skillId)}`, {
    method: 'PUT',
    body: skillPayload(input),
  })
  return normalizeSkill(payload)
}

export async function deleteSkill(baseUrl, skillId) {
  await fetchJSON(baseUrl, `/api/skills/${encodeURIComponent(skillId)}`, {
    method: 'DELETE',
  })
}

function skillPayload(input, options = {}) {
  const body = {
    name: input.name || '',
    description: input.description || '',
    path: input.path || input.name || '',
    content: input.content || '',
    version: input.version || '',
    source: input.source || '',
    metadata: input.metadata || {},
    files: normalizeFiles(input.files),
  }
  if (options.includeId) {
    body.id = input.id || ''
  }
  return body
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) {
    return []
  }
  return files
    .map((file) => ({
      path: String(file?.path || '').trim(),
      content: String(file?.content || ''),
    }))
    .filter((file) => file.path)
}

function normalizeSkill(skill) {
  return {
    id: skill.id || skill.name || skill.path,
    name: skill.name || skill.id || skill.path,
    description: skill.description || '',
    path: skill.path || skill.name || '',
    version: skill.version,
    status: skill.status || (skill.enabled === false ? 'inactive' : 'active'),
    source: skill.source || '',
    metadata: skill.metadata || {},
    createdAt: skill.created_at,
    updatedAt: skill.updated_at,
  }
}
