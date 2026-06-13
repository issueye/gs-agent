import { request } from '../utils/request'

export function fetchServices() {
  return request.get('/services')
}

export function fetchServiceTemplates() {
  return request.get('/service-templates')
}

export function fetchService(id) {
  return request.get(`/services/${id}`)
}

export function createService(payload) {
  return request.post('/services', payload)
}

export function runServiceAction(id, action) {
  if (action === 'uninstall') {
    return request.delete(`/services/${id}/uninstall`)
  }

  return request.get(`/actions/${action}/${id}`)
}

export function updateServiceConfig(id, config) {
  return request.put(`/services/${id}/config`, config)
}

export function fetchConfigBackups(id) {
  return request.get(`/services/${id}/config/backups`)
}

export function createConfigBackup(id) {
  return request.get(`/actions/backup-config/${id}`)
}

export function restoreConfigBackup(id, backupId) {
  return request.get(`/actions/restore-config/${id}/${backupId}`)
}

export function fetchVersions(id) {
  return request.get(`/services/${id}/versions`)
}

export function upgradeService(id, version) {
  return request.get(`/actions/upgrade/${id}`, {
    params: version ? { version } : {},
  })
}

export function rollbackService(id, version) {
  return request.get(`/actions/rollback/${id}`, {
    params: version ? { version } : {},
  })
}
