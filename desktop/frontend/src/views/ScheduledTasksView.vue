<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, ClipboardList, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqFormSection from '@/components/ued/QqFormSection.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
import QqTextarea from '@/components/ued/QqTextarea.vue'
import { useAgentsStore } from '@/stores/agents'
import { useNotificationsStore } from '@/stores/notifications'
import { useScheduledTasksStore } from '@/stores/scheduledTasks'
import { useSettingsStore } from '@/stores/settings'

const agentsStore = useAgentsStore()
const scheduledTasksStore = useScheduledTasksStore()
const settingsStore = useSettingsStore()
const notificationsStore = useNotificationsStore()

const editorOpen = ref(false)
const deleteDialog = reactive({
  open: false,
  task: null,
})
const runsDialog = reactive({
  open: false,
  task: null,
})
const form = reactive(emptyForm())
const baseUrl = computed(() => settingsStore.settings.gateway.baseUrl)
const selectedTaskRuns = computed(() => {
  const taskId = runsDialog.task?.id || ''
  return taskId ? scheduledTasksStore.runsByTaskId[taskId] || [] : []
})

const scheduleOptions = [
  { label: '间隔执行', value: 'interval', description: '例如每 5 分钟、每 1 小时。' },
  { label: '每天执行', value: 'daily', description: '每天固定 UTC 时间执行。' },
  { label: '执行一次', value: 'once', description: '到指定 RFC3339 时间执行一次。' },
]

const actionOptions = [
  { label: 'Webhook', value: 'webhook', description: '在 payload 中保存 url、method、body 等信息。' },
  { label: 'Agent Prompt', value: 'agent_prompt', description: '由选定 Agent 执行任务。' },
  { label: 'Maintenance', value: 'maintenance', description: '预留给网关维护动作。' },
]

const agentOptions = computed(() => [
  { label: '请选择 Agent', value: '' },
  ...agentsStore.items.map((agent) => ({
    label: agent.name,
    value: agent.id,
  })),
])

const scheduleHelper = computed(() => {
  if (form.scheduleType === 'daily') {
    return '格式 HH:mm，按 UTC 时间计算，例如 09:30。'
  }
  if (form.scheduleType === 'once') {
    return '格式 RFC3339，例如 2026-05-24T12:00:00Z。'
  }
  return '格式 Go duration，例如 5m、30m、1h。'
})

function emptyForm() {
  return {
    editingId: '',
    id: '',
    name: '',
    description: '',
    scheduleType: 'interval',
    scheduleValue: '5m',
    actionType: 'webhook',
    agentId: '',
    payloadText: '{\n  "url": "http://127.0.0.1:18878/health"\n}',
    enabled: true,
  }
}

function resetForm() {
  Object.assign(form, emptyForm())
}

function openCreateEditor() {
  resetForm()
  editorOpen.value = true
}

