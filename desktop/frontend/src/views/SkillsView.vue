<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Archive, FileArchive, RefreshCw, Trash2, Upload, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqModal from '@/components/ued/QqModal.vue'
import { useNotificationsStore } from '@/stores/notifications'
import { useSettingsStore } from '@/stores/settings'
import { useSkillsStore } from '@/stores/skills'
import { parseSkillZip } from '@/services/utils/skill-package'

const settingsStore = useSettingsStore()
const skillsStore = useSkillsStore()
const notificationsStore = useNotificationsStore()

const fileInput = ref(null)
const importDialog = reactive({
  open: false,
  fileName: '',
  skill: null,
  error: '',
})
const deleteDialog = reactive({
  open: false,
  skill: null,
})

const baseUrl = computed(() => settingsStore.settings.gateway.baseUrl)
const inactiveSkills = computed(() => skillsStore.items.filter((skill) => skill.status !== 'active'))
const supportFileCount = computed(() => importDialog.skill?.files?.length || 0)

function chooseZip() {
  fileInput.value?.click()
}

async function handleZipSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) {
    return
  }
  importDialog.open = true
  importDialog.fileName = file.name
  importDialog.skill = null
  importDialog.error = ''
  try {
    importDialog.skill = await parseSkillZip(file)
  } catch (error) {
    importDialog.error = error?.message || String(error)
  }
}

function closeImportDialog() {
  importDialog.open = false
  importDialog.fileName = ''
  importDialog.skill = null
  importDialog.error = ''
}

async function confirmImport() {
  if (!importDialog.skill) {
    return
  }
  try {
    const saved = await skillsStore.importSkill(baseUrl.value, importDialog.skill)
    notificationsStore.notify({
      title: '技能包已导入',
      message: saved.name,
      tone: 'success',
    })
    closeImportDialog()
  } catch (error) {
    notificationsStore.error(error?.message || String(error), { title: '技能包导入失败' })
  }
}

async function refreshSkills() {
  await skillsStore.fetchSkills(baseUrl.value)
}

function deleteSkill(skill) {
  deleteDialog.skill = skill
  deleteDialog.open = true
}

function closeDeleteDialog() {
  deleteDialog.open = false
  deleteDialog.skill = null
}

async function confirmDeleteSkill() {
  const skill = deleteDialog.skill
  if (!skill) {
    return
  }
  try {
    await skillsStore.removeSkill(baseUrl.value, skill.id)
    notificationsStore.notify({
      title: '技能已删除',
      message: skill.name,
      tone: 'success',
    })
    closeDeleteDialog()
  } catch (error) {
    notificationsStore.error(error?.message || String(error), { title: '删除技能失败' })
  }
}

