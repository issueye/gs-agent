import { defineStore } from 'pinia'
import { useConversationsStore } from './conversations'

export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
  }),

  getters: {
    normalizedQuery: (state) => normalizeTerm(state.query),
    hasQuery() {
      return this.normalizedQuery.length > 0
    },
    results() {
      return searchConversationDocuments(useConversationsStore().localSearchDocuments, this.query)
    },
    summary() {
      const conversationsStore = useConversationsStore()
      return {
        conversations: conversationsStore.items.length,
        cachedMessages: conversationsStore.cachedMessageCount,
        searchableDocuments: conversationsStore.localSearchDocuments.length,
      }
    },
  },

  actions: {
    setQuery(value) {
      this.query = String(value || '')
    },
    clearQuery() {
      this.query = ''
    },
  },
})

export function searchConversationDocuments(documents, query) {
  const term = normalizeTerm(query)
  if (!term) {
    return []
  }

  return (documents || [])
    .map((document) => scoreDocument(document, term))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || compareUpdatedAt(left.updatedAt, right.updatedAt))
}

function scoreDocument(document, term) {
  const text = String(document?.text || '')
  const normalizedText = normalizeTerm(text)
  const index = normalizedText.indexOf(term)
  if (index < 0) {
    return null
  }

  const titleHit = document.type === 'conversation'
  const wordBoundaryBonus = index === 0 || /\s/.test(normalizedText[index - 1] || '') ? 8 : 0
  const score = (titleHit ? 100 : 40) + wordBoundaryBonus - Math.min(index, 80) / 10

  return {
    ...document,
    score,
    excerpt: buildExcerpt(text, term),
  }
}

function buildExcerpt(text, term) {
  const lowerText = text.toLocaleLowerCase()
  const lowerTerm = term.toLocaleLowerCase()
  const index = lowerText.indexOf(lowerTerm)
  if (index < 0) {
    return trimText(text, 180)
  }

  const start = Math.max(0, index - 58)
  const end = Math.min(text.length, index + term.length + 96)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`
}

function trimText(text, maxLength) {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - 3)}...`
}

function compareUpdatedAt(left, right) {
  return Date.parse(right || 0) - Date.parse(left || 0)
}

function normalizeTerm(value) {
  return String(value || '').trim().toLocaleLowerCase()
}
