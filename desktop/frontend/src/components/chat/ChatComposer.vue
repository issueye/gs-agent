<script setup>
import { computed } from 'vue'
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

function handleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canSubmit.value) {
      emit('send')
    }
  }
}
</script>

<template>
  <div class="px-5 pb-5 pt-3">
    <div class="mx-auto max-w-4xl rounded-[24px] border border-[color:var(--qq-border-strong)] bg-white/95 p-3 shadow-[0_18px_46px_rgba(15,23,42,0.10),0_5px_16px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <textarea
        :value="modelValue"
        data-testid="chat-composer-input"
        class="min-h-[76px] w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-7 text-[color:var(--qq-text-primary)] outline-none placeholder:text-[color:var(--qq-text-tertiary)]"
        placeholder="输入你的问题，回车发送，Shift + Enter 换行"
        @input="emit('update:modelValue', $event.target.value)"
        @keydown="handleKeydown"
      />
      <div class="mt-2 flex items-center justify-between gap-3 border-t border-[color:var(--qq-border)] pt-3">
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
            :disabled="!canSubmit"
            data-testid="chat-composer-send"
            @click="emit('send')"
          >
            <SendHorizonal class="h-4 w-4" />
            发送
          </QqButton>
        </div>
      </div>
    </div>
  </div>
</template>
