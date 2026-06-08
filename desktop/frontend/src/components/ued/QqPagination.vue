<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: Number,
    default: 1,
  },
  total: {
    type: Number,
    default: 0,
  },
  pageSize: {
    type: Number,
    default: 10,
  },
})

const emit = defineEmits(['update:modelValue'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

const pages = computed(() => {
  const current = props.modelValue
  const start = Math.max(1, current - 1)
  const end = Math.min(totalPages.value, start + 2)
  const normalizedStart = Math.max(1, end - 2)
  return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index)
})

function go(page) {
  if (page < 1 || page > totalPages.value || page === props.modelValue) {
    return
  }
  emit('update:modelValue', page)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      class="inline-flex h-9 w-9 items-center justify-center rounded-[4px] border border-[color:var(--qq-border)] bg-[rgba(255,255,255,0.08)] text-[color:var(--qq-text-secondary)] transition hover:bg-[rgba(255,255,255,0.14)] hover:text-[color:var(--qq-text-primary)] disabled:opacity-45"
      :disabled="modelValue <= 1"
      type="button"
      @click="go(modelValue - 1)"
    >
      <ChevronLeft class="h-4 w-4" />
    </button>

    <button
      v-for="page in pages"
      :key="page"
      class="inline-flex h-9 min-w-9 items-center justify-center rounded-[4px] border px-2.5 text-sm font-medium transition"
      :class="
        page === modelValue
          ? 'border-transparent bg-[linear-gradient(135deg,var(--qq-accent),var(--qq-accent-strong))] text-slate-950'
          : 'border-[color:var(--qq-border)] bg-[rgba(255,255,255,0.08)] text-[color:var(--qq-text-secondary)] hover:bg-[rgba(255,255,255,0.14)] hover:text-[color:var(--qq-text-primary)]'
      "
      type="button"
      @click="go(page)"
    >
      {{ page }}
    </button>

    <button
      class="inline-flex h-9 w-9 items-center justify-center rounded-[4px] border border-[color:var(--qq-border)] bg-[rgba(255,255,255,0.08)] text-[color:var(--qq-text-secondary)] transition hover:bg-[rgba(255,255,255,0.14)] hover:text-[color:var(--qq-text-primary)] disabled:opacity-45"
      :disabled="modelValue >= totalPages"
      type="button"
      @click="go(modelValue + 1)"
    >
      <ChevronRight class="h-4 w-4" />
    </button>
  </div>
</template>
