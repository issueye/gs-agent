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
  <div class="qq-panel inline-flex flex-wrap gap-1.5 rounded-[6px] p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="rounded-[4px] px-3 py-2 text-sm font-medium transition"
      :class="
        modelValue === tab.value
          ? 'bg-[rgba(255,255,255,0.18)] text-[color:var(--qq-text-primary)] shadow-[0_10px_24px_rgba(8,30,25,0.12)]'
          : 'text-[color:var(--qq-text-secondary)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[color:var(--qq-text-primary)]'
      "
      type="button"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
