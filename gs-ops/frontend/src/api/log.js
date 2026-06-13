import { request } from '../utils/request'

export function fetchServiceLogs(id) {
  return request.get(`/services/${id}/logs`)
}

export function searchServiceLogs(id, query) {
  return request.get(`/services/${id}/logs`, {
    params: {
      q: query,
    },
  })
}

export function clearServiceLogs(id) {
  return request.delete(`/services/${id}/logs`)
}

export function fetchProcessLogs(id, params) {
  return request.get(`/services/${id}/process-logs`, {
    params: params || {},
  })
}
