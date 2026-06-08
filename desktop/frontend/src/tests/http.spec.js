import { describe, expect, it, vi } from 'vitest'
import { GatewayError, fetchJSON } from '@/services/gateway/http'

describe('gateway http helpers', () => {
  it('wraps network failures with actionable gateway guidance', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchJSON('http://127.0.0.1:8080', '/health')).rejects.toMatchObject({
      name: 'GatewayError',
      code: 'gateway_unreachable',
      status: 0,
    })

    await expect(fetchJSON('http://127.0.0.1:8080', '/health')).rejects.toThrow(
      '无法连接到网关 http://127.0.0.1:8080。请手动启动网关，或确认该地址可以访问。',
    )

    vi.unstubAllGlobals()
  })

  it('keeps gateway response errors intact', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => JSON.stringify({ error: 'upstream failed', code: 'bad_gateway' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchJSON('http://127.0.0.1:8080', '/v1/agents')).rejects.toEqual(
      expect.objectContaining({
        name: 'GatewayError',
        status: 502,
        code: 'bad_gateway',
        message: 'upstream failed',
      }),
    )

    vi.unstubAllGlobals()
  })
})
