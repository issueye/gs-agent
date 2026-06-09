<script setup>
import { computed } from 'vue'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next'
import { useNotificationsStore } from '@/stores/notifications'

const notificationsStore = useNotificationsStore()

const items = computed(() => notificationsStore.items)

const toneClassMap = {
  error: 'app-notification app-notification--error',
  success: 'app-notification app-notification--success',
  info: 'app-notification app-notification--info',
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
          class="pointer-events-auto rounded-md border px-4 py-3"
          :class="toneClassMap[item.tone] || toneClassMap.info"
        >
          <div class="flex items-start gap-3">
            <component :is="toneIcon(item.tone)" class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ item.title }}</p>
              <p class="mt-1 break-words text-sm leading-6">{{ item.message }}</p>
            </div>
            <button
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition"
              :class="item.tone === 'error' ? 'text-rose-600 hover:bg-rose-100 hover:text-rose-700' : 'text-[color:var(--qq-text-tertiary)] hover:bg-[rgba(15,23,42,0.06)] hover:text-[color:var(--qq-text-primary)]'"
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

.app-notification {
  color: var(--qq-text-primary);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.app-notification--info {
  border-color: rgba(0, 136, 255, 0.2);
  background: rgba(239, 247, 255, 0.96);
}

.app-notification--success {
  border-color: rgba(16, 185, 129, 0.22);
  background: rgba(236, 253, 245, 0.96);
}

.app-notification--error {
  border-color: rgba(225, 29, 72, 0.22);
  background: rgba(255, 241, 242, 0.96);
  color: #7f1d1d;
}
</style>
