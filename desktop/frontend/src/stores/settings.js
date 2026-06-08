import { defineStore } from 'pinia'
import { defaultSettings, mergeSettings } from '@/services/settings/schema'
import { loadDesktopSettings, saveDesktopSettings } from '@/services/wails/config'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    loaded: false,
    saving: false,
    error: '',
    path: '',
    settings: defaultSettings(),
  }),

  actions: {
    async load() {
      this.error = ''
      const payload = await loadDesktopSettings()
      this.path = payload.path
      this.settings = mergeSettings(payload.settings)
      this.loaded = true
      return this.settings
    },

    async save(nextSettings) {
      this.saving = true
      this.error = ''
      try {
        const payload = await saveDesktopSettings(mergeSettings(nextSettings))
        this.path = payload.path
        this.settings = mergeSettings(payload.settings)
        this.loaded = true
        return this.settings
      } catch (error) {
        this.error = formatError(error)
        throw error
      } finally {
        this.saving = false
      }
    },

    async patch(partial) {
      const nextSettings = mergeSettings({
        ...this.settings,
        ...partial,
        gateway: {
          ...this.settings.gateway,
          ...(partial.gateway || {}),
        },
        workspace: {
          ...this.settings.workspace,
          ...(partial.workspace || {}),
        },
        ui: {
          ...this.settings.ui,
          ...(partial.ui || {}),
        },
        projects: partial.projects || this.settings.projects,
        currentProjectId: Object.prototype.hasOwnProperty.call(partial, 'currentProjectId') ? partial.currentProjectId : this.settings.currentProjectId,
      })
      return this.save(nextSettings)
    },
  },
})

function formatError(error) {
  return error?.message || String(error)
}
