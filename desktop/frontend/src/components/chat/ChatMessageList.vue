<script setup>
import { computed, nextTick, ref, watch } from 'vue'
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
const visibleMessages = computed(() => props.messages.filter(isVisibleMessage))

watch(
  () => visibleMessages.value.map((message) => `${message.id}:${String(message.content || '').length}`).join('|'),
  async () => {
    await nextTick()
    if (viewport.value) {
      viewport.value.scrollTop = viewport.value.scrollHeight
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
  <div ref="viewport" class="scrollbar-thin h-full overflow-y-auto">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-6">
      <ChatMessageItem
        v-for="message in visibleMessages"
        :key="message.id"
        :message="message"
        :show-timestamps="showTimestamps"
      />
    </div>
  </div>
</template>
