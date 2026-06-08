import { fetchJSON } from './http'

export async function listConversations(baseUrl) {
  const payload = await fetchJSON(baseUrl, '/api/im/conversations')
  return (Array.isArray(payload) ? payload : payload?.conversations || []).map(normalizeIMConversation)
}

export async function createConversation(baseUrl, input) {
  void baseUrl
  const timestamp = new Date().toISOString()
  return {
    id: input.id || `desktop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: '',
    agentId: input.agentId || 'gs-agent',
    userId: input.userId || 'desktop-user',
    title: input.title || 'New Conversation',
    status: 'active',
    lastMessageAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    localOnly: true,
  }
}

export async function listConversationMessages(baseUrl, conversationId) {
  void baseUrl
  void conversationId
  return []
}

export async function deleteConversation(baseUrl, conversationId) {
  void baseUrl
  void conversationId
}

export function normalizeConversation(conversation) {
  return {
    id: conversation.id,
    sessionId: conversation.session_id,
    agentId: conversation.agent_id,
    userId: conversation.user_id,
    title: conversation.title,
    status: conversation.status,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
  }
}

export function normalizeIMConversation(conversation) {
  return {
    id: conversation.id,
    sessionId: conversation.last_event_id || '',
    agentId: 'gs-agent',
    userId: conversation.sender_id || '',
    title: conversation.subject || conversation.chat_id || conversation.sender_id || 'Gateway Conversation',
    status: conversation.status || 'active',
    lastMessageAt: conversation.last_at || conversation.updated_at,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
  }
}

export function normalizeMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    contentBlocks: message.content_blocks || message.contentBlocks || [],
    toolCalls: message.tool_calls || message.toolCalls || [],
    metadata: message.metadata || {},
    createdAt: message.created_at,
  }
}

export function normalizeMessages(messages = []) {
  const out = []
  for (const message of messages) {
    const normalized = normalizeMessage(message)
    const toolCalls = normalized.toolCalls || []

    if (normalized.role === 'tool' && toolCalls.length > 0) {
      for (const call of toolCalls) {
        const previous = out.at(-1)
        const toolCallId = toolValue(call, 'ID', 'id') || previous?.metadata?.toolCallId || ''
        if (previous?.metadata?.toolCallId && previous.metadata.toolCallId === toolCallId) {
          previous.metadata = {
            ...previous.metadata,
            toolStatus: 'completed',
            rawOutput: toolValue(call, 'Result', 'result'),
          }
          previous.content = toolMessageContent(previous.metadata)
          previous.draft = false
        } else {
          out.push(buildToolMessage(normalized, call, {
            toolCallId,
            toolStatus: 'completed',
            rawOutput: toolValue(call, 'Result', 'result'),
          }))
        }
      }
      continue
    }

    if (normalized.role === 'assistant' && toolCalls.length > 0) {
      if (String(normalized.content || '').trim()) {
        out.push({ ...normalized, toolCalls: [] })
      }
      for (const call of toolCalls) {
        out.push(buildToolMessage(normalized, call, {
          toolStatus: toolValue(call, 'Result', 'result') ? 'completed' : 'pending',
          rawInput: toolValue(call, 'Arguments', 'arguments'),
          rawOutput: toolValue(call, 'Result', 'result'),
        }))
      }
      continue
    }

    out.push(normalized)
  }
  return out
}

function buildToolMessage(source, call, patch = {}) {
  const metadata = {
    ...(source.metadata || {}),
    sessionUpdate: 'tool_call',
    toolCallId: patch.toolCallId || toolValue(call, 'ID', 'id') || source.id,
    toolTitle: toolValue(call, 'Name', 'name') || '工具调用',
    toolKind: toolKind(toolValue(call, 'Name', 'name')),
    toolStatus: patch.toolStatus || 'pending',
  }
  if (patch.rawInput !== undefined && patch.rawInput !== null && patch.rawInput !== '') {
    metadata.rawInput = patch.rawInput
  }
  if (patch.rawOutput !== undefined && patch.rawOutput !== null && patch.rawOutput !== '') {
    metadata.rawOutput = patch.rawOutput
  }

  return {
    ...source,
    id: `${source.id || metadata.toolCallId}:tool:${metadata.toolCallId}`,
    role: 'tool',
    content: toolMessageContent(metadata),
    metadata,
    toolCalls: [],
    draft: metadata.toolStatus !== 'completed',
  }
}

function toolValue(call, upperKey, lowerKey) {
  if (!call || typeof call !== 'object') {
    return ''
  }
  return call[upperKey] ?? call[lowerKey] ?? ''
}

function toolKind(name) {
  const value = String(name || '').trim().toLowerCase()
  if (['read', 'list', 'view'].includes(value)) return 'read'
  if (['edit', 'write', 'patch'].includes(value)) return 'edit'
  if (['delete', 'remove'].includes(value)) return 'delete'
  if (['move', 'rename'].includes(value)) return 'move'
  if (['search', 'grep', 'find'].includes(value) || value.includes('search')) return 'search'
  if (['bash', 'shell', 'command', 'terminal', 'exec'].includes(value)) return 'execute'
  if (['fetch', 'http', 'web_fetch', 'web_search'].includes(value)) return 'fetch'
  return 'other'
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
