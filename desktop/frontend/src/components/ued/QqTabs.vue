<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  tabs: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="inline-flex flex-wrap gap-1.5 border-b border-[color:var(--qq-border)]">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="border-b-2 px-3 py-2 text-sm font-medium transition"
      :class="
        modelValue === tab.value
          ? 'border-[color:var(--qq-accent)] text-[color:var(--qq-text-primary)]'
          : 'border-transparent text-[color:var(--qq-text-secondary)] hover:text-[color:var(--qq-text-primary)]'
      "
      type="button"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
