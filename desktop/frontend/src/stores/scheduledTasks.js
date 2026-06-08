import { defineStore } from 'pinia'
import {
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTaskRuns,
  listScheduledTasks,
  updateScheduledTask,
} from '@/services/gateway/scheduledTasks'

export const useScheduledTasksStore = defineStore('scheduledTasks', {
  state: () => ({
    items: [],
    loading: false,
    saving: false,
    deletingId: '',
    runsLoading: false,
    runsByTaskId: {},
    error: '',
  }),

  getters: {
    activeCount: (state) => state.items.filter((item) => item.enabled && item.status === 'active').length,
    pausedCount: (state) => state.items.filter((item) => !item.enabled || item.status === 'paused').length,
  },

  actions: {
    async fetchTasks(baseUrl) {
      this.loading = true
      this.error = ''
      try {
        this.items = await listScheduledTasks(baseUrl)
        return this.items
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async saveTask(baseUrl, task) {
      this.saving = true
      this.error = ''
      try {
        const saved = task.editingId
          ? await updateScheduledTask(baseUrl, task.editingId, task)
          : await createScheduledTask(baseUrl, task)
        await this.fetchTasks(baseUrl)
        return saved
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.saving = false
      }
    },

    async removeTask(baseUrl, taskId) {
      this.deletingId = taskId
      this.error = ''
      try {
        await deleteScheduledTask(baseUrl, taskId)
        this.items = this.items.filter((item) => item.id !== taskId)
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.deletingId = ''
      }
    },

    async fetchTaskRuns(baseUrl, taskId) {
      this.runsLoading = true
      this.error = ''
      try {
        const runs = await listScheduledTaskRuns(baseUrl, taskId)
        this.runsByTaskId = {
          ...this.runsByTaskId,
          [taskId]: runs,
        }
        return runs
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.runsLoading = false
      }
    },
  },
})
