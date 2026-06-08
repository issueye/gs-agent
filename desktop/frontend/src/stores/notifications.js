import { defineStore } from 'pinia'

const defaultDuration = 5000
const timers = new Map()

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [],
  }),

  actions: {
    notify(input) {
      const message = String(input?.message || '').trim()
      if (!message) {
        return ''
      }

      const item = {
        id: buildNotificationId(),
        title: input?.title || '提示',
        message,
        tone: input?.tone || 'info',
        createdAt: Date.now(),
      }

      this.items = [...this.items, item]

      const duration = input?.durationMs ?? defaultDuration
      if (duration > 0) {
        const timer = setTimeout(() => {
          this.dismiss(item.id)
        }, duration)
        timers.set(item.id, timer)
      }

      return item.id
    },

    error(message, options = {}) {
      return this.notify({
        title: options.title || '请求失败',
        message,
        tone: 'error',
        durationMs: options.durationMs,
      })
    },

    dismiss(id) {
      const timer = timers.get(id)
      if (timer) {
        clearTimeout(timer)
        timers.delete(id)
      }
      this.items = this.items.filter((item) => item.id !== id)
    },

    clear() {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
      this.items = []
    },
  },
})

function buildNotificationId() {
  return `notify_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
