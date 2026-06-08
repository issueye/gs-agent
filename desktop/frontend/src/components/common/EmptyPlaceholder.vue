<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: 'Placeholder',
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
  <div class="flex h-full min-h-0 items-center justify-center px-6 py-10">
    <section class="max-w-xl">
      <p class="text-xs uppercase tracking-[0.24em] text-accent/70">{{ eyebrow }}</p>
      <h2 class="mt-4 text-3xl font-semibold text-slate-50">{{ title }}</h2>
      <p class="mt-4 text-sm leading-7 text-slate-400">{{ description }}</p>
    </section>
  </div>
</template>
