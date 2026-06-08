import { describe, expect, it } from 'vitest'
import { toWebSocketURL } from '@/services/gateway/http'
import { normalizeWSMessage } from '@/services/gateway/ws'

describe('gateway websocket helpers', () => {
  it('converts http urls to websocket urls', () => {
    expect(toWebSocketURL('http://127.0.0.1:18878')).toBe('ws://127.0.0.1:18878/ws/chat')
    expect(toWebSocketURL('https://gateway.example.com')).toBe('wss://gateway.example.com/ws/chat')
  })

  it('normalizes gateway frames into camelCase', () => {
    expect(
      normalizeWSMessage({
        type: 'session/update',
        conversation_id: 'conv_1',
        request_id: 'req_1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello' },
        },
      }),
    ).toEqual({
      type: 'session/update',
      conversationId: 'conv_1',
      sessionId: '',
      requestId: 'req_1',
      taskId: '',
      task: null,
      answer: '',
      result: null,
      event: null,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'hello', uri: '', mimeType: '', data: null },
        messageId: '',
        toolCallId: '',
        title: '',
        kind: '',
        status: '',
        locations: [],
        rawInput: null,
        rawOutput: null,
        usage: null,
      },
      stopReason: '',
      code: '',
      error: '',
      metadata: {},
    })
  })

  it('keeps native gs-gateway chat payloads', () => {
    expect(
      normalizeWSMessage({
        type: 'done',
        task: { id: 'task_1', result: { answer: 'hello' } },
        answer: 'hello',
      }),
    ).toMatchObject({
      type: 'done',
      taskId: 'task_1',
      task: { id: 'task_1', result: { answer: 'hello' } },
      answer: 'hello',
    })
  })
})
