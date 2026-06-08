<script setup>
const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  options: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])

function toggle(value) {
  const next = new Set(Array.isArray(props.modelValue) ? props.modelValue : [])
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  emit('update:modelValue', [...next])
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <label
      v-for="option in options"
      :key="option.value"
      class="qq-option-card flex cursor-pointer items-start gap-3 rounded-[6px] px-3 py-3"
      :class="{ 'is-active': modelValue.includes(option.value) }"
    >
      <input class="sr-only" :checked="modelValue.includes(option.value)" type="checkbox" @change="toggle(option.value)" />
      <span
        class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border text-[11px] font-semibold"
        :class="
          modelValue.includes(option.value)
            ? 'border-transparent bg-[var(--qq-accent-pink)] text-slate-950'
            : 'border-[color:var(--qq-border-strong)] bg-[rgba(255,255,255,0.08)] text-transparent'
        "
      >
        ✓
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-medium text-[color:var(--qq-text-primary)]">{{ option.label }}</span>
        <span v-if="option.description" class="mt-1 block text-xs leading-6 text-[color:var(--qq-text-tertiary)]">
          {{ option.description }}
        </span>
      </span>
    </label>
  </div>
</template>
