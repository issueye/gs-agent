import { request } from '../utils/request'

export function fetchServiceMetrics(id) {
  return request.get(`/services/${id}/metrics`)
}

