<script setup>
defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  name: {
    type: String,
    default: 'qq-radio-group',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <label
      v-for="option in options"
      :key="option.value"
      class="qq-option-card flex cursor-pointer items-start gap-3 rounded-[6px] px-3 py-3"
      :class="{ 'is-active': modelValue === option.value }"
    >
      <input
        class="sr-only"
        :checked="modelValue === option.value"
        :name="name"
        :value="option.value"
        type="radio"
        @change="emit('update:modelValue', option.value)"
      />
      <span
        class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
        :class="
          modelValue === option.value
            ? 'border-transparent bg-[var(--qq-accent)] text-slate-950'
            : 'border-[color:var(--qq-border-strong)] bg-[rgba(255,255,255,0.08)]'
        "
      >
        <span class="h-2 w-2 rounded-full bg-current" />
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
