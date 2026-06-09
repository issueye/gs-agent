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
      <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--qq-text-tertiary)]">{{ eyebrow }}</p>
      <h2 class="mt-4 text-3xl font-semibold text-[color:var(--qq-text-primary)]">{{ title }}</h2>
      <p class="mt-4 text-sm leading-7 text-[color:var(--qq-text-secondary)]">{{ description }}</p>
    </section>
  </div>
</template>
