import { expect, test } from '@playwright/test'

const gatewayURL = process.env.GATEWAY_BASE_URL || 'http://127.0.0.1:8080'
const defaultAgentId = process.env.E2E_DEFAULT_AGENT_ID || 'agent_desktop_default'
const browserSettingsKey = 'icoo-claw.desktop.settings'

test.beforeEach(async ({ page, request, baseURL }) => {
  await expect
    .poll(async () => {
      try {
        const response = await request.get(`${gatewayURL}/health`, { timeout: 2_000 })
        if (!response.ok()) {
          return ''
        }
        const payload = await response.json()
        return payload.status || ''
      } catch {
        return ''
      }
    }, { timeout: 20_000 })
    .toBe('ok')

  const agentResponse = await request.get(`${gatewayURL}/v1/agents/${defaultAgentId}`)
  expect(agentResponse.ok(), `default test agent ${defaultAgentId} should exist`).toBe(true)

  await page.addInitScript(
    ({ baseURL, browserSettingsKey, defaultAgentId }) => {
      window.localStorage.clear()
      const origin = baseURL ? new URL(baseURL).origin : window.location.origin
      window.localStorage.setItem(
        browserSettingsKey,
        JSON.stringify({
          gateway: {
            baseUrl: origin,
            defaultAgentId,
          },
        }),
      )
    },
    { baseURL, browserSettingsKey, defaultAgentId },
  )
})

test('chat flow creates, streams, and deletes a conversation', async ({ page }) => {
  const prompt = `playwright smoke ${Date.now()}`

  await page.goto('/chat')

  const input = page.getByTestId('chat-composer-input')
  const send = page.getByTestId('chat-composer-send')
  await expect(input).toBeEditable()
  await input.fill(prompt)
  await expect(send).toBeEnabled()
  await send.click()

  await page.waitForURL(/\/chat\/conv_/)
  await expect(page.getByTestId('conversation-header-title')).toContainText(prompt)
  await expect(page.getByTestId('chat-message-user').filter({ hasText: prompt })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('chat-message-assistant').filter({ hasText: `fake agent response: ${prompt}` })).toBeVisible({ timeout: 20_000 })

  const conversationId = page.url().split('/chat/')[1]
  await page.getByTestId(`conversation-delete-${conversationId}`).click()

  await page.waitForURL(/\/chat$/)
  await expect(page.getByTestId('chat-composer-input')).toBeEditable()
})
