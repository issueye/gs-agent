<script setup>
defineProps({
  label: {
    type: String,
    default: '',
  },
  helper: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <label class="block">
    <div class="mb-3 flex items-center gap-2">
      <span class="text-sm font-medium text-[color:var(--qq-text-primary)]">{{ label }}</span>
      <span v-if="required" class="text-xs text-[var(--qq-accent-yellow)]">必填</span>
    </div>
    <slot />
    <p v-if="error" class="mt-2 text-xs text-[var(--qq-danger)]">{{ error }}</p>
    <p v-else-if="helper" class="mt-2 text-xs leading-6 text-[color:var(--qq-text-tertiary)]">{{ helper }}</p>
  </label>
</template>
