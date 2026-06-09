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
    class="group flex w-full items-center justify-between gap-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
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
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors duration-150 ease-out"
      :class="
        modelValue
          ? 'border-transparent bg-[color:var(--qq-accent)]'
          : 'border-[color:var(--qq-border-strong)] bg-white'
      "
    >
      <span
        class="h-[18px] w-[18px] rounded-full bg-white shadow-[0_2px_7px_rgba(15,23,42,0.24)] transition-transform duration-150 ease-out"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
      />
    </span>
  </button>
</template>
