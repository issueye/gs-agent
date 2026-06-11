<script setup>
import { computed } from 'vue'

const props = defineProps({
  tone: {
    type: String,
    default: 'default',
  },
})

const toneMap = {
  default: 'border-[color:var(--qq-border)] bg-white/70 text-[color:var(--qq-text-secondary)]',
  accent: 'border-transparent bg-[rgba(0,136,255,0.12)] text-[color:var(--qq-accent-strong)]',
  pink: 'border-transparent bg-[rgba(124,58,237,0.12)] text-[color:var(--qq-accent-pink)]',
  warning: 'border-transparent bg-[var(--status-warning-bg)] text-[var(--color-warning)]',
  success: 'border-transparent bg-[var(--status-success-bg)] text-[var(--color-success)]',
}

const classes = computed(() => toneMap[props.tone] || toneMap.default)
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-1 text-xs font-medium" :class="classes">
    <slot />
  </span>
</template>
