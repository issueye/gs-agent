import { defineStore } from 'pinia'
import { computed } from 'vue'
import { normalizeProject } from '@/services/settings/schema'
import { useSettingsStore } from './settings'

export const useProjectsStore = defineStore('projects', () => {
  const settingsStore = useSettingsStore()

  const items = computed(() => settingsStore.settings.projects || [])
  const currentProjectId = computed(() => settingsStore.settings.currentProjectId || '')
  const currentProject = computed(() => items.value.find((project) => project.id === currentProjectId.value) || null)
  const currentRootDir = computed(() => currentProject.value?.rootDir || settingsStore.settings.workspace.rootDir || '')
  const currentProjectContext = computed(() => buildProjectContext(currentProject.value))
  const currentProjectMetadata = computed(() => buildProjectChatMetadata(currentProject.value))

  async function createProject(payload) {
    const project = ensureUniqueId(normalizeProject({
      ...payload,
      id: payload?.id || createProjectId(),
    }), items.value)
    validateProject(project)

    const nextProjects = [...items.value, project]
    await saveProjects(nextProjects, project.id)
    return project
  }

  async function updateProject(projectId, payload) {
    const id = String(projectId || '').trim()
    const existing = items.value.find((project) => project.id === id)
    if (!existing) {
      throw new Error('项目不存在')
    }

    const updated = normalizeProject({
      ...existing,
      ...payload,
      id,
    })
    validateProject(updated)

    const nextProjects = items.value.map((project) => (project.id === id ? updated : project))
    await saveProjects(nextProjects, currentProjectId.value === id ? id : currentProjectId.value)
    return updated
  }

  async function deleteProject(projectId) {
    const id = String(projectId || '').trim()
    const nextProjects = items.value.filter((project) => project.id !== id)
    const nextCurrentProjectId = currentProjectId.value === id ? nextProjects[0]?.id || '' : currentProjectId.value
    await saveProjects(nextProjects, nextCurrentProjectId)
  }

  async function selectProject(projectId) {
    const id = String(projectId || '').trim()
    if (id && !items.value.some((project) => project.id === id)) {
      throw new Error('项目不存在')
    }
    await saveProjects(items.value, id)
  }

  async function saveProjects(projects, nextCurrentProjectId) {
    const current = projects.find((project) => project.id === nextCurrentProjectId)
    await settingsStore.patch({
      projects,
      currentProjectId: current?.id || '',
      workspace: {
        rootDir: current?.rootDir || settingsStore.settings.workspace.rootDir || '',
      },
    })
  }

  return {
    items,
    currentProjectId,
    currentProject,
    currentRootDir,
    currentProjectContext,
    currentProjectMetadata,
    createProject,
    updateProject,
    deleteProject,
    selectProject,
  }
})

export function createProjectId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `project_${globalThis.crypto.randomUUID()}`
  }
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildProjectContext(project) {
  const id = String(project?.id || '').trim()
  const name = String(project?.name || '').trim()
  const rootDir = String(project?.rootDir || '').trim()

  if (!id || !name || !rootDir) {
    return null
  }

  return { id, name, rootDir }
}

export function buildProjectChatMetadata(project) {
  const context = buildProjectContext(project)
  if (!context) {
    return {}
  }

  return {
    project_id: context.id,
    project_name: context.name,
    project_root: context.rootDir,
  }
}

function ensureUniqueId(project, projects) {
  if (!projects.some((item) => item.id === project.id)) {
    return project
  }

  return {
    ...project,
    id: createProjectId(),
  }
}

function validateProject(project) {
  if (!project.name) {
    throw new Error('请输入项目名称')
  }
  if (!project.rootDir) {
    throw new Error('请选择项目目录')
  }
}
