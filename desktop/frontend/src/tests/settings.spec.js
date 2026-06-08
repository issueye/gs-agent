import { describe, expect, it } from 'vitest'
import { defaultSettings, mergeSettings } from '@/services/settings/schema'

describe('settings schema helpers', () => {
  it('provides desktop defaults', () => {
    expect(defaultSettings()).toEqual({
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
    })
  })

  it('merges partial values over defaults', () => {
    expect(
      mergeSettings({
        gateway: { defaultAgentId: 'agent_1' },
      }),
    ).toEqual({
      gateway: {
        baseUrl: 'http://127.0.0.1:18878',
        defaultAgentId: 'agent_1',
      },
      workspace: {
        rootDir: '',
      },
      projects: [],
      currentProjectId: '',
      ui: {
        showTimestamps: true,
      },
    })
  })

  it('migrates the old gateway default port', () => {
    expect(
      mergeSettings({
        gateway: { baseUrl: ' http://127.0.0.1:8080/ ' },
      }).gateway.baseUrl,
    ).toBe('http://127.0.0.1:18878')
  })

  it('normalizes projects and syncs the workspace root from the current project', () => {
    expect(
      mergeSettings({
        workspace: { rootDir: 'E:/workspace/legacy' },
        projects: [
          { id: ' project_1 ', name: ' Demo ', rootDir: ' E:/workspace/demo ' },
          { id: 'project_1', name: 'Duplicate', rootDir: 'E:/workspace/duplicate' },
          { id: 'project_2', name: '', rootDir: 'E:/workspace/invalid' },
        ],
        currentProjectId: ' project_1 ',
      }),
    ).toMatchObject({
      workspace: { rootDir: 'E:/workspace/demo' },
      projects: [{ id: 'project_1', name: 'Demo', rootDir: 'E:/workspace/demo' }],
      currentProjectId: 'project_1',
    })
  })

  it('keeps the legacy workspace root when the current project is missing', () => {
    expect(
      mergeSettings({
        workspace: { rootDir: 'E:/workspace/legacy' },
        projects: [{ id: 'project_1', name: 'Demo', rootDir: 'E:/workspace/demo' }],
        currentProjectId: 'missing',
      }),
    ).toMatchObject({
      workspace: { rootDir: 'E:/workspace/legacy' },
      currentProjectId: '',
    })
  })
})
