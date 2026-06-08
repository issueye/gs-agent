import { fetchJSON } from './http'

export async function getGatewayHealth(baseUrl) {
  return fetchJSON(baseUrl, '/health')
}
