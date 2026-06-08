<script setup>
import { computed } from 'vue'

const props = defineProps({
  tone: {
    type: String,
    default: 'default',
  },
})

const toneMap = {
  default: 'border-[color:var(--qq-border)] bg-[rgba(255,255,255,0.08)] text-[color:var(--qq-text-secondary)]',
  accent: 'border-transparent bg-[rgba(54,220,200,0.18)] text-[color:var(--qq-text-primary)]',
  pink: 'border-transparent bg-[rgba(243,138,213,0.22)] text-[color:var(--qq-text-primary)]',
  warning: 'border-transparent bg-[rgba(255,217,104,0.24)] text-[#31402d]',
  success: 'border-transparent bg-[rgba(19,192,142,0.22)] text-[color:var(--qq-text-primary)]',
}

const classes = computed(() => toneMap[props.tone] || toneMap.default)
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-1 text-xs font-medium" :class="classes">
    <slot />
  </span>
</template>
