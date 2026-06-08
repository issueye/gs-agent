import { defineStore } from 'pinia'
import { createSkill, deleteSkill, listSkills, updateSkill } from '@/services/gateway/skills'

export const useSkillsStore = defineStore('skills', {
  state: () => ({
    items: [],
    loading: false,
    importing: false,
    deletingId: '',
    error: '',
  }),

  getters: {
    activeSkills(state) {
      return state.items.filter((item) => item.status === 'active')
    },
  },

  actions: {
    async fetchSkills(baseUrl) {
      this.loading = true
      this.error = ''
      try {
        this.items = await listSkills(baseUrl)
        return this.items
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async importSkill(baseUrl, skill) {
      this.importing = true
      this.error = ''
      try {
        const existing = this.items.find((item) => item.name === skill.name)
        const saved = existing ? await updateSkill(baseUrl, existing.id, skill) : await createSkill(baseUrl, skill)
        await this.fetchSkills(baseUrl)
        return saved
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.importing = false
      }
    },

    async removeSkill(baseUrl, skillId) {
      this.deletingId = skillId
      this.error = ''
      try {
        await deleteSkill(baseUrl, skillId)
        this.items = this.items.filter((item) => item.id !== skillId)
      } catch (error) {
        this.error = error?.message || String(error)
        throw error
      } finally {
        this.deletingId = ''
      }
    },
  },
})
