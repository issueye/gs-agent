import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectsStore } from '@/stores/projects'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/services/wails/config', () => ({
  loadDesktopSettings: vi.fn(),
  saveDesktopSettings: vi.fn(async (settings) => ({
    path: 'test://settings',
    settings,
  })),
}))

describe('projects store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates a project and selects it', async () => {
    const settingsStore = useSettingsStore()
    const projectsStore = useProjectsStore()

    await projectsStore.createProject({ name: 'Demo', rootDir: 'E:/workspace/demo', id: 'project_demo' })

    expect(settingsStore.settings.projects).toEqual([{ id: 'project_demo', name: 'Demo', rootDir: 'E:/workspace/demo' }])
    expect(settingsStore.settings.currentProjectId).toBe('project_demo')
    expect(settingsStore.settings.workspace.rootDir).toBe('E:/workspace/demo')
  })

  it('updates, deletes, and falls back to no current project', async () => {
    const settingsStore = useSettingsStore()
    const projectsStore = useProjectsStore()
    settingsStore.settings = {
      ...settingsStore.settings,
      projects: [{ id: 'project_demo', name: 'Demo', rootDir: 'E:/workspace/demo' }],
      currentProjectId: 'project_demo',
      workspace: { rootDir: 'E:/workspace/demo' },
    }

    await projectsStore.updateProject('project_demo', { name: 'Renamed', rootDir: 'E:/workspace/renamed' })
    expect(settingsStore.settings.projects[0]).toEqual({ id: 'project_demo', name: 'Renamed', rootDir: 'E:/workspace/renamed' })
    expect(settingsStore.settings.workspace.rootDir).toBe('E:/workspace/renamed')

    await projectsStore.deleteProject('project_demo')
    expect(settingsStore.settings.projects).toEqual([])
    expect(settingsStore.settings.currentProjectId).toBe('')
    expect(settingsStore.settings.workspace.rootDir).toBe('E:/workspace/renamed')
  })
})
