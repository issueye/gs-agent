import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import router from '@/router'
import { GatewayChatSocket } from '@/services/gateway/ws'
import { buildConversationTitle } from '@/services/utils/title'
import { useAgentsStore } from './agents'
import { useConversationsStore } from './conversations'
import { useProjectsStore } from './projects'
import { useSettingsStore } from './settings'

const socketsByConversationId = new Map()

export const useChatStore = defineStore('chat', {
  state: () => ({
    error: '',
    lastSessionId: '',
    streamsByConversationId: {},
    composerDraftsByConversationId: {},
  }),

  getters: {
    streaming: (state) => Object.keys(state.streamsByConversationId).length > 0,
    anyStreaming: (state) => Object.keys(state.streamsByConversationId).length > 0,
    runningConversationIds: (state) => Object.keys(state.streamsByConversationId),
    activeConversationId: (state) => Object.keys(state.streamsByConversationId)[0] || '',
    activeRequestId: (state) => {
      const conversationId = Object.keys(state.streamsByConversationId)[0] || ''
      return state.streamsByConversationId[conversationId]?.requestId || ''
    },
    sessionId: (state) => state.lastSessionId,
    socketState: (state) => {
      const streams = Object.values(state.streamsByConversationId)
      if (streams.length === 0) {
        return 'idle'
      }
      if (streams.some((stream) => stream.socketState === 'connecting')) {
        return 'connecting'
      }
      if (streams.some((stream) => stream.socketState === 'open')) {
        return 'open'
      }
      return streams[0]?.socketState || 'idle'
    },
    socketStateFor: (state) => (conversationId) => state.streamsByConversationId[conversationId]?.socketState || 'idle',
    isStreaming: (state) => (conversationId) => Boolean(state.streamsByConversationId[conversationId]),
    composerDraftFor: (state) => (conversationId) => state.composerDraftsByConversationId[conversationId] || '',
  },

  actions: {
    async sendPrompt(prompt, conversationId = '', options = {}) {
      const content = String(prompt || '').trim()
      if (!content) {
        return
      }

      const settingsStore = useSettingsStore()
      const agentsStore = useAgentsStore()
      const conversationsStore = useConversationsStore()
      const projectsStore = useProjectsStore()
      const baseUrl = settingsStore.settings.gateway.baseUrl
      const metadata = projectsStore.currentProjectMetadata

      const requestedAgentId = String(options.agentId || settingsStore.settings.gateway.defaultAgentId || '').trim()
      if (!conversationId && !agentsStore.items.some((item) => item.id === requestedAgentId)) {
        await agentsStore.fetchAgents(baseUrl)
      }

      const agentId = String(options.agentId || settingsStore.settings.gateway.defaultAgentId || agentsStore.items[0]?.id || '').trim()
      if (!conversationId && !agentId) {
        throw new Error('当前网关没有可用 Agent，请先在网关中创建 Agent 后再发起对话')
      }

      this.error = ''
      let targetConversationId = conversationId

      if (!targetConversationId) {
        const conversation = await conversationsStore.createConversation(baseUrl, {
          agentId,
          title: buildConversationTitle(content),
        })
        targetConversationId = conversation.id
        await router.push({ name: 'chat-conversation', params: { id: targetConversationId } })
      }

      if (this.isStreaming(targetConversationId)) {
        return
      }

      conversationsStore.appendLocalUserMessage(targetConversationId, content)
      conversationsStore.startAssistantDraft(targetConversationId)
      conversationsStore.bumpConversationRunning(targetConversationId, true)

      const requestId = buildRequestID()
      this.setStream(targetConversationId, {
        requestId,
        socketState: 'connecting',
        baseUrl,
        sessionId: '',
      })
      try {
        const socket = this.createSocket(baseUrl, targetConversationId)
        await socket.startChat({
          conversationId: targetConversationId,
          prompt: content,
          requestId,
          metadata,
        })
      } catch (error) {
        this.cleanupStream(targetConversationId)
        this.error = error?.message || String(error)
        conversationsStore.markAssistantDraftError(targetConversationId, this.error)
        throw error
      }
    },

    async cancelStream(conversationId = '') {
      const targetConversationId = conversationId || this.activeConversationId
      const stream = this.streamsByConversationId[targetConversationId]
      const socket = socketsByConversationId.get(targetConversationId)
      if (!stream || !socket) {
        return
      }
      socket.cancelChat({
        conversationId: targetConversationId,
        requestId: stream.requestId,
      })
    },

    setComposerDraft(conversationId, value) {
      if (!conversationId) {
        return
      }
      this.composerDraftsByConversationId = {
        ...this.composerDraftsByConversationId,
        [conversationId]: value,
      }
    },

    clearComposerDraft(conversationId) {
      if (!conversationId || !this.composerDraftsByConversationId[conversationId]) {
        return
      }
      const next = { ...this.composerDraftsByConversationId }
      delete next[conversationId]
      this.composerDraftsByConversationId = next
    },

    createSocket(baseUrl, conversationId) {
      socketsByConversationId.get(conversationId)?.close()
      const socket = markRaw(new GatewayChatSocket(baseUrl, {
        onStateChange: (state) => {
          this.setStreamSocketState(conversationId, state)
          if (state === 'closed' && this.streamsByConversationId[conversationId]) {
            this.failStream(conversationId, '网关连接已关闭')
          }
        },
        onMessage: (message) => {
          void this.handleSocketMessage(message, conversationId)
        },
        onError: (error) => {
          this.error = error?.message || String(error)
        },
      }))
      socketsByConversationId.set(conversationId, socket)
      return socket
    },

    async handleSocketMessage(message, fallbackConversationId = '') {
      const conversationsStore = useConversationsStore()
      const settingsStore = useSettingsStore()
      const conversationId = message.conversationId || fallbackConversationId

      switch (message.type) {
        case 'session/accepted':
          if (message.sessionId) {
            this.lastSessionId = message.sessionId
            this.updateStream(conversationId, { sessionId: message.sessionId })
          }
          break
        case 'session/update':
          this.applySessionUpdate(conversationId, message.update)
          break
        case 'session/completed':
          conversationsStore.markAssistantDraftComplete(conversationId)
          conversationsStore.bumpConversationRunning(conversationId, false)
          this.error = ''
          if (message.sessionId) {
            this.lastSessionId = message.sessionId
            this.updateStream(conversationId, { sessionId: message.sessionId })
          }
          this.cleanupStream(conversationId)
          break
        case 'session/error':
          this.error = message.error || 'chat request failed'
          conversationsStore.markAssistantDraftError(conversationId, this.error)
          conversationsStore.bumpConversationRunning(conversationId, false)
          this.cleanupStream(conversationId)
          break
        case 'connected':
          this.setStreamSocketState(conversationId, 'open')
          break
        case 'task_created':
          if (message.task?.id) {
            this.lastSessionId = message.task.id
            this.updateStream(conversationId, { sessionId: message.task.id })
            conversationsStore.appendAssistantUpdate(conversationId, {
              sessionUpdate: 'tool_call',
              toolCallId: message.task.id,
              title: '网关任务',
              kind: 'agent.im',
              status: 'running',
              rawInput: message.task.payload?.input?.text || '',
            })
          }
          break
        case 'agent_event':
          this.applyGatewayAgentEvent(conversationId, message)
          break
        case 'agent_result':
          if (message.result?.answer && !conversationHasAssistantText(conversationsStore.messagesFor(conversationId), message.result.answer)) {
            conversationsStore.appendAssistantDelta(conversationId, message.result.answer)
          }
          break
        case 'done':
          if (message.answer) {
            if (!conversationHasAssistantText(conversationsStore.messagesFor(conversationId), message.answer)) {
              conversationsStore.appendAssistantDelta(conversationId, message.answer)
            }
          }
          conversationsStore.upsertToolMessage(conversationId, {
            sessionUpdate: 'tool_call_update',
            toolCallId: message.task?.id || this.streamsByConversationId[conversationId]?.sessionId || '',
            title: '网关任务',
            kind: message.task?.kind || 'agent.im',
            status: 'completed',
            rawOutput: message.task?.result || message.answer || '',
          })
          conversationsStore.markAssistantDraftComplete(conversationId)
          conversationsStore.bumpConversationRunning(conversationId, false)
          this.error = ''
          this.cleanupStream(conversationId)
          void conversationsStore.fetchConversations(settingsStore.settings.gateway.baseUrl).catch(() => {})
          break
        case 'error':
          this.error = message.error || 'chat request failed'
          conversationsStore.markAssistantDraftError(conversationId, this.error)
          conversationsStore.bumpConversationRunning(conversationId, false)
          this.cleanupStream(conversationId)
          break
        default:
          break
      }
    },

    applySessionUpdate(conversationId, update = {}) {
      const conversationsStore = useConversationsStore()
      if (!update) {
        return
      }
      conversationsStore.bumpConversationRunning(conversationId, true)
      conversationsStore.appendAssistantUpdate(conversationId, update)
    },

    applyGatewayAgentEvent(conversationId, message = {}) {
      const conversationsStore = useConversationsStore()
      const event = message.event || {}
      const kind = event.kind || 'event'
      const taskId = message.taskId || event.taskId || this.streamsByConversationId[conversationId]?.sessionId || ''
      if (kind === 'text_delta') {
        conversationsStore.appendAssistantDelta(conversationId, event.payload?.text || '')
        return
      }
      conversationsStore.upsertToolMessage(conversationId, {
        sessionUpdate: 'tool_call_update',
        toolCallId: taskId || `gateway_${Date.now().toString(36)}`,
        title: 'Agent 事件',
        kind,
        status: kind === 'failed' ? 'failed' : 'running',
        rawOutput: event.payload || event,
      })
    },

    setStream(conversationId, stream) {
      this.streamsByConversationId = {
        ...this.streamsByConversationId,
        [conversationId]: stream,
      }
    },

    updateStream(conversationId, patch) {
      const current = this.streamsByConversationId[conversationId]
      if (!current) {
        return
      }
      this.setStream(conversationId, {
        ...current,
        ...patch,
      })
    },

    setStreamSocketState(conversationId, socketState) {
      this.updateStream(conversationId, { socketState })
    },

    failStream(conversationId, message) {
      const conversationsStore = useConversationsStore()
      this.error = message
      conversationsStore.markAssistantDraftError(conversationId, message)
      this.cleanupStream(conversationId, false)
    },

    cleanupStream(conversationId, closeSocket = true) {
      if (!conversationId) {
        return
      }
      const next = { ...this.streamsByConversationId }
      delete next[conversationId]
      this.streamsByConversationId = next

      const socket = socketsByConversationId.get(conversationId)
      if (socket) {
        socketsByConversationId.delete(conversationId)
        if (closeSocket) {
          socket.close()
        }
      }
    },
  },
})

function buildRequestID() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function conversationHasAssistantText(messages, text) {
  const normalized = String(text || '').trim()
  if (!normalized) {
    return false
  }
  return messages.some((item) => item.role === 'assistant' && String(item.content || '').trim() === normalized)
}
