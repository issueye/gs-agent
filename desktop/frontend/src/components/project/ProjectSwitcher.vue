<script setup>
import { computed, ref } from 'vue'
import { FolderKanban } from 'lucide-vue-next'
import QqSelect from '@/components/ued/QqSelect.vue'
import { useProjectsStore } from '@/stores/projects'

defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
})

const projectsStore = useProjectsStore()
const saving = ref(false)

const selectedProjectId = computed({
  get: () => projectsStore.currentProjectId,
  set: (value) => selectProject(value),
})

const options = computed(() => [
  { label: '无项目', value: '' },
  ...projectsStore.items.map((project) => ({
    label: project.name,
    value: project.id,
  })),
])
const currentLabel = computed(() => projectsStore.currentProject?.name || '无项目')
const compactLabel = computed(() => {
  if (!projectsStore.currentProject?.name) {
    return '--'
  }
  return projectsStore.currentProject.name.slice(0, 2).toUpperCase()
})

async function selectProject(projectId) {
  saving.value = true
  try {
    await projectsStore.selectProject(projectId)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="compact"
    class="group relative flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] text-[color:var(--qq-text-tertiary)] transition hover:bg-[rgba(15,23,42,0.055)] hover:text-[color:var(--qq-text-primary)]"
    :title="`当前项目：${currentLabel}`"
  >
    <FolderKanban class="h-4 w-4" />
    <span class="max-w-full truncate text-center leading-tight">{{ compactLabel }}</span>
    <QqSelect
      v-model="selectedProjectId"
      class="absolute inset-0 opacity-0"
      :disabled="saving"
      :options="options"
    />
  </div>

  <div v-else class="w-full rounded-xl border border-[color:var(--qq-border)] bg-white/70 p-2">
    <div class="mb-2 flex items-center gap-2 px-1 text-[10px] uppercase leading-4 text-[color:var(--qq-text-tertiary)]">
      <FolderKanban class="h-3.5 w-3.5" />
      Project
    </div>
    <QqSelect v-model="selectedProjectId" :disabled="saving" :options="options" />
  </div>
</template>
