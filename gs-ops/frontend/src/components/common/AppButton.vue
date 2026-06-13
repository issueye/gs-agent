<template>
  <button
    :class="[
      'focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
      variants[variant],
    ]"
    :disabled="disabled"
    :type="type"
  >
    <component :is="icon" v-if="icon" class="h-4 w-4" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup>
defineProps({
  disabled: Boolean,
  icon: {
    type: [Object, Function],
    default: null,
  },
  type: {
    type: String,
    default: 'button',
  },
  variant: {
    type: String,
    default: 'primary',
  },
})

const variants = {
  primary: 'bg-accent text-white hover:bg-blue-700',
  neutral: 'border border-line bg-white text-ink hover:bg-slate-50',
  danger: 'bg-danger text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
}
</script>

