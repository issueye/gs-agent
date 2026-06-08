<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

function toggle() {
  if (props.disabled) {
    return
  }
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    class="group flex w-full items-center justify-between gap-3 rounded-[6px] border border-[color:var(--qq-border)] bg-[rgba(16,52,45,0.24)] px-3 py-2.5 text-left transition hover:border-[color:var(--qq-border-strong)] hover:bg-[rgba(20,65,56,0.36)] disabled:cursor-not-allowed disabled:opacity-55"
    :aria-checked="modelValue"
    :disabled="disabled"
    role="switch"
    type="button"
    @click="toggle"
  >
    <span class="min-w-0">
      <span v-if="label || $slots.default" class="block text-sm font-medium text-[color:var(--qq-text-primary)]">
        <slot>{{ label }}</slot>
      </span>
      <span v-if="description" class="mt-1 block text-xs leading-6 text-[color:var(--qq-text-tertiary)]">
        {{ description }}
      </span>
    </span>
    <span
      class="relative inline-flex h-6 w-11 shrink-0 rounded-full border transition"
      :class="
        modelValue
          ? 'border-transparent bg-[linear-gradient(135deg,var(--qq-accent),var(--qq-accent-strong))]'
          : 'border-[color:var(--qq-border)] bg-[rgba(255,255,255,0.10)]'
      "
    >
      <span
        class="absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition"
        :class="modelValue ? 'left-[22px]' : 'left-0.5'"
      />
    </span>
  </button>
</template>
