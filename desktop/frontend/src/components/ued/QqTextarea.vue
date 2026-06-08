<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  rows: {
    type: Number,
    default: 4,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  resize: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const classes = computed(() => [
  'qq-field-control px-3 py-2.5 text-sm leading-6',
  props.resize ? 'resize-y' : 'resize-none',
  props.invalid ? 'border-[color:rgba(255,141,141,0.9)]' : '',
])

function handleInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <textarea
    :class="classes"
    :disabled="disabled"
    :placeholder="placeholder"
    :rows="rows"
    :value="modelValue"
    @input="handleInput"
  />
</template>
