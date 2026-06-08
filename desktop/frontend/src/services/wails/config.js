import { ConfigService, SystemService } from '../../../bindings/icoo_claw/desktop'
import { mergeSettings } from '@/services/settings/schema'

const browserStorageKey = 'icoo-claw.desktop.settings'

export async function loadDesktopSettings() {
  try {
    return await ConfigService.LoadSettings()
  } catch {
    const settings = readBrowserSettings()
    return {
      path: 'browser://localStorage/icoo-claw.desktop.settings',
      settings,
    }
  }
}

export async function saveDesktopSettings(settings) {
  const normalized = mergeSettings(settings)
  try {
    return await ConfigService.SaveSettings(normalized)
  } catch {
    writeBrowserSettings(normalized)
    return {
      path: 'browser://localStorage/icoo-claw.desktop.settings',
      settings: normalized,
    }
  }
}

export async function getAppInfo() {
  try {
    return await SystemService.GetAppInfo()
  } catch {
    return {
      name: 'Icoo Claw',
      version: 'browser-preview',
      goVersion: 'n/a',
      os: navigator.platform || 'browser',
      arch: 'n/a',
      userConfigDir: 'localStorage',
    }
  }
}

function readBrowserSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return mergeSettings()
  }

  try {
    const raw = window.localStorage.getItem(browserStorageKey)
    return mergeSettings(raw ? JSON.parse(raw) : {})
  } catch {
    return mergeSettings()
  }
}

function writeBrowserSettings(settings) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(browserStorageKey, JSON.stringify(settings))
}
