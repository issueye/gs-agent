<script setup>
import { computed } from 'vue'
import { MessageSquareText, TextSearch } from 'lucide-vue-next'

const props = defineProps({
  results: {
    type: Array,
    default: () => [],
  },
  query: {
    type: String,
    default: '',
  },
})

const normalizedQuery = computed(() => String(props.query || '').trim())

function resultLabel(result) {
  return result.type === 'conversation' ? 'Title' : result.role || 'Message'
}

function formatTime(value) {
  if (!value) {
    return ''
  }
  return new Date(value).toLocaleString()
}

function highlightedParts(text) {
  const value = String(text || '')
  const term = normalizedQuery.value
  if (!term) {
    return [{ text: value, hit: false }]
  }

  const index = value.toLocaleLowerCase().indexOf(term.toLocaleLowerCase())
  if (index < 0) {
    return [{ text: value, hit: false }]
  }

  return [
    { text: value.slice(0, index), hit: false },
    { text: value.slice(index, index + term.length), hit: true },
    { text: value.slice(index + term.length), hit: false },
  ].filter((part) => part.text)
}
</script>

<template>
  <div class="scrollbar-thin min-h-0 overflow-y-auto border border-[color:var(--qq-border)] bg-white/62" style="border-radius: 6px;">
    <RouterLink
      v-for="result in results"
      :key="result.id"
      :to="`/chat/${result.conversationId}`"
      class="block border-b border-[var(--border-subtle)] px-4 py-4 transition last:border-b-0 hover:bg-[var(--hover-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      :data-testid="`search-result-${result.id}`"
    >
      <article class="flex gap-3">
        <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[color:var(--qq-border)] bg-white/80 text-[color:var(--qq-accent)]">
          <TextSearch v-if="result.type === 'conversation'" class="h-4 w-4" />
          <MessageSquareText v-else class="h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]">{{ resultLabel(result) }}</span>
            <h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ result.conversationTitle }}</h3>
            <time class="text-xs text-[color:var(--qq-text-tertiary)]">{{ formatTime(result.updatedAt) }}</time>
          </div>
          <p class="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--qq-text-secondary)]">
            <template v-for="(part, index) in highlightedParts(result.excerpt)" :key="`${result.id}-${index}`">
              <mark v-if="part.hit" class="rounded-[3px] bg-[var(--status-warning-bg)] px-0.5 text-[var(--color-warning)]">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </p>
        </div>
      </article>
    </RouterLink>
  </div>
</template>