onMounted(() => {
  if (baseUrl.value) {
    void refreshSkills()
  }
})
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <input ref="fileInput" class="hidden" type="file" accept=".zip,application/zip" @change="handleZipSelected" />

    <div class="mx-auto max-w-7xl space-y-5">
      <section class="qq-panel-strong rounded-[8px] px-5 py-5">
        <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--qq-text-tertiary)]">Skills</p>
        <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="text-3xl font-semibold text-slate-50">技能包管理</h2>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--qq-text-secondary)]">
              从 zip 技能包导入 SKILL.md 以及 scripts、references、assets 支持文件，网关会发布到本地 .skills 并供 Claw 实例加载。
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <QqButton variant="secondary" :disabled="skillsStore.loading" @click="refreshSkills">
              <RefreshCw class="h-4 w-4" />
              {{ skillsStore.loading ? '刷新中...' : '刷新' }}
            </QqButton>
            <QqButton :disabled="skillsStore.importing" @click="chooseZip">
              <Upload class="h-4 w-4" />
              导入 zip
            </QqButton>
          </div>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Total</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ skillsStore.items.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Active</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ skillsStore.activeSkills.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Inactive</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ inactiveSkills.length }}</p>
          </div>
        </div>
      </section>

      <section class="qq-panel rounded-[6px] px-5 py-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.18em] text-[color:var(--qq-text-tertiary)]">Directory</p>
            <h2 class="mt-2 text-xl font-semibold text-[color:var(--qq-text-primary)] md:text-2xl">已安装技能</h2>
          </div>
          <span class="qq-badge w-fit rounded-[4px] px-2 py-0.5 text-[11px]">zip · SKILL.md</span>
        </div>

        <div class="mt-5 grid gap-3">
          <div
            v-if="!skillsStore.items.length"
            class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
          >
            当前网关还没有安装技能。导入 zip 技能包后，Agent 可以在配置里绑定对应 skill id。
          </div>

          <div
            v-for="skill in skillsStore.items"
            :key="skill.id"
            class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-4"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <FileArchive class="h-4 w-4 text-[color:var(--qq-accent)]" />
                  <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ skill.name }}</p>
                  <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ skill.version || 'v1' }}</span>
                  <span
                    class="rounded-[4px] px-2 py-0.5 text-[11px]"
                    :class="skill.status === 'active' ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-[color:var(--qq-text-tertiary)]'"
                  >
                    {{ skill.status === 'active' ? '启用' : skill.status }}
                  </span>
                </div>
                <p class="mt-2 text-sm leading-6 text-[color:var(--qq-text-secondary)]">{{ skill.description }}</p>
                <p class="mt-1 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">
                  ID {{ skill.id }} · Path {{ skill.path || skill.name }}
                </p>
                <p v-if="skill.source" class="mt-1 break-all text-xs text-[color:var(--qq-text-tertiary)]">
                  Source {{ skill.source }}
                </p>
              </div>
              <QqButton
                variant="danger"
                size="sm"
                :disabled="skillsStore.deletingId === skill.id"
                @click="deleteSkill(skill)"
              >
                <Trash2 class="h-4 w-4" />
              </QqButton>
            </div>
          </div>
        </div>
      </section>
    </div>

    <QqModal
      v-model="importDialog.open"
      :description="importDialog.fileName || '请选择 zip 技能包'"
      title="导入技能包"
    >
      <div v-if="importDialog.error" class="rounded-[6px] border border-rose-300/20 bg-rose-300/10 px-3 py-3 text-sm leading-6 text-rose-100">
        {{ importDialog.error }}
      </div>
      <div v-else-if="importDialog.skill" class="grid gap-3">
        <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
          <div class="flex flex-wrap items-center gap-2">
            <Archive class="h-4 w-4 text-[color:var(--qq-accent)]" />
            <p class="text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ importDialog.skill.name }}</p>
            <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ importDialog.skill.version }}</span>
          </div>
          <p class="mt-2 text-sm leading-6 text-[color:var(--qq-text-secondary)]">{{ importDialog.skill.description }}</p>
          <p class="mt-2 break-all text-xs text-[color:var(--qq-text-tertiary)]">Path {{ importDialog.skill.path }}</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Support files</p>
            <p class="mt-2 text-xl font-semibold text-[color:var(--qq-text-primary)]">{{ supportFileCount }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Mode</p>
            <p class="mt-2 text-sm text-[color:var(--qq-text-primary)]">同名技能将更新</p>
          </div>
        </div>
      </div>
      <div v-else class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm text-[color:var(--qq-text-secondary)]">
        正在读取技能包...
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="skillsStore.importing" @click="closeImportDialog">
          <X class="h-4 w-4" />
          取消
        </QqButton>
        <QqButton :disabled="skillsStore.importing || !importDialog.skill || Boolean(importDialog.error)" @click="confirmImport">
          <Upload class="h-4 w-4" />
          {{ skillsStore.importing ? '导入中...' : '确认导入' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="deleteDialog.open"
      description="删除后，该技能会从网关管理目录和 active 技能目录移除。"
      title="删除技能"
    >
      <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteDialog.skill?.name || '未选择技能' }}</p>
        <p class="mt-1">{{ deleteDialog.skill?.description || '-' }}</p>
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(skillsStore.deletingId)" @click="closeDeleteDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(skillsStore.deletingId)" @click="confirmDeleteSkill">
          <Trash2 class="h-4 w-4" />
          {{ skillsStore.deletingId ? '删除中...' : '删除技能' }}
        </QqButton>
      </template>
    </QqModal>
  </section>
</template>
