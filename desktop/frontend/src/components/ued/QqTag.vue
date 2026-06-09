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
  warning: 'border-transparent bg-[rgba(217,119,6,0.14)] text-[#8a4b05]',
  success: 'border-transparent bg-[rgba(16,185,129,0.14)] text-[#047857]',
}

const classes = computed(() => toneMap[props.tone] || toneMap.default)
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-1 text-xs font-medium" :class="classes">
    <slot />
  </span>
</template>
