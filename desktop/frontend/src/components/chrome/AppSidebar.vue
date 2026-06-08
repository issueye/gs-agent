<script setup>
import { useRoute } from 'vue-router'
import ProjectSwitcher from '@/components/project/ProjectSwitcher.vue'

defineProps({
  items: {
    type: Array,
    required: true,
  },
})

const route = useRoute()

function isActive(item) {
  if (item.name === 'chat-home') {
    return route.path.startsWith('/chat')
  }
  return route.name === item.name
}
</script>

<template>
  <aside class="relative flex w-[72px] shrink-0 flex-col items-center gap-3 border-r border-[color:var(--qq-border)] bg-[color:var(--qq-sidebar)] px-2 py-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--qq-border)] bg-white text-sm font-semibold text-[var(--qq-accent)] shadow-sm">
      IC
    </div>

    <nav class="flex w-full flex-1 flex-col items-center gap-1">
      <RouterLink
        v-for="item in items"
        :key="item.name"
        :to="item.to"
        class="group flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] transition"
        :class="
          isActive(item)
            ? 'bg-white text-[color:var(--qq-text-primary)] shadow-sm ring-1 ring-[color:var(--qq-border)]'
            : 'text-[color:var(--qq-text-tertiary)] hover:bg-[rgba(15,23,42,0.055)] hover:text-[color:var(--qq-text-primary)]'
        "
      >
        <component :is="item.icon" class="h-4 w-4" :class="isActive(item) ? 'text-[color:var(--qq-accent)]' : ''" />
        <span class="text-center leading-tight">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <ProjectSwitcher compact />
  </aside>
</template>
