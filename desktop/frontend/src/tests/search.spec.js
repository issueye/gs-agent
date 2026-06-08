import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { searchConversationDocuments, useSearchStore } from '@/stores/search'
import { useConversationsStore } from '@/stores/conversations'

describe('local search', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('filters loaded conversation titles case-insensitively', () => {
    const results = searchConversationDocuments(
      [
        {
          id: 'conversation:c1:title',
          type: 'conversation',
          conversationId: 'c1',
          conversationTitle: 'Release Planning',
          text: 'Release Planning',
          updatedAt: '2026-05-19T08:00:00Z',
        },
        {
          id: 'conversation:c2:title',
          type: 'conversation',
          conversationId: 'c2',
          conversationTitle: 'Bug triage',
          text: 'Bug triage',
          updatedAt: '2026-05-19T09:00:00Z',
        },
      ],
      'release',
    )

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ conversationId: 'c1', type: 'conversation' })
  })

  it('filters cached messages case-insensitively through the store', () => {
    const conversationsStore = useConversationsStore()
    const searchStore = useSearchStore()

    conversationsStore.items = [
      { id: 'c1', title: 'Design notes', updatedAt: '2026-05-19T08:00:00Z' },
      { id: 'c2', title: 'Gateway setup', updatedAt: '2026-05-19T09:00:00Z' },
    ]
    conversationsStore.messagesByConversationId = {
      c1: [
        { id: 'm1', role: 'user', content: 'Please explain the Local Search MVP.', createdAt: '2026-05-19T08:10:00Z' },
      ],
      c2: [
        { id: 'm2', role: 'assistant', content: 'Gateway health is offline.', createdAt: '2026-05-19T09:10:00Z' },
      ],
    }

    searchStore.setQuery('local search')

    expect(searchStore.results).toHaveLength(1)
    expect(searchStore.results[0]).toMatchObject({ conversationId: 'c1', type: 'message', role: 'user' })
    expect(searchStore.summary).toEqual({ conversations: 2, cachedMessages: 2, searchableDocuments: 4 })
  })

  it('keeps empty queries empty', () => {
    const conversationsStore = useConversationsStore()
    const searchStore = useSearchStore()

    conversationsStore.items = [{ id: 'c1', title: 'Release Planning', updatedAt: '2026-05-19T08:00:00Z' }]
    searchStore.setQuery('   ')

    expect(searchStore.hasQuery).toBe(false)
    expect(searchStore.results).toEqual([])
  })
})
