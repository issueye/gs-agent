<script setup>
defineProps({
  eyebrow: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <section class="qq-panel rounded-[6px] px-4 py-4 md:px-5 md:py-5">
    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div class="max-w-2xl">
        <p v-if="eyebrow" class="text-xs uppercase tracking-[0.18em] text-[color:var(--qq-text-tertiary)]">{{ eyebrow }}</p>
        <h2 v-if="title" class="mt-2 text-xl font-semibold text-[color:var(--qq-text-primary)] md:text-2xl">{{ title }}</h2>
        <p v-if="description" class="mt-3 text-sm leading-7 text-[color:var(--qq-text-secondary)]">{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>
    <div class="mt-5">
      <slot />
    </div>
  </section>
</template>