function openEditEditor(task) {
  Object.assign(form, {
    editingId: task.id,
    id: task.id,
    name: task.name || '',
    description: task.description || '',
    scheduleType: task.scheduleType || 'interval',
    scheduleValue: task.scheduleValue || '',
    actionType: task.actionType || 'webhook',
    agentId: task.agentId || '',
    payloadText: task.payloadText || '{}',
    enabled: Boolean(task.enabled),
  })
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

async function refreshTasks() {
  await scheduledTasksStore.fetchTasks(baseUrl.value)
}

async function saveTask() {
  if (!form.name.trim()) {
    notificationsStore.error('请填写任务名称。', { title: '定时任务配置不完整' })
    return
  }
  if (form.actionType === 'agent_prompt' && !form.agentId.trim()) {
    notificationsStore.error('请选择要执行的 Agent。', { title: '定时任务配置不完整' })
    return
  }
  try {
    JSON.parse(form.payloadText || '{}')
  } catch {
    notificationsStore.error('Payload 必须是合法 JSON。', { title: '定时任务配置不完整' })
    return
  }

  const saved = await scheduledTasksStore.saveTask(baseUrl.value, {
    ...form,
    name: form.name.trim(),
    id: form.id.trim(),
    description: form.description.trim(),
    agentId: form.agentId.trim(),
    scheduleValue: form.scheduleValue.trim(),
  })
  notificationsStore.notify({
    title: form.editingId ? '定时任务已更新' : '定时任务已创建',
    message: saved.name,
    tone: 'success',
  })
  closeEditor()
  resetForm()
}

function deleteTask(task) {
  deleteDialog.task = task
  deleteDialog.open = true
}

function closeDeleteDialog() {
  deleteDialog.open = false
  deleteDialog.task = null
}

async function openRunsDialog(task) {
  runsDialog.task = task
  runsDialog.open = true
  try {
    await scheduledTasksStore.fetchTaskRuns(baseUrl.value, task.id)
  } catch (error) {
    notificationsStore.error(error?.message || String(error), { title: '执行情况读取失败' })
  }
}

function closeRunsDialog() {
  runsDialog.open = false
  runsDialog.task = null
}

async function confirmDeleteTask() {
  const task = deleteDialog.task
  if (!task) {
    return
  }
  await scheduledTasksStore.removeTask(baseUrl.value, task.id)
  notificationsStore.notify({
    title: '定时任务已删除',
    message: task.name,
    tone: 'success',
  })
  closeDeleteDialog()
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

function statusClass(status, enabled) {
  if (!enabled || status === 'paused') {
    return 'bg-white/10 text-[color:var(--qq-text-tertiary)]'
  }
  if (status === 'completed') {
    return 'bg-sky-300/15 text-sky-100'
  }
  if (status === 'error') {
    return 'bg-rose-300/15 text-rose-100'
  }
  return 'bg-emerald-300/15 text-emerald-100'
}

function runStatusClass(status) {
  if (status === 'error') {
    return 'bg-rose-300/15 text-rose-100'
  }
  if (status === 'completed') {
    return 'bg-sky-300/15 text-sky-100'
  }
  if (status === 'active') {
    return 'bg-emerald-300/15 text-emerald-100'
  }
  return 'bg-white/10 text-[color:var(--qq-text-tertiary)]'
}

onMounted(() => {
  if (baseUrl.value) {
    void agentsStore.fetchAgents(baseUrl.value)
    void refreshTasks()
  }
})
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <div class="mx-auto max-w-7xl space-y-5">
      <section class="qq-panel-strong rounded-[8px] px-5 py-5">
        <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--qq-text-tertiary)]">Scheduled Tasks</p>
        <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="text-3xl font-semibold text-slate-50">定时任务管理</h2>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--qq-text-secondary)]">
              网关会持久化任务计划，并按到期时间扫描执行记录。当前版本先提供计划管理、启停、执行次数和下一次运行时间。
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <QqButton variant="secondary" :disabled="scheduledTasksStore.loading" @click="refreshTasks">
              <RefreshCw class="h-4 w-4" />
              {{ scheduledTasksStore.loading ? '刷新中...' : '刷新' }}
            </QqButton>
            <QqButton @click="openCreateEditor">
              <Plus class="h-4 w-4" />
              新建任务
            </QqButton>
          </div>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Tasks</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ scheduledTasksStore.items.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Active</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ scheduledTasksStore.activeCount }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Paused</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ scheduledTasksStore.pausedCount }}</p>
          </div>
        </div>
      </section>

      <QqFormSection
        eyebrow="Directory"
        title="任务列表"
        description="间隔任务使用 5m / 1h 这样的时长；每日任务使用 UTC HH:mm；一次性任务使用 RFC3339 时间。"
      >
        <div class="grid gap-3">
          <div
            v-if="!scheduledTasksStore.items.length"
            class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
          >
            当前网关还没有定时任务。创建任务后，网关会计算下一次运行时间。
          </div>

          <div
            v-for="task in scheduledTasksStore.items"
            :key="task.id"
            class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-4"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ task.name }}</p>
                  <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ task.scheduleType }}</span>
                  <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ task.actionType }}</span>
                  <span v-if="task.agentId" class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">
                    {{ agentsStore.items.find((agent) => agent.id === task.agentId)?.name || task.agentId }}
                  </span>
                  <span class="rounded-[4px] px-2 py-0.5 text-[11px]" :class="statusClass(task.status, task.enabled)">
                    {{ task.status || 'unknown' }}
                  </span>
                </div>
                <p class="mt-2 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">
                  ID {{ task.id }} · {{ task.scheduleValue }}
                </p>
                <p v-if="task.description" class="mt-1 text-xs leading-5 text-[color:var(--qq-text-secondary)]">
                  {{ task.description }}
                </p>
                <div class="mt-2 grid gap-2 text-xs text-[color:var(--qq-text-tertiary)] md:grid-cols-3">
                  <span>下次 {{ formatDate(task.nextRunAt) }}</span>
                  <span>上次 {{ formatDate(task.lastRunAt) }}</span>
                  <span>次数 {{ task.runCount }}</span>
                </div>
                <p v-if="task.lastError" class="mt-2 text-xs text-[var(--qq-danger)]">{{ task.lastError }}</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <QqButton variant="secondary" size="sm" @click="openRunsDialog(task)">
                  <ClipboardList class="h-4 w-4" />
                </QqButton>
                <QqButton variant="secondary" size="sm" @click="openEditEditor(task)">
                  <Pencil class="h-4 w-4" />
                </QqButton>
                <QqButton
                  variant="danger"
                  size="sm"
                  :disabled="scheduledTasksStore.deletingId === task.id"
                  @click="deleteTask(task)"
                >
                  <Trash2 class="h-4 w-4" />
                </QqButton>
              </div>
            </div>
          </div>
        </div>
      </QqFormSection>
    </div>

    <QqModal
      v-model="editorOpen"
      :description="form.editingId ? '保存后网关会重新计算下一次运行时间。' : '创建后网关会立即计算下一次运行时间。'"
      :title="form.editingId ? '编辑定时任务' : '新建定时任务'"
      @confirm="saveTask"
    >
      <div class="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
        <QqFormField label="任务 ID" helper="可选。留空时网关自动生成；保存后不可修改。">
          <QqInput v-model="form.id" :disabled="Boolean(form.editingId)" placeholder="例如：task-health-check" />
        </QqFormField>

        <QqFormField label="名称" required>
          <QqInput v-model="form.name" placeholder="例如：健康检查" />
        </QqFormField>

        <QqFormField label="描述">
          <QqInput v-model="form.description" placeholder="描述这个任务的用途" />
        </QqFormField>

        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="计划类型">
            <QqSelect v-model="form.scheduleType" :options="scheduleOptions" />
          </QqFormField>
          <QqFormField label="计划值" :helper="scheduleHelper">
            <QqInput v-model="form.scheduleValue" placeholder="5m" />
          </QqFormField>
        </div>

        <QqFormField label="动作类型">
          <QqSelect v-model="form.actionType" :options="actionOptions" />
        </QqFormField>

        <QqFormField v-if="form.actionType === 'agent_prompt'" label="Agent">
          <QqSelect v-model="form.agentId" :options="agentOptions" />
        </QqFormField>

        <QqFormField label="Payload JSON" helper="保存任务动作需要的参数。">
          <QqTextarea v-model="form.payloadText" :rows="7" placeholder="{ }" />
        </QqFormField>

        <QqSwitch v-model="form.enabled" label="启用任务" description="停用后不会计算下一次运行时间，也不会被网关扫描执行。" />
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="scheduledTasksStore.saving" @click="closeEditor">
          <X class="h-4 w-4" />
          取消
        </QqButton>
        <QqButton :disabled="scheduledTasksStore.saving" @click="saveTask">
          <Check class="h-4 w-4" />
          {{ scheduledTasksStore.saving ? '保存中...' : '保存任务' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="runsDialog.open"
      :description="runsDialog.task ? '这里展示该任务最近的调度执行记录。' : ''"
      title="执行情况"
    >
      <div v-if="runsDialog.task" class="grid gap-4">
        <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
          <p class="font-medium text-[color:var(--qq-text-primary)]">{{ runsDialog.task.name }}</p>
          <p class="mt-1 break-all">ID {{ runsDialog.task.id }}</p>
          <p class="mt-1">Agent {{ runsDialog.task.agentId ? (agentsStore.items.find((agent) => agent.id === runsDialog.task.agentId)?.name || runsDialog.task.agentId) : '-' }}</p>
          <p class="mt-1">执行次数 {{ runsDialog.task.runCount }} · 上次 {{ formatDate(runsDialog.task.lastRunAt) }}</p>
        </div>

        <div v-if="scheduledTasksStore.runsLoading" class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]">
          正在读取执行情况...
        </div>

        <div
          v-else-if="!selectedTaskRuns.length"
          class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
        >
          还没有执行记录。等待任务到期并被网关扫描后，这里会出现最近执行情况。
        </div>

        <div v-else class="grid max-h-[52vh] gap-3 overflow-y-auto pr-1">
          <div
            v-for="run in selectedTaskRuns"
            :key="run.id"
            class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="rounded-[4px] px-2 py-0.5 text-[11px]" :class="runStatusClass(run.status)">
                {{ run.status || 'unknown' }}
              </span>
              <span class="text-xs text-[color:var(--qq-text-tertiary)]">{{ formatDate(run.executedAt) }}</span>
            </div>
            <p class="mt-2 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">ID {{ run.id }}</p>
            <p v-if="run.summary" class="mt-2 text-sm leading-6 text-[color:var(--qq-text-secondary)]">{{ run.summary }}</p>
            <p v-if="run.error" class="mt-2 text-xs leading-5 text-[var(--qq-danger)]">{{ run.error }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <QqButton variant="secondary" :disabled="scheduledTasksStore.runsLoading || !runsDialog.task" @click="openRunsDialog(runsDialog.task)">
          <RefreshCw class="h-4 w-4" />
          {{ scheduledTasksStore.runsLoading ? '刷新中...' : '刷新执行情况' }}
        </QqButton>
        <QqButton variant="ghost" @click="closeRunsDialog">关闭</QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="deleteDialog.open"
      description="删除后该任务计划和执行记录会从网关移除。"
      title="删除定时任务"
    >
      <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteDialog.task?.name || '未选择任务' }}</p>
        <p class="mt-1 break-all">ID {{ deleteDialog.task?.id || '-' }}</p>
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(scheduledTasksStore.deletingId)" @click="closeDeleteDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(scheduledTasksStore.deletingId)" @click="confirmDeleteTask">
          <Trash2 class="h-4 w-4" />
          {{ scheduledTasksStore.deletingId ? '删除中...' : '删除任务' }}
        </QqButton>
      </template>
    </QqModal>
  </section>
</template>
