<script setup>
import { computed, ref } from 'vue'
import { SendHorizonal, Square } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  busy: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  projectContext: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'send', 'cancel'])
const canSubmit = computed(() => !props.disabled && props.modelValue.trim() && !props.busy)
const sending = ref(false)

function handleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canSubmit.value && !sending.value) {
      handleSend()
    }
  }
}

function handleSend() {
  if (!canSubmit.value || sending.value) return
  sending.value = true
  emit('send')
  setTimeout(() => {
    sending.value = false
  }, 300)
}
</script>

<template>
  <div class="border-t border-[color:var(--qq-border)] px-5 pb-5 pt-3">
    <div class="mx-auto max-w-4xl">
      <textarea
        :value="modelValue"
        data-testid="chat-composer-input"
        class="min-h-[76px] w-full resize-none border-b border-[color:var(--qq-border)] bg-transparent px-1 py-1.5 text-[15px] leading-7 text-[color:var(--qq-text-primary)] outline-none placeholder:text-[color:var(--qq-text-tertiary)] focus:border-[color:var(--qq-accent)]"
        placeholder="输入你的问题，回车发送，Shift + Enter 换行"
        @input="emit('update:modelValue', $event.target.value)"
        @keydown="handleKeydown"
      />
      <div class="mt-3 flex items-center justify-between gap-3">
        <p class="min-w-0 text-xs text-[color:var(--qq-text-tertiary)]">
          <span v-if="projectContext" class="block truncate">
            当前项目：{{ projectContext.name }} · {{ projectContext.rootDir }}
          </span>
          <span v-else>
            {{ busy ? '正在通过 WebSocket 接收增量响应' : '聊天标题将使用首条用户输入在本地生成' }}
          </span>
        </p>
        <div class="flex items-center gap-2">
          <QqButton
            v-if="busy"
            variant="ghost"
            @click="emit('cancel')"
          >
            <Square class="h-4 w-4 fill-current" />
            停止
          </QqButton>
          <QqButton
            :disabled="!canSubmit || sending"
            data-testid="chat-composer-send"
            @click="handleSend"
          >
            <SendHorizonal class="h-4 w-4" />
            发送
          </QqButton>
        </div>
      </div>
    </div>
  </div>
</template>
