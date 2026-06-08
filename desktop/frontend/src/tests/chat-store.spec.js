import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { useConversationsStore } from '@/stores/conversations'
import { normalizeMessages } from '@/services/gateway/conversations'

vi.mock('@/router', () => ({
  default: {
    push: vi.fn(),
  },
}))

vi.mock('@/services/wails/config', () => ({
  loadDesktopSettings: vi.fn(),
  saveDesktopSettings: vi.fn(),
}))

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('tracks running streams independently by conversation', () => {
    const chatStore = useChatStore()

    chatStore.setStream('conv_a', { requestId: 'req_a', socketState: 'open' })
    chatStore.setStream('conv_b', { requestId: 'req_b', socketState: 'connecting' })

    expect(chatStore.streaming).toBe(true)
    expect(chatStore.anyStreaming).toBe(true)
    expect(chatStore.runningConversationIds).toEqual(['conv_a', 'conv_b'])
    expect(chatStore.isStreaming('conv_a')).toBe(true)
    expect(chatStore.isStreaming('conv_b')).toBe(true)
    expect(chatStore.isStreaming('conv_c')).toBe(false)
    expect(chatStore.socketState).toBe('connecting')
    expect(chatStore.socketStateFor('conv_a')).toBe('open')

    chatStore.cleanupStream('conv_a')

    expect(chatStore.runningConversationIds).toEqual(['conv_b'])
    expect(chatStore.isStreaming('conv_a')).toBe(false)
    expect(chatStore.socketState).toBe('connecting')
  })

  it('keeps composer drafts per conversation', () => {
    const chatStore = useChatStore()

    chatStore.setComposerDraft('conv_a', 'hello a')
    chatStore.setComposerDraft('conv_b', 'hello b')

    expect(chatStore.composerDraftFor('conv_a')).toBe('hello a')
    expect(chatStore.composerDraftFor('conv_b')).toBe('hello b')

    chatStore.clearComposerDraft('conv_a')

    expect(chatStore.composerDraftFor('conv_a')).toBe('')
    expect(chatStore.composerDraftFor('conv_b')).toBe('hello b')
  })

  it('routes websocket deltas to the matching conversation draft', async () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [
      { id: 'conv_a', title: 'A' },
      { id: 'conv_b', title: 'B' },
    ]
    conversationsStore.startAssistantDraft('conv_a')
    conversationsStore.startAssistantDraft('conv_b')

    await chatStore.handleSocketMessage({ type: 'session/update', update: textUpdate('alpha') }, 'conv_a')
    await chatStore.handleSocketMessage({ type: 'session/update', update: textUpdate('beta') }, 'conv_b')

    expect(conversationsStore.messagesFor('conv_a').at(-1).content).toBe('alpha')
    expect(conversationsStore.messagesFor('conv_b').at(-1).content).toBe('beta')
  })

  it('tracks running conversation status from session events', async () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [{ id: 'conv_a', title: 'A', status: 'active' }]
    conversationsStore.startAssistantDraft('conv_a')

    chatStore.applySessionUpdate('conv_a', textUpdate('hello'))
    expect(conversationsStore.byId('conv_a').status).toBe('running')

    conversationsStore.markAssistantDraftComplete('conv_a')
    conversationsStore.bumpConversationRunning('conv_a', false)
    expect(conversationsStore.byId('conv_a').status).toBe('active')
  })

  it('shows websocket errors even after partial assistant output', async () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [{ id: 'conv_a', title: 'A', status: 'running' }]
    conversationsStore.startAssistantDraft('conv_a')

    await chatStore.handleSocketMessage({ type: 'session/update', update: textUpdate('partial') }, 'conv_a')
    await chatStore.handleSocketMessage({ type: 'session/error', error: 'agent stream closed before completion' }, 'conv_a')

    const draft = conversationsStore.messagesFor('conv_a').at(-1)
    expect(draft.error).toBe(true)
    expect(draft.draft).toBe(false)
    expect(draft.content).toContain('partial')
    expect(draft.content).toContain('agent stream closed before completion')
    expect(conversationsStore.byId('conv_a').status).toBe('active')
  })

  it('renders tool calls as separate messages instead of empty assistant drafts', () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [{ id: 'conv_a', title: 'A', status: 'active' }]
    conversationsStore.startAssistantDraft('conv_a')

    chatStore.applySessionUpdate('conv_a', {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool_1',
      title: 'list directory',
      kind: 'bash',
      status: 'in_progress',
      rawInput: { command: 'ls' },
    })
    chatStore.applySessionUpdate('conv_a', {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tool_1',
      status: 'completed',
      rawOutput: 'README.md',
    })

    const messages = conversationsStore.messagesFor('conv_a')
    expect(messages).toHaveLength(1)
    expect(messages[0].metadata.toolCallId).toBe('tool_1')
    expect(messages[0].metadata.toolStatus).toBe('completed')
    expect(messages[0].draft).toBe(false)
    expect(messages[0].content).toContain('list directory')
    expect(messages[0].content).toContain('README.md')
  })

  it('keeps assistant text after a tool call in display order', () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [{ id: 'conv_a', title: 'A', status: 'active' }]
    conversationsStore.startAssistantDraft('conv_a')

    chatStore.applySessionUpdate('conv_a', textUpdate('before tool'))
    chatStore.applySessionUpdate('conv_a', {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool_1',
      title: 'read file',
      kind: 'read',
      status: 'in_progress',
      rawInput: { file: 'README.md' },
    })
    chatStore.applySessionUpdate('conv_a', {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tool_1',
      status: 'completed',
      rawOutput: 'contents',
    })
    chatStore.applySessionUpdate('conv_a', textUpdate('after tool'))

    const messages = conversationsStore.messagesFor('conv_a')
    expect(messages.map((message) => message.metadata.toolCallId ? 'tool' : message.content)).toEqual([
      'before tool',
      'tool',
      'after tool',
    ])
  })

  it('normalizes persisted tool calls into visible tool messages', () => {
    const messages = normalizeMessages([
      {
        id: 'msg_user',
        role: 'user',
        content: 'read file',
        created_at: '2026-05-26T00:00:00Z',
      },
      {
        id: 'msg_call',
        role: 'assistant',
        content: '',
        tool_calls: [{ ID: 'tool_1', Name: 'read', Arguments: { file: 'README.md' } }],
        created_at: '2026-05-26T00:00:01Z',
      },
      {
        id: 'msg_result',
        role: 'tool',
        content: '',
        tool_calls: [{ ID: 'tool_1', Name: 'read', Result: 'contents' }],
        created_at: '2026-05-26T00:00:02Z',
      },
      {
        id: 'msg_final',
        role: 'assistant',
        content: 'done',
        created_at: '2026-05-26T00:00:03Z',
      },
    ])

    expect(messages).toHaveLength(3)
    expect(messages[1].role).toBe('tool')
    expect(messages[1].metadata.toolCallId).toBe('tool_1')
    expect(messages[1].metadata.toolStatus).toBe('completed')
    expect(messages[1].content).toContain('README.md')
    expect(messages[1].content).toContain('contents')
    expect(messages[2].content).toBe('done')
  })

  it('does not create empty assistant messages for usage-only updates', () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [{ id: 'conv_a', title: 'A', status: 'active' }]
    conversationsStore.startAssistantDraft('conv_a')

    chatStore.applySessionUpdate('conv_a', {
      sessionUpdate: 'usage_update',
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    })
    conversationsStore.markAssistantDraftComplete('conv_a')

    expect(conversationsStore.messagesFor('conv_a')).toHaveLength(0)
  })

  it('removes invisible assistant placeholders when a stream completes', () => {
    const chatStore = useChatStore()
    const conversationsStore = useConversationsStore()

    conversationsStore.items = [{ id: 'conv_a', title: 'A', status: 'active' }]
    conversationsStore.startAssistantDraft('conv_a')

    chatStore.applySessionUpdate('conv_a', textUpdate('\u001b[32m\u001b[0m\u200b'))
    conversationsStore.markAssistantDraftComplete('conv_a')

    expect(conversationsStore.messagesFor('conv_a')).toHaveLength(0)
  })
})

function textUpdate(text) {
  return {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  }
}
