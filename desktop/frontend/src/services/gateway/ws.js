import { toGatewayWebSocketURL } from './http'
import { normalizeSessionFrame } from './session-events'

export class GatewayChatSocket {
  constructor(baseUrl, handlers = {}) {
    this.baseUrl = baseUrl
    this.handlers = handlers
    this.socket = null
    this.connectPromise = null
  }

  setHandlers(handlers) {
    this.handlers = handlers
  }

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return
    }
    if (this.connectPromise) {
      return this.connectPromise
    }

    this.handlers.onStateChange?.('connecting')

    this.connectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(toGatewayWebSocketURL(this.baseUrl))
      let settled = false

      socket.addEventListener('open', () => {
        settled = true
        this.socket = socket
        this.handlers.onStateChange?.('open')
        resolve()
      })

      socket.addEventListener('message', (event) => {
        try {
          const raw = JSON.parse(event.data)
          this.handlers.onMessage?.(normalizeWSMessage(raw))
        } catch {
          this.handlers.onError?.(new Error('invalid websocket message'))
        }
      })

      socket.addEventListener('close', () => {
        this.socket = null
        this.connectPromise = null
        this.handlers.onStateChange?.('closed')
        if (!settled) {
          reject(new Error('chat socket closed before it became ready'))
        }
      })

      socket.addEventListener('error', () => {
        this.handlers.onError?.(new Error('gateway websocket error'))
        if (!settled) {
          reject(new Error('gateway websocket error'))
        }
      })
    })

    try {
      await this.connectPromise
    } finally {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        this.connectPromise = null
      }
    }
  }

  async startChat(input) {
    await this.connect()
    this.send({
      type: 'message',
      payload: {
        platform: 'desktop',
        adapter: 'wails',
        sender: input.metadata?.project?.name || input.metadata?.projectName || 'desktop-user',
        chat: input.conversationId || 'desktop-chat',
        messageId: input.requestId,
        text: input.prompt,
      },
    })
  }

  cancelChat(input) {
    this.send({
      type: 'ping',
      conversation_id: input.conversationId,
      request_id: input.requestId,
    })
  }

  ping() {
    this.send({ type: 'ping' })
  }

  close() {
    this.socket?.close()
    this.socket = null
    this.connectPromise = null
  }

  send(payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('chat socket is not connected')
    }
    this.socket.send(JSON.stringify(payload))
  }
}

export function normalizeWSMessage(raw = {}) {
  return normalizeSessionFrame(raw)
}
