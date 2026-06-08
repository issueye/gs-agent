<script setup>
import { reactive, watch } from 'vue'
import { Check, FolderOpen, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqFormSection from '@/components/ued/QqFormSection.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
import { mergeSettings } from '@/services/settings/schema'
import { useAgentsStore } from '@/stores/agents'
import { useAppStore } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'

const appStore = useAppStore()
const settingsStore = useSettingsStore()
const agentsStore = useAgentsStore()

const form = reactive(mergeSettings())
const projectDraft = reactive({
  mode: 'create',
  editingId: '',
  name: '',
  rootDir: '',
  error: '',
})
const pathDialog = reactive({
  open: false,
  target: '',
  title: '',
  description: '',
  draft: '',
})
const deleteProjectDialog = reactive({
  open: false,
  project: null,
})

watch(
  () => settingsStore.settings,
  (value) => {
    Object.assign(form.gateway, value.gateway)
    Object.assign(form.workspace, value.workspace)
    Object.assign(form.ui, value.ui)
    form.projects = [...(value.projects || [])]
    form.currentProjectId = value.currentProjectId || ''
  },
  { deep: true, immediate: true },
)

function openPathDialog(target) {
  const isProject = target === 'project'
  pathDialog.target = target
  pathDialog.title = isProject ? '填写项目目录' : '填写工作目录'
  pathDialog.description = isProject ? '输入本地项目根目录，保存后会用于当前项目上下文。' : '输入本地工作目录，保存后写入桌面端本地配置。'
  pathDialog.draft = isProject ? projectDraft.rootDir : form.workspace.rootDir
  pathDialog.open = true
}

function closePathDialog() {
  pathDialog.open = false
}

function applyPathDialog() {
  const value = pathDialog.draft.trim()
  if (pathDialog.target === 'project') {
    projectDraft.rootDir = value
  } else {
    form.workspace.rootDir = value
  }
  closePathDialog()
}

async function save() {
  await settingsStore.save(mergeSettings(form))
  await appStore.refreshGatewayData()
}

function upsertProject() {
  projectDraft.error = ''
  const name = projectDraft.name.trim()
  const rootDir = projectDraft.rootDir.trim()
  if (!name) {
    projectDraft.error = '请输入项目名称。'
    return
  }
  if (!rootDir) {
    projectDraft.error = '请选择项目目录。'
    return
  }

  if (projectDraft.mode === 'edit') {
    form.projects = form.projects.map((project) => (project.id === projectDraft.editingId ? { ...project, name, rootDir } : project))
  } else {
    const project = {
      id: createProjectId(),
      name,
      rootDir,
    }
    form.projects = [...form.projects, project]
    form.currentProjectId = project.id
  }

  syncWorkspaceRootDir()
  resetProjectDraft()
}

function editProject(project) {
  projectDraft.mode = 'edit'
  projectDraft.editingId = project.id
  projectDraft.name = project.name
  projectDraft.rootDir = project.rootDir
  projectDraft.error = ''
}

function deleteProject(project) {
  deleteProjectDialog.project = project
  deleteProjectDialog.open = true
}

function closeDeleteProjectDialog() {
  deleteProjectDialog.open = false
  deleteProjectDialog.project = null
}

function confirmDeleteProject() {
  const projectId = deleteProjectDialog.project?.id
  if (!projectId) {
    return
  }
  form.projects = form.projects.filter((project) => project.id !== projectId)
  if (form.currentProjectId === projectId) {
    form.currentProjectId = form.projects[0]?.id || ''
  }
  syncWorkspaceRootDir()
  if (projectDraft.editingId === projectId) {
    resetProjectDraft()
  }
  closeDeleteProjectDialog()
}

function selectProject(projectId) {
  form.currentProjectId = projectId
  syncWorkspaceRootDir()
}

function resetProjectDraft() {
  projectDraft.mode = 'create'
  projectDraft.editingId = ''
  projectDraft.name = ''
  projectDraft.rootDir = ''
  projectDraft.error = ''
}

function syncWorkspaceRootDir() {
  const project = form.projects.find((item) => item.id === form.currentProjectId)
  if (project) {
    form.workspace.rootDir = project.rootDir
  }
}

function projectOptions() {
  return [
    { label: '不绑定项目', value: '' },
    ...form.projects.map((project) => ({
      label: project.name,
      value: project.id,
    })),
  ]
}

function createProjectId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `project_${globalThis.crypto.randomUUID()}`
  }
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function agentOptions() {
  return [
    { label: '请选择 Agent', value: '' },
    ...agentsStore.items.map((agent) => ({
      label: `${agent.name} (${agent.id})`,
      value: agent.id,
    })),
  ]
}
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <div class="mx-auto max-w-5xl space-y-5">
      <section class="qq-panel-strong rounded-[8px] px-5 py-5">
        <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--qq-text-tertiary)]">Local Settings</p>
        <h2 class="mt-3 text-3xl font-semibold text-slate-50">桌面端配置</h2>
        <p class="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--qq-text-secondary)]">
          当前只保留聊天主链路需要的本地设置。网关地址、默认 Agent 和工作目录使用 TOML 写入本机配置文件。
        </p>
      </section>

      <QqFormSection
        eyebrow="Projects"
        title="本地项目"
        description="项目只保存在本机配置里，用于标记当前聊天上下文；没有项目时聊天仍会照常工作。"
      >
        <div class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div class="grid content-start gap-4">
            <QqFormField label="当前项目" helper="切换后会同步旧版 workspace.rootDir 字段。">
              <QqSelect :model-value="form.currentProjectId" :options="projectOptions()" @update:model-value="selectProject" />
            </QqFormField>

            <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.22)] p-4">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-[color:var(--qq-text-primary)]">
                    {{ projectDraft.mode === 'edit' ? '编辑项目' : '新增项目' }}
                  </p>
                  <p class="mt-1 text-xs text-[color:var(--qq-text-tertiary)]">名称和目录保存后会写入配置文件。</p>
                </div>
                <QqButton v-if="projectDraft.mode === 'edit'" variant="ghost" size="sm" @click="resetProjectDraft">
                  <X class="h-4 w-4" />
                  取消
                </QqButton>
              </div>

              <div class="grid gap-4">
                <QqFormField label="项目名称" :error="projectDraft.error && !projectDraft.name.trim() ? projectDraft.error : ''">
                  <QqInput v-model="projectDraft.name" placeholder="例如：icoo_claw" />
                </QqFormField>

                <QqFormField label="项目目录" :error="projectDraft.error && projectDraft.name.trim() && !projectDraft.rootDir.trim() ? projectDraft.error : ''">
                  <div class="flex flex-col gap-3 md:flex-row">
                    <QqInput v-model="projectDraft.rootDir" class="flex-1" placeholder="选择本地项目目录" />
                    <QqButton variant="secondary" @click="openPathDialog('project')">
                      <FolderOpen class="h-4 w-4" />
                      浏览
                    </QqButton>
                  </div>
                </QqFormField>

                <p v-if="projectDraft.error && projectDraft.name.trim() && projectDraft.rootDir.trim()" class="text-xs text-[var(--qq-danger)]">
                  {{ projectDraft.error }}
                </p>

                <QqButton @click="upsertProject">
                  <component :is="projectDraft.mode === 'edit' ? Check : Plus" class="h-4 w-4" />
                  {{ projectDraft.mode === 'edit' ? '更新项目' : '新增项目' }}
                </QqButton>
              </div>
            </div>
          </div>

          <div class="grid content-start gap-3">
            <div
              v-if="!form.projects.length"
              class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
            >
              还没有本地项目。你可以先保存基础配置，之后再回来补项目。
            </div>

            <div
              v-for="project in form.projects"
              :key="project.id"
              class="rounded-[6px] border px-4 py-3 transition"
              :class="
                form.currentProjectId === project.id
                  ? 'border-[rgba(75,239,201,0.48)] bg-[rgba(31,82,69,0.50)]'
                  : 'border-white/10 bg-[rgba(9,32,28,0.18)]'
              "
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ project.name }}</p>
                    <span v-if="form.currentProjectId === project.id" class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">当前</span>
                  </div>
                  <p class="mt-2 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">{{ project.rootDir }}</p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                  <QqButton variant="secondary" size="sm" @click="selectProject(project.id)">选择</QqButton>
                  <QqButton variant="ghost" size="sm" @click="editProject(project)">
                    <Pencil class="h-4 w-4" />
                  </QqButton>
                  <QqButton variant="danger" size="sm" @click="deleteProject(project)">
                    <Trash2 class="h-4 w-4" />
                  </QqButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </QqFormSection>

      <div class="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <QqFormSection
          eyebrow="Gateway"
          title="网关与默认 Agent"
          description="连接地址、默认 Agent 和工作目录都从这里管理，保持桌面端与网关配置一致。"
        >
          <div class="grid gap-5">
            <QqFormField label="Gateway URL" helper="桌面端所有 HTTP 和 WebSocket 请求都走这个地址。">
              <QqInput v-model="form.gateway.baseUrl" type="text" />
            </QqFormField>

            <QqFormField label="Default Agent" helper="默认进入聊天时优先使用的 Agent。">
              <QqSelect v-model="form.gateway.defaultAgentId" :options="agentOptions()" />
            </QqFormField>

            <QqFormField label="Workspace Directory" helper="兼容旧版配置；选择当前项目时会自动同步为项目目录。">
              <div class="flex flex-col gap-3 md:flex-row">
                <QqInput v-model="form.workspace.rootDir" class="flex-1" type="text" />
                <QqButton variant="secondary" @click="openPathDialog('workspace')">浏览</QqButton>
              </div>
            </QqFormField>
          </div>
        </QqFormSection>

        <QqFormSection
          eyebrow="Behavior"
          title="界面行为"
          description="先把聊天主链路需要的可见行为统一收口，后面再扩展更细的偏好项。"
        >
          <div class="grid gap-3">
            <QqSwitch
              v-model="form.ui.showTimestamps"
              label="显示消息时间"
              description="控制聊天消息中是否显示时间。"
            />
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <QqButton @click="save">保存设置</QqButton>
            <QqButton variant="secondary" @click="appStore.refreshGatewayData">
              <RefreshCw class="h-4 w-4" />
              刷新网关数据
            </QqButton>
          </div>
        </QqFormSection>
      </div>

      <QqFormSection eyebrow="Runtime" title="运行信息" description="用于确认当前本地配置路径和运行时环境。">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.22)] px-4 py-3 text-sm text-[color:var(--qq-text-secondary)]">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Config Path</p>
            <p class="mt-2 break-all">{{ settingsStore.path || '未加载' }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.22)] px-4 py-3 text-sm text-[color:var(--qq-text-secondary)]">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Runtime</p>
            <p class="mt-2 break-all">
              {{ appStore.appInfo?.name || 'Icoo Claw' }} {{ appStore.appInfo?.version || '' }}
            </p>
            <p class="mt-1 break-all">
              {{ appStore.appInfo?.os || '' }} / {{ appStore.appInfo?.arch || '' }} / {{ appStore.appInfo?.goVersion || '' }}
            </p>
          </div>
        </div>
      </QqFormSection>

      <QqModal
        v-model="pathDialog.open"
        :description="pathDialog.description"
        :title="pathDialog.title"
      >
        <QqFormField label="目录路径" helper="例如：E:\\codes\\icoo_claw">
          <QqInput v-model="pathDialog.draft" placeholder="输入本地目录路径" />
        </QqFormField>

        <template #footer>
          <QqButton variant="ghost" @click="closePathDialog">取消</QqButton>
          <QqButton @click="applyPathDialog">
            <Check class="h-4 w-4" />
            使用此目录
          </QqButton>
        </template>
      </QqModal>

      <QqModal
        v-model="deleteProjectDialog.open"
        description="删除项目只会移除桌面端本地配置，不会删除磁盘上的文件。"
        title="删除项目"
      >
        <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
          <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteProjectDialog.project?.name || '未选择项目' }}</p>
          <p class="mt-1 break-all">{{ deleteProjectDialog.project?.rootDir || '-' }}</p>
        </div>

        <template #footer>
          <QqButton variant="ghost" @click="closeDeleteProjectDialog">取消</QqButton>
          <QqButton variant="danger" @click="confirmDeleteProject">
            <Trash2 class="h-4 w-4" />
            删除项目
          </QqButton>
        </template>
      </QqModal>
    </div>
  </section>
</template>
