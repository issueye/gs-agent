export function defaultSettings() {
  return {
    gateway: {
      baseUrl: 'http://127.0.0.1:18878',
      defaultAgentId: '',
    },
    workspace: {
      rootDir: '',
    },
    projects: [],
    currentProjectId: '',
    ui: {
      showTimestamps: true,
    },
  }
}

export function mergeSettings(value = {}) {
  const fallback = defaultSettings()
  const gatewayValue = value.gateway || {}
  const rawBaseUrl = Object.prototype.hasOwnProperty.call(gatewayValue, 'baseUrl') ? gatewayValue.baseUrl : fallback.gateway.baseUrl
  const projects = normalizeProjects(value.projects || [])
  const currentProjectId = normalizeCurrentProjectId(value.currentProjectId, projects)
  const currentProject = projects.find((project) => project.id === currentProjectId)
  const workspace = {
    ...fallback.workspace,
    ...(value.workspace || {}),
  }

  if (currentProject) {
    workspace.rootDir = currentProject.rootDir
  }

  return {
    gateway: {
      ...fallback.gateway,
      ...gatewayValue,
      baseUrl: normalizeBaseUrl(rawBaseUrl),
      defaultAgentId: String(gatewayValue.defaultAgentId || '').trim(),
    },
    workspace,
    projects,
    currentProjectId,
    ui: {
      ...fallback.ui,
      ...(value.ui || {}),
    },
  }
}

export function normalizeProject(value = {}) {
  return {
    id: String(value.id || '').trim(),
    name: String(value.name || '').trim(),
    rootDir: String(value.rootDir || '').trim(),
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function normalizeProjects(projects) {
  const seen = new Set()

  return (Array.isArray(projects) ? projects : [])
    .map((project) => normalizeProject(project))
    .filter((project) => project.id && project.name && project.rootDir)
    .filter((project) => {
      if (seen.has(project.id)) {
        return false
      }
      seen.add(project.id)
      return true
    })
}

function normalizeCurrentProjectId(value, projects) {
  const id = String(value || '').trim()
  if (!id) {
    return ''
  }
  return projects.some((project) => project.id === id) ? id : ''
}
