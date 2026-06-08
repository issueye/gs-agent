<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder.vue'

const route = useRoute()

const eyebrow = computed(() => route.meta.eyebrow || 'Placeholder')
const title = computed(() => route.meta.title || 'Placeholder')
const description = computed(() => route.meta.description || '')
</script>

<template>
  <EmptyPlaceholder :description="description" :eyebrow="eyebrow" :title="title" />
</template>
