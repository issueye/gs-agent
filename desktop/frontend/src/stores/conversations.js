import { defineStore } from 'pinia'
import {
  createConversation,
  deleteConversation as deleteConversationRequest,
  listConversationMessages,
  listConversations,
} from '@/services/gateway/conversations'
import { hasVisibleMarkdownContent } from '@/services/utils/markdown'

export const useConversationsStore = defineStore('conversations', {
  state: () => ({
    items: [],
    loading: false,
    error: '',
    deletingId: '',
    messagesByConversationId: {},
    loadingMessagesByConversationId: {},
  }),

  getters: {
    byId: (state) => (conversationId) => state.items.find((item) => item.id === conversationId) || null,
    messagesFor: (state) => (conversationId) => state.messagesByConversationId[conversationId] || [],
    cachedMessageCount: (state) => Object.values(state.messagesByConversationId).reduce((total, messages) => total + messages.length, 0),
    hasLoadingMessages: (state) => Object.keys(state.loadingMessagesByConversationId).length > 0,
    localSearchDocuments: (state) => state.items.flatMap((conversation) => {
      const title = conversation.title || 'Untitled Conversation'
      const documents = [
        {
          id: `conversation:${conversation.id}:title`,
          type: 'conversation',
          conversationId: conversation.id,
          conversationTitle: title,
          text: title,
          updatedAt: conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || '',
        },
      ]

      for (const message of state.messagesByConversationId[conversation.id] || []) {
        if (!message?.content) {
          continue
        }
        documents.push({
          id: `message:${conversation.id}:${message.id}`,
          type: 'message',
          conversationId: conversation.id,
          conversationTitle: title,
          messageId: message.id,
          role: message.role || '',
          text: message.content,
          updatedAt: message.createdAt || conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt || '',
        })
      }

      return documents
    }),
  },

  actions: {
    async fetchConversations(baseUrl) {
      this.loading = true
      this.error = ''
      try {
        this.items = sortConversations(await listConversations(baseUrl))
        return this.items
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async createConversation(baseUrl, input) {
      const conversation = await createConversation(baseUrl, input)
      this.upsertConversation(conversation)
      this.messagesByConversationId[conversation.id] = []
      return conversation
    },

    async loadMessages(baseUrl, conversationId, options = {}) {
      if (!conversationId) {
        return []
      }
      if (!options.force && this.messagesByConversationId[conversationId]) {
        return this.messagesByConversationId[conversationId]
      }
      this.loadingMessagesByConversationId[conversationId] = true
      try {
        const messages = await listConversationMessages(baseUrl, conversationId)
        this.messagesByConversationId[conversationId] = messages
        return messages
      } finally {
        delete this.loadingMessagesByConversationId[conversationId]
      }
    },

    appendLocalUserMessage(conversationId, content) {
      this.ensureMessageBuffer(conversationId).push(buildLocalMessage('user', content))
      this.bumpConversation(conversationId)
    },

    startAssistantDraft(conversationId) {
      const draft = buildLocalMessage('assistant', '', { draft: true })
      this.ensureMessageBuffer(conversationId).push(draft)
      return draft.id
    },

    appendAssistantDelta(conversationId, delta) {
      if (!delta) {
        return
      }
      const messages = this.ensureMessageBuffer(conversationId)
      let draft = findTextAssistantDraft(messages)
      if (!draft) {
        draft = buildLocalMessage('assistant', '', { draft: true })
        messages.push(draft)
      }
      draft.content += delta
      this.bumpConversation(conversationId)
    },

    appendAssistantUpdate(conversationId, update) {
      if (isToolUpdate(update)) {
        this.upsertToolMessage(conversationId, update)
        return
      }

      const messages = this.ensureMessageBuffer(conversationId)
      if (update?.sessionUpdate === 'usage_update') {
        attachUsageToLastAssistant(messages, update.usage)
        this.bumpConversation(conversationId)
        return
      }

      const text = update?.content?.text || ''
      if (!text) {
        return
      }

      let draft = findTextAssistantDraft(messages)
      if (!draft) {
        draft = buildLocalMessage('assistant', '', { draft: true })
        messages.push(draft)
      }

      draft.content += text

      const metadata = draft.metadata || {}
      metadata.sessionUpdate = update?.sessionUpdate || ''
      if (update?.toolCallId) {
        metadata.toolCallId = update.toolCallId
      }
      if (update?.kind) {
        metadata.toolKind = update.kind
      }
      if (update?.status) {
        metadata.toolStatus = update.status
      }
      if (update?.usage) {
        metadata.usage = update.usage
      }
      draft.metadata = metadata
      this.bumpConversation(conversationId)
    },

    upsertToolMessage(conversationId, update) {
      const messages = this.ensureMessageBuffer(conversationId)
      removeEmptyAssistantDrafts(messages)
      const toolCallId = update?.toolCallId || update?.messageId || ''
      let message = toolCallId
        ? messages.find((item) => item.metadata?.toolCallId === toolCallId)
        : [...messages].reverse().find((item) => item.metadata?.sessionUpdate === 'tool_call' || item.metadata?.sessionUpdate === 'tool_call_update')

      if (!message) {
        message = buildLocalMessage('assistant', '', {
          draft: true,
          metadata: {
            toolCallId: toolCallId || `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          },
        })
        messages.push(message)
      }

      const metadata = {
        ...(message.metadata || {}),
        sessionUpdate: update?.sessionUpdate || '',
      }
      if (toolCallId) {
        metadata.toolCallId = toolCallId
      }
      if (update?.title) {
        metadata.toolTitle = update.title
      }
      if (update?.kind) {
        metadata.toolKind = update.kind
      }
      if (update?.status) {
        metadata.toolStatus = update.status
      }
      if (update?.locations?.length) {
        metadata.locations = update.locations
      }
      if (update?.rawInput !== null && update?.rawInput !== undefined) {
        metadata.rawInput = mergeToolPayload(metadata.rawInput, update.rawInput)
      }
      if (update?.rawOutput !== null && update?.rawOutput !== undefined) {
        metadata.rawOutput = update.rawOutput
      }

      message.metadata = metadata
      message.content = toolMessageContent(metadata)
      message.draft = !['completed', 'failed', 'cancelled'].includes(metadata.toolStatus)
      this.bumpConversation(conversationId)
    },

    markAssistantDraftComplete(conversationId) {
      const messages = this.ensureMessageBuffer(conversationId)
      removeEmptyAssistantMessages(messages)
      for (const draft of messages.filter((message) => message.role === 'assistant' && message.draft)) {
        draft.draft = false
      }
      removeEmptyAssistantMessages(messages)
    },

    bumpConversationRunning(conversationId, running = true) {
      const conversation = this.byId(conversationId)
      if (!conversation) {
        return
      }
      conversation.status = running ? 'running' : 'active'
      conversation.updatedAt = new Date().toISOString()
      conversation.lastMessageAt = conversation.updatedAt
      this.items = sortConversations(this.items)
    },

    markAssistantDraftError(conversationId, message) {
      const messages = this.ensureMessageBuffer(conversationId)
      const draft = [...messages].reverse().find((item) => item.role === 'assistant' && item.draft)
      if (draft) {
        draft.draft = false
        draft.error = true
        draft.content = errorContent(draft.content, message)
      } else {
        messages.push(buildLocalMessage('assistant', message, { error: true }))
      }
    },

    upsertConversation(conversation) {
      const index = this.items.findIndex((item) => item.id === conversation.id)
      if (index >= 0) {
        this.items[index] = {
          ...this.items[index],
          ...conversation,
        }
      } else {
        this.items.unshift(conversation)
      }
      this.items = sortConversations(this.items)
    },

    async deleteConversation(baseUrl, conversationId) {
      this.deletingId = conversationId
      this.error = ''
      try {
        await deleteConversationRequest(baseUrl, conversationId)
        this.items = this.items.filter((item) => item.id !== conversationId)
        delete this.messagesByConversationId[conversationId]
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.deletingId = ''
      }
    },

    bumpConversation(conversationId) {
      const conversation = this.byId(conversationId)
      if (!conversation) {
        return
      }
      conversation.updatedAt = new Date().toISOString()
      conversation.lastMessageAt = conversation.updatedAt
      this.items = sortConversations(this.items)
    },

    ensureMessageBuffer(conversationId) {
      if (!this.messagesByConversationId[conversationId]) {
        this.messagesByConversationId[conversationId] = []
      }
      return this.messagesByConversationId[conversationId]
    },
  },
})

function buildLocalMessage(role, content, extra = {}) {
  return {
    id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    metadata: {},
    ...extra,
  }
}

function errorContent(existing, message) {
  const error = String(message || '请求异常中断').trim()
  const current = String(existing || '').trim()
  if (!current) {
    return error
  }
  if (current.includes(error)) {
    return current
  }
  return `${current}\n\n**错误：** ${error}`
}

function isToolUpdate(update) {
  return update?.sessionUpdate === 'tool_call' || update?.sessionUpdate === 'tool_call_update'
}

function findTextAssistantDraft(messages) {
  const message = messages.at(-1)
  if (
    message?.role === 'assistant' &&
    message.draft &&
    !message.metadata?.toolCallId
  ) {
    return message
  }
  return null
}

function isEmptyAssistantDraft(message) {
  return isEmptyAssistantMessage(message) && message.draft
}

function isEmptyAssistantMessage(message) {
  return Boolean(
    message?.role === 'assistant' &&
    !hasVisibleMarkdownContent(message.content) &&
    !message.error &&
    !message.metadata?.toolCallId,
  )
}

function removeEmptyAssistantDrafts(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isEmptyAssistantDraft(messages[index])) {
      messages.splice(index, 1)
    }
  }
}

function removeEmptyAssistantMessages(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isEmptyAssistantMessage(messages[index])) {
      messages.splice(index, 1)
    }
  }
}

function attachUsageToLastAssistant(messages, usage) {
  if (!usage) {
    return
  }
  const target = [...messages].reverse().find((message) => (
    message.role === 'assistant' &&
    !message.metadata?.toolCallId &&
    hasVisibleMarkdownContent(message.content)
  ))
  if (!target) {
    return
  }
  target.metadata = {
    ...(target.metadata || {}),
    sessionUpdate: 'usage_update',
    usage,
  }
}

function mergeToolPayload(previous, next) {
  if (previous === null || previous === undefined || previous === '') {
    return next
  }
  if (typeof previous === 'string' && typeof next === 'string') {
    return `${previous}${next}`
  }
  return next
}

function toolMessageContent(metadata = {}) {
  const lines = []
  lines.push(`**${metadata.toolTitle || metadata.toolKind || '工具调用'}**`)
  if (metadata.toolStatus) {
    lines.push(`状态：${metadata.toolStatus}`)
  }
  if (metadata.rawInput !== null && metadata.rawInput !== undefined && metadata.rawInput !== '') {
    lines.push(`输入：\`${formatToolPayload(metadata.rawInput)}\``)
  }
  if (metadata.rawOutput !== null && metadata.rawOutput !== undefined && metadata.rawOutput !== '') {
    lines.push(`输出：\`${formatToolPayload(metadata.rawOutput)}\``)
  }
  return lines.join('\n\n')
}

function formatToolPayload(value) {
  if (typeof value === 'string') {
    return value.length > 240 ? `${value.slice(0, 240)}...` : value
  }
  try {
    const text = JSON.stringify(value)
    return text.length > 240 ? `${text.slice(0, 240)}...` : text
  } catch {
    return String(value)
  }
}

function sortConversations(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.lastMessageAt || left.updatedAt || left.createdAt || 0)
    const rightTime = Date.parse(right.lastMessageAt || right.updatedAt || right.createdAt || 0)
    return rightTime - leftTime
  })
}
