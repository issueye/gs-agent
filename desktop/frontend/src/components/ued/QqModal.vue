<script setup>
import { X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <button class="absolute inset-0 bg-[rgba(15,23,42,0.18)] backdrop-blur-[10px]" type="button" @click="close" />
      <div class="qq-panel-strong relative z-10 w-full max-w-xl rounded-2xl px-5 py-5 shadow-[0_30px_90px_rgba(15,23,42,0.20)]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ title }}</h3>
            <p v-if="description" class="mt-3 text-sm leading-7 text-[color:var(--qq-text-secondary)]">
              {{ description }}
            </p>
          </div>
          <button
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--qq-border)] bg-white/80 text-[color:var(--qq-text-secondary)] transition hover:bg-white hover:text-[color:var(--qq-text-primary)]"
            type="button"
            @click="close"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div class="mt-5">
          <slot />
        </div>

        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <slot name="footer">
            <QqButton variant="ghost" @click="close">取消</QqButton>
            <QqButton @click="confirm">确认</QqButton>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
