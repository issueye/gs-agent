<script setup>
import { AlertTriangle, Loader2, Search } from 'lucide-vue-next'

defineProps({
  state: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <section class="flex min-h-[260px] items-center justify-center border border-[color:var(--qq-border)] bg-white/62 px-6 py-10" style="border-radius: 6px;">
    <div class="max-w-md text-center">
      <div class="mx-auto flex h-10 w-10 items-center justify-center rounded-[4px] border border-[color:var(--qq-border)] bg-white/80 text-[color:var(--qq-accent)]">
        <Loader2 v-if="state === 'loading'" class="h-5 w-5 animate-spin" />
        <AlertTriangle v-else-if="state === 'gateway'" class="h-5 w-5 text-amber-600" />
        <Search v-else class="h-5 w-5" />
      </div>
      <h2 class="mt-4 text-base font-semibold text-[color:var(--qq-text-primary)]">{{ title }}</h2>
      <p class="mt-2 text-sm leading-6 text-[color:var(--qq-text-secondary)]">{{ description }}</p>
    </div>
  </section>
</template>
