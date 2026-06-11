<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ChatMessageItem from './ChatMessageItem.vue'
import { hasVisibleMarkdownContent } from '@/services/utils/markdown'

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  showTimestamps: {
    type: Boolean,
    default: true,
  },
})

const viewport = ref(null)
const userScrolled = ref(false)
const visibleMessages = computed(() => props.messages.filter(isVisibleMessage))

let scrollTimeout = null

function handleScroll() {
  if (!viewport.value) return
  const { scrollTop, scrollHeight, clientHeight } = viewport.value
  const atBottom = scrollHeight - scrollTop - clientHeight < 50
  userScrolled.value = !atBottom
}

onBeforeUnmount(() => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
})

watch(
  () => visibleMessages.value.map((message) => `${message.id}:${String(message.content || '').length}`).join('|'),
  async () => {
    await nextTick()
    if (viewport.value && !userScrolled.value) {
      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        viewport.value.scrollTop = viewport.value.scrollHeight
      }, 50)
    }
  },
)

function isVisibleMessage(message) {
  if (message.role !== 'assistant') {
    return true
  }
  return Boolean(
    hasVisibleMarkdownContent(message.content) ||
    message.error ||
    message.metadata?.toolCallId ||
    message.metadata?.usage,
  )
}
</script>

<template>
  <div ref="viewport" class="scrollbar-thin h-full overflow-y-auto" @scroll="handleScroll">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-2 px-5 py-4">
      <ChatMessageItem
        v-for="message in visibleMessages"
        :key="message.id"
        :message="message"
        :show-timestamps="showTimestamps"
      />
    </div>
  </div>
</template>
