<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
  },
  size: {
    type: String,
    default: 'md',
  },
  block: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const variantClassMap = {
  primary:
    'border-transparent bg-[color:var(--qq-accent)] text-white shadow-[0_10px_22px_rgba(0,136,255,0.18)] hover:bg-[color:var(--qq-accent-strong)]',
  secondary:
    'border-[color:var(--qq-border)] bg-white/80 text-[color:var(--qq-text-primary)] shadow-sm hover:bg-white',
  ghost:
    'border-transparent bg-transparent text-[color:var(--qq-text-secondary)] hover:bg-[rgba(15,23,42,0.06)] hover:text-[color:var(--qq-text-primary)]',
  danger:
    'border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700',
}

const sizeClassMap = {
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-9 rounded-lg px-4 text-sm',
  lg: 'h-10 rounded-lg px-5 text-base',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 border font-medium transition duration-150 ease-out',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
  'disabled:cursor-not-allowed disabled:opacity-55',
  variantClassMap[props.variant] || variantClassMap.primary,
  sizeClassMap[props.size] || sizeClassMap.md,
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button :class="classes" :disabled="disabled" type="button">
    <slot />
  </button>
</template>
