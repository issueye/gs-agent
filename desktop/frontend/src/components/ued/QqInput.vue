<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  type: {
    type: String,
    default: 'text',
  },
  placeholder: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const classes = computed(() => [
  'qq-field-control px-3 text-sm',
  props.invalid ? 'border-[color:rgba(255,141,141,0.9)] focus-visible:ring-[rgba(255,141,141,0.18)]' : '',
])

function handleInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div class="relative">
    <div
      v-if="$slots.prefix"
      class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[color:var(--qq-text-tertiary)]"
    >
      <slot name="prefix" />
    </div>
    <input
      :class="[classes, $slots.prefix ? 'pl-9' : '']"
      :disabled="disabled"
      :placeholder="placeholder"
      :type="type"
      :value="modelValue"
      @input="handleInput"
    />
  </div>
</template>
