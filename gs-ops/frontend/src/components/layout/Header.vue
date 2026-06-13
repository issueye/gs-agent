<template>
  <header class="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
    <div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <div>
        <p class="text-sm text-slate-500">运维管理平台</p>
        <h1 class="text-lg font-semibold">GS-OPS</h1>
      </div>
      <div class="flex items-center gap-3">
        <div class="hidden items-center gap-2 rounded-md border border-line bg-field px-3 py-2 text-sm sm:flex">
          <ShieldCheck class="h-4 w-4 text-success" aria-hidden="true" />
          {{ roleLabel }}
        </div>
        <div class="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm font-semibold text-white">
          {{ initials }}
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { ShieldCheck } from 'lucide-vue-next'
import { useUserStore } from '../../stores/user'

const user = useUserStore()
const initials = computed(() => user.user.name.slice(0, 1).toUpperCase())
const roleLabel = computed(() => {
  if (user.user.role === 'admin') return '管理员'
  return user.user.role
})
</script>
