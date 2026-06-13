<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
      toneClass,
    ]"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current" />
    {{ formatStatus(status) }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { formatStatus } from '../../utils/format'

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
})

const toneClass = computed(() => {
  if (props.status === 'running') return 'bg-emerald-50 text-success'
  if (props.status === 'stopped') return 'bg-slate-100 text-slate-600'
  if (props.status === 'error') return 'bg-red-50 text-danger'
  return 'bg-amber-50 text-warning'
})
</script>
