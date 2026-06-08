<script setup>
import { computed } from 'vue'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next'
import { useNotificationsStore } from '@/stores/notifications'

const notificationsStore = useNotificationsStore()

const items = computed(() => notificationsStore.items)

const toneClassMap = {
  error: 'border-rose-500/30 bg-rose-950/90 text-rose-100',
  success: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100',
  info: 'border-slate-600 bg-slate-900/92 text-slate-100',
}

function toneIcon(tone) {
  if (tone === 'error') return CircleAlert
  if (tone === 'success') return CircleCheck
  return Info
}

function dismiss(id) {
  notificationsStore.dismiss(id)
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-5 top-5 z-50 flex w-[min(28rem,calc(100vw-2.5rem))] flex-col gap-3">
      <transition-group name="notify">
        <section
          v-for="item in items"
          :key="item.id"
          class="pointer-events-auto rounded-md border px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur"
          :class="toneClassMap[item.tone] || toneClassMap.info"
        >
          <div class="flex items-start gap-3">
            <component :is="toneIcon(item.tone)" class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ item.title }}</p>
              <p class="mt-1 break-words text-sm leading-6 text-current/90">{{ item.message }}</p>
            </div>
            <button
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-current/70 transition hover:bg-white/5 hover:text-current"
              type="button"
              title="关闭提醒"
              @click="dismiss(item.id)"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </section>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
.notify-enter-active,
.notify-leave-active {
  transition: all 180ms ease;
}

.notify-enter-from,
.notify-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
