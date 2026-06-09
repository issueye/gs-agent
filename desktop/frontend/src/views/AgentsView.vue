<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, Eye, Pencil, Play, Plus, RefreshCw, RotateCw, Search, Square, Trash2, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
import QqTabs from '@/components/ued/QqTabs.vue'
import QqTag from '@/components/ued/QqTag.vue'
import QqTextarea from '@/components/ued/QqTextarea.vue'
import { useAgentInstancesStore } from '@/stores/agentInstances'
import { useAgentsStore } from '@/stores/agents'
import { useNotificationsStore } from '@/stores/notifications'
import { useProvidersStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'

const agentsStore = useAgentsStore()
const agentInstancesStore = useAgentInstancesStore()
const providersStore = useProvidersStore()
const settingsStore = useSettingsStore()
const notificationsStore = useNotificationsStore()

const activeTab = ref('agents')
const query = ref('')
const statusFilter = ref('all')
const editorOpen = ref(false)
const detailOpen = ref(false)
const selectedInstance = ref(null)
const deleteDialog = reactive({ open: false, agent: null })
const removeInstanceDialog = reactive({ open: false, instance: null })
const form = reactive(emptyForm())
const baseUrl = computed(() => settingsStore.settings.gateway.baseUrl)

const tabs = [
  { label: 'Agent 配置', value: 'agents' },
  { label: '运行实例', value: 'instances' },
]

const providerOptions = computed(() => [
  { label: '自动匹配供应商', value: '' },
  ...providersStore.items.map((provider) => ({
    label: `${provider.name} (${provider.type})`,
    value: provider.id,
  })),
])

const modelProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: '兼容接口', value: 'compatible' },
]

const transportOptions = [
  { label: 'WebSocket', value: 'websocket' },
  { label: 'HTTP/SSE', value: 'http' },
  { label: 'ACP stdio', value: 'acp' },
]

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
  { label: 'Ready', value: 'ready' },
  { label: 'Failed', value: 'failed' },
  { label: 'Stopped', value: 'stopped' },
]

const readyInstances = computed(() => agentInstancesStore.items.filter((item) => item.status === 'ready'))
const activeInstances = computed(() => agentInstancesStore.items.filter((item) => ['ready', 'starting', 'draining'].includes(item.status)))

const filteredAgents = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return agentsStore.items.filter((agent) => {
    if (statusFilter.value === 'enabled' && !agent.enabled) return false
    if (statusFilter.value === 'disabled' && agent.enabled) return false
    if (['ready', 'failed', 'stopped'].includes(statusFilter.value)) {
      if (!instancesForAgent(agent.id).some((instance) => instance.status === statusFilter.value)) return false
    }
    if (!keyword) return true
    return [agent.name, agent.id, agent.modelProvider, agent.modelName, providerLabel(agent.providerId)]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
  })
})

const filteredInstances = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return agentInstancesStore.items.filter((instance) => {
    if (['ready', 'failed', 'stopped'].includes(statusFilter.value) && instance.status !== statusFilter.value) return false
    if (!keyword) return true
    return [instance.name, instance.id, instance.agentId, instance.modelProvider, instance.modelName, instance.lastError]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
  })
})

function emptyForm() {
  return {
    editingId: '',
    id: '',
    name: '',
    providerId: '',
    modelProvider: 'openai',
    modelName: '',
    baseUrl: '',
    transport: 'websocket',
    commandArgs: '',
    systemPrompt: '',
    maxIterations: 0,
    toolWhitelist: '',
    networkAllow: '',
    mcpServerIds: '',
    skillIds: '',
    enabled: true,
  }
}

function listToText(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function agentName(agentId) {
  return agentsStore.items.find((item) => item.id === agentId)?.name || agentId
}

function providerLabel(providerId) {
  if (!providerId) return '自动匹配'
  return providersStore.items.find((item) => item.id === providerId)?.name || providerId
}

function providerHealth(agent) {
  if (agent.providerId) {
    const provider = providersStore.items.find((item) => item.id === agent.providerId)
    if (!provider) return { label: '未找到供应商', tone: 'warning' }
    if (!provider.enabled) return { label: '供应商停用', tone: 'warning' }
    if (!provider.apiKeySet) return { label: '缺少密钥', tone: 'warning' }
    return { label: provider.name, tone: 'success' }
  }
  const provider = providersStore.items.find((item) => item.enabled && item.type === agent.modelProvider)
  if (!provider) return { label: '未匹配供应商', tone: 'warning' }
  return { label: provider.name, tone: provider.apiKeySet ? 'success' : 'warning' }
}

function statusTone(status) {
  if (status === 'ready') return 'success'
  if (status === 'failed') return 'warning'
  if (status === 'draining') return 'accent'
  return 'default'
}

function instancesForAgent(agentId) {
  return agentInstancesStore.items.filter((instance) => instance.agentId === agentId)
}

function canRemoveInstance(instance) {
  return Boolean(instance && !['ready', 'starting', 'draining'].includes(instance.status))
}

function resetForm() {
  Object.assign(form, emptyForm())
}

function openCreateEditor() {
  resetForm()
  editorOpen.value = true
}

function openEditEditor(agent) {
  Object.assign(form, {
    editingId: agent.id,
    id: agent.id,
    name: agent.name || '',
    providerId: agent.providerId || '',
    modelProvider: agent.modelProvider || 'openai',
    modelName: agent.modelName || '',
    baseUrl: agent.baseUrl || '',
    transport: agent.transport || 'websocket',
    commandArgs: listToText(agent.commandArgs),
    systemPrompt: agent.systemPrompt || '',
    maxIterations: agent.maxIterations || 0,
    toolWhitelist: listToText(agent.toolWhitelist),
    networkAllow: listToText(agent.networkAllow),
    mcpServerIds: listToText(agent.mcpServerIds),
    skillIds: listToText(agent.skillIds),
    enabled: Boolean(agent.enabled),
  })
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

function openInstanceDetail(instance) {
  selectedInstance.value = instance
  detailOpen.value = true
}

async function refreshAll() {
  await Promise.all([
    providersStore.fetchProviders(baseUrl.value),
    agentsStore.fetchAgents(baseUrl.value),
    agentInstancesStore.fetchInstances(baseUrl.value),
  ])
}

async function saveAgent() {
  if (!form.name.trim()) {
    notificationsStore.error('请填写 Agent 名称。', { title: 'Agent 配置不完整' })
    return
  }

  const saved = await agentsStore.saveAgent(baseUrl.value, {
    ...form,
    name: form.name.trim(),
    id: form.id.trim(),
    providerId: form.providerId.trim(),
    modelProvider: form.modelProvider.trim(),
    modelName: form.modelName.trim(),
    baseUrl: form.baseUrl.trim(),
    transport: form.transport || 'websocket',
    commandArgs: form.commandArgs,
    systemPrompt: form.systemPrompt.trim(),
    maxIterations: Number(form.maxIterations) || 0,
  })
  notificationsStore.notify({
    title: form.editingId ? 'Agent 已更新' : 'Agent 已创建',
    message: saved.name,
    tone: 'success',
  })
  editorOpen.value = false
  resetForm()
}

function deleteAgent(agent) {
  deleteDialog.agent = agent
  deleteDialog.open = true
}

function closeDeleteDialog() {
  deleteDialog.open = false
  deleteDialog.agent = null
}

async function confirmDeleteAgent() {
  const agent = deleteDialog.agent
  if (!agent) return
  await agentsStore.removeAgent(baseUrl.value, agent.id)
  await agentInstancesStore.fetchInstances(baseUrl.value)
  notificationsStore.notify({ title: 'Agent 已删除', message: agent.name, tone: 'success' })
  closeDeleteDialog()
}

async function setDefaultAgent(agent) {
  await settingsStore.patch({ gateway: { defaultAgentId: agent.id } })
  notificationsStore.notify({ title: '默认 Agent 已更新', message: agent.name, tone: 'success' })
}

async function startAgent(agent) {
  const instance = await agentInstancesStore.startInstance(baseUrl.value, {
    agentId: agent.id,
    name: agent.name,
    transport: agent.transport || 'websocket',
    commandArgs: agent.commandArgs || [],
  })
  notificationsStore.notify({
    title: instance.status === 'failed' ? '实例启动失败' : 'Agent 实例已启动',
    message: instance.lastError || agent.name,
    tone: instance.status === 'failed' ? 'warning' : 'success',
  })
}

async function stopInstance(instance) {
  await agentInstancesStore.stopInstance(baseUrl.value, instance.id)
  notificationsStore.notify({ title: 'Agent 实例已关闭', message: instance.id, tone: 'success' })
}

async function restartInstance(instance) {
  await agentInstancesStore.restartInstance(baseUrl.value, instance.id)
  notificationsStore.notify({ title: 'Agent 实例已重启', message: instance.id, tone: 'success' })
}

async function drainInstance(instance) {
  await agentInstancesStore.drainInstance(baseUrl.value, instance.id)
  notificationsStore.notify({ title: 'Agent 实例已进入排空', message: instance.id, tone: 'success' })
}

function removeInstance(instance) {
  removeInstanceDialog.instance = instance
  removeInstanceDialog.open = true
}

function closeRemoveInstanceDialog() {
  removeInstanceDialog.open = false
  removeInstanceDialog.instance = null
}

async function confirmRemoveInstance() {
  const instance = removeInstanceDialog.instance
  if (!instance) return
  await agentInstancesStore.removeInstance(baseUrl.value, instance.id)
  notificationsStore.notify({ title: '实例记录已移除', message: instance.id, tone: 'success' })
  closeRemoveInstanceDialog()
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

onMounted(() => {
  if (baseUrl.value) {
    void refreshAll()
  }
})
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <div class="mx-auto max-w-7xl space-y-4">
      <header class="flex flex-col gap-3 border-b border-[color:var(--qq-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--qq-text-tertiary)]">Agents</p>
          <h2 class="mt-1 text-2xl font-semibold text-[color:var(--qq-text-primary)]">Agent 管理</h2>
        </div>
        <dl class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div class="flex items-baseline gap-2">
            <dt class="text-[color:var(--qq-text-tertiary)]">配置</dt>
            <dd class="text-lg font-semibold text-[color:var(--qq-text-primary)]">{{ agentsStore.items.length }}</dd>
          </div>
          <div class="flex items-baseline gap-2">
            <dt class="text-[color:var(--qq-text-tertiary)]">运行</dt>
            <dd class="text-lg font-semibold text-[color:var(--qq-text-primary)]">{{ activeInstances.length }}</dd>
          </div>
          <div class="flex items-baseline gap-2">
            <dt class="text-[color:var(--qq-text-tertiary)]">Ready</dt>
            <dd class="text-lg font-semibold text-[color:var(--qq-text-primary)]">{{ readyInstances.length }}</dd>
          </div>
        </dl>
      </header>

      <section class="py-1">
        <div class="grid gap-3 xl:grid-cols-[auto_minmax(260px,1fr)_150px_auto] xl:items-center">
          <QqTabs v-model="activeTab" :tabs="tabs" />
          <QqInput v-model="query" placeholder="搜索 Agent、实例、模型或错误">
            <template #prefix>
              <Search class="h-4 w-4" />
            </template>
          </QqInput>
          <QqSelect v-model="statusFilter" :options="statusOptions" />
          <div class="flex flex-wrap gap-2 xl:justify-end">
            <QqButton variant="secondary" :disabled="agentInstancesStore.loading || agentsStore.loading" @click="refreshAll">
              <RefreshCw class="h-4 w-4" />
              {{ agentInstancesStore.loading || agentsStore.loading ? '刷新中' : '刷新' }}
            </QqButton>
            <QqButton @click="openCreateEditor">
              <Plus class="h-4 w-4" />
              新建
            </QqButton>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'agents'" class="qq-panel overflow-hidden rounded-[8px]">
        <div class="scrollbar-thin overflow-x-auto">
          <table class="qq-table min-w-[1100px]">
            <thead>
              <tr>
                <th>Agent</th>
                <th>供应商</th>
                <th>模型</th>
                <th>实例</th>
                <th>默认</th>
                <th>更新</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="agent in filteredAgents" :key="agent.id">
                <td>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="qq-status-dot" :class="agent.enabled ? 'bg-emerald-500' : 'bg-slate-300'" />
                      <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ agent.name }}</p>
                      <QqTag>{{ agent.transport || 'websocket' }}</QqTag>
                    </div>
                    <p class="mt-1 break-all text-xs text-[color:var(--qq-text-tertiary)]">{{ agent.id }}</p>
                  </div>
                </td>
                <td><QqTag :tone="providerHealth(agent).tone">{{ providerHealth(agent).label }}</QqTag></td>
                <td class="text-sm text-[color:var(--qq-text-secondary)]">
                  {{ agent.modelProvider }} · {{ agent.modelName || '默认模型' }}
                </td>
                <td class="text-sm text-[color:var(--qq-text-secondary)]">{{ instancesForAgent(agent.id).length }}</td>
                <td>
                  <QqTag v-if="settingsStore.settings.gateway.defaultAgentId === agent.id" tone="accent">默认</QqTag>
                  <span v-else class="text-xs text-[color:var(--qq-text-tertiary)]">-</span>
                </td>
                <td class="text-xs text-[color:var(--qq-text-tertiary)]">{{ formatDate(agent.updatedAt) }}</td>
                <td>
                  <div class="flex justify-end gap-2">
                    <QqButton size="sm" :disabled="!agent.enabled || agentInstancesStore.startingAgentId === agent.id" @click="startAgent(agent)" aria-label="启动 Agent">
                      <Play class="h-4 w-4" />
                    </QqButton>
                    <QqButton variant="secondary" size="sm" @click="openEditEditor(agent)" aria-label="编辑 Agent">
                      <Pencil class="h-4 w-4" />
                    </QqButton>
                    <QqButton variant="ghost" size="sm" :disabled="settingsStore.settings.gateway.defaultAgentId === agent.id" @click="setDefaultAgent(agent)">
                      默认
                    </QqButton>
                    <QqButton variant="danger" size="sm" :disabled="agentsStore.deletingId === agent.id" @click="deleteAgent(agent)" aria-label="删除 Agent">
                      <Trash2 class="h-4 w-4" />
                    </QqButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!filteredAgents.length" class="border-t border-[color:var(--qq-border)] px-4 py-10 text-center text-sm text-[color:var(--qq-text-secondary)]">
          没有匹配的 Agent。
        </div>
      </section>

      <section v-else class="qq-panel overflow-hidden rounded-[8px]">
        <div class="scrollbar-thin overflow-x-auto">
          <table class="qq-table min-w-[1100px]">
            <thead>
              <tr>
                <th>实例</th>
                <th>状态</th>
                <th>模型</th>
                <th>供应商</th>
                <th>心跳</th>
                <th>错误</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="instance in filteredInstances" :key="instance.id">
                <td>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ instance.name || agentName(instance.agentId) }}</p>
                    <p class="mt-1 break-all text-xs text-[color:var(--qq-text-tertiary)]">{{ instance.id }}</p>
                    <p class="mt-1 text-xs text-[color:var(--qq-text-secondary)]">{{ agentName(instance.agentId) }}</p>
                  </div>
                </td>
                <td><QqTag :tone="statusTone(instance.status)">{{ instance.status }}</QqTag></td>
                <td class="text-sm text-[color:var(--qq-text-secondary)]">{{ instance.modelProvider || '-' }} · {{ instance.modelName || '-' }}</td>
                <td class="text-sm text-[color:var(--qq-text-secondary)]">{{ providerLabel(instance.providerId) }}</td>
                <td class="text-xs text-[color:var(--qq-text-tertiary)]">{{ formatDate(instance.lastHeartbeatAt || instance.updatedAt) }}</td>
                <td class="max-w-[260px] truncate text-xs text-[var(--qq-danger)]">{{ instance.lastError || '-' }}</td>
                <td>
                  <div class="flex justify-end gap-2">
                    <QqButton variant="secondary" size="sm" @click="openInstanceDetail(instance)" aria-label="查看实例">
                      <Eye class="h-4 w-4" />
                    </QqButton>
                    <QqButton variant="secondary" size="sm" :disabled="agentInstancesStore.actionId === instance.id" @click="restartInstance(instance)" aria-label="重启实例">
                      <RotateCw class="h-4 w-4" />
                    </QqButton>
                    <QqButton variant="ghost" size="sm" :disabled="agentInstancesStore.actionId === instance.id || instance.status === 'draining'" @click="drainInstance(instance)">
                      排空
                    </QqButton>
                    <QqButton variant="danger" size="sm" :disabled="agentInstancesStore.actionId === instance.id || instance.status === 'stopped'" @click="stopInstance(instance)" aria-label="停止实例">
                      <Square class="h-4 w-4" />
                    </QqButton>
                    <QqButton v-if="canRemoveInstance(instance)" variant="danger" size="sm" :disabled="agentInstancesStore.deletingId === instance.id" @click="removeInstance(instance)" aria-label="移除实例">
                      <Trash2 class="h-4 w-4" />
                    </QqButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!filteredInstances.length" class="border-t border-[color:var(--qq-border)] px-4 py-10 text-center text-sm text-[color:var(--qq-text-secondary)]">
          没有匹配的实例。
        </div>
      </section>
    </div>

    <QqModal v-model="editorOpen" :title="form.editingId ? '编辑 Agent' : '新建 Agent'" description="保存后启动实例会读取当前 Agent 与供应商快照。" @confirm="saveAgent">
      <div class="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="Agent ID" helper="留空自动生成；保存后不可修改。">
            <QqInput v-model="form.id" :disabled="Boolean(form.editingId)" placeholder="agent-main" />
          </QqFormField>
          <QqFormField label="名称" required>
            <QqInput v-model="form.name" placeholder="默认助手" />
          </QqFormField>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <QqFormField label="供应商">
            <QqSelect v-model="form.providerId" :options="providerOptions" />
          </QqFormField>
          <QqFormField label="类型">
            <QqSelect v-model="form.modelProvider" :options="modelProviderOptions" />
          </QqFormField>
          <QqFormField label="连接">
            <QqSelect v-model="form.transport" :options="transportOptions" />
          </QqFormField>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="模型">
            <QqInput v-model="form.modelName" placeholder="gpt-4o" />
          </QqFormField>
          <QqFormField label="Base URL 覆盖">
            <QqInput v-model="form.baseUrl" placeholder="留空使用供应商配置" />
          </QqFormField>
        </div>
        <QqFormField label="命令参数" helper="每行一个参数。">
          <QqTextarea v-model="form.commandArgs" :rows="3" placeholder="--runner-mode&#10;sdk" />
        </QqFormField>
        <QqFormField label="系统提示词">
          <QqTextarea v-model="form.systemPrompt" :rows="4" />
        </QqFormField>
        <div class="grid gap-4 md:grid-cols-3">
          <QqFormField label="最大迭代">
            <QqInput v-model="form.maxIterations" type="number" placeholder="0" />
          </QqFormField>
          <QqFormField label="工具白名单">
            <QqTextarea v-model="form.toolWhitelist" :rows="3" placeholder="bash&#10;grep" />
          </QqFormField>
          <QqFormField label="网络允许">
            <QqTextarea v-model="form.networkAllow" :rows="3" placeholder="api.openai.com" />
          </QqFormField>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="MCP Server IDs">
            <QqTextarea v-model="form.mcpServerIds" :rows="3" />
          </QqFormField>
          <QqFormField label="Skill IDs">
            <QqTextarea v-model="form.skillIds" :rows="3" />
          </QqFormField>
        </div>
        <QqSwitch v-model="form.enabled" label="启用 Agent" description="停用后不能启动新实例。" />
      </div>
      <template #footer>
        <QqButton variant="ghost" :disabled="agentsStore.saving" @click="closeEditor">
          <X class="h-4 w-4" />
          取消
        </QqButton>
        <QqButton :disabled="agentsStore.saving" @click="saveAgent">
          <Check class="h-4 w-4" />
          {{ agentsStore.saving ? '保存中' : '保存' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal v-model="detailOpen" description="实例启动时解析到的配置快照。" title="实例信息">
      <div v-if="selectedInstance" class="grid gap-3 text-sm">
        <div class="border-y border-[color:var(--qq-border)] py-3">
          <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Instance</p>
          <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ selectedInstance.id }}</p>
          <p class="mt-1 break-all text-[color:var(--qq-text-secondary)]">{{ selectedInstance.baseUrl || '无 Base URL' }}</p>
          <p class="mt-1">{{ selectedInstance.transport }}</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="border-y border-[color:var(--qq-border)] py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Agent</p>
            <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ agentName(selectedInstance.agentId) }}</p>
          </div>
          <div class="border-y border-[color:var(--qq-border)] py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Provider</p>
            <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ providerLabel(selectedInstance.providerId) }}</p>
          </div>
        </div>
        <div class="border-y border-[color:var(--qq-border)] py-3">
          <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Model</p>
          <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ selectedInstance.modelProvider || '-' }} · {{ selectedInstance.modelName || '-' }}</p>
          <p class="mt-1 break-all text-[color:var(--qq-text-secondary)]">{{ selectedInstance.modelBaseUrl || '默认 Base URL' }} · API Key {{ selectedInstance.apiKeySet ? '已传入' : '未配置' }}</p>
        </div>
      </div>
      <template #footer>
        <QqButton variant="ghost" @click="detailOpen = false">关闭</QqButton>
      </template>
    </QqModal>

    <QqModal v-model="deleteDialog.open" description="删除 Agent 配置不会删除历史会话。" title="删除 Agent">
      <div class="border-y border-[color:var(--qq-border)] py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteDialog.agent?.name || '-' }}</p>
        <p class="mt-1 break-all">ID {{ deleteDialog.agent?.id || '-' }}</p>
      </div>
      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(agentsStore.deletingId)" @click="closeDeleteDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(agentsStore.deletingId)" @click="confirmDeleteAgent">
          <Trash2 class="h-4 w-4" />
          {{ agentsStore.deletingId ? '删除中' : '删除' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal v-model="removeInstanceDialog.open" description="仅移除实例记录，不删除 Agent 配置。" title="移除实例记录">
      <div v-if="removeInstanceDialog.instance" class="border-y border-[color:var(--qq-border)] py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ removeInstanceDialog.instance.name }}</p>
        <p class="mt-1 break-all">{{ removeInstanceDialog.instance.id }}</p>
        <p class="mt-1">状态 {{ removeInstanceDialog.instance.status }}</p>
      </div>
      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(agentInstancesStore.deletingId)" @click="closeRemoveInstanceDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(agentInstancesStore.deletingId)" @click="confirmRemoveInstance">
          <Trash2 class="h-4 w-4" />
          {{ agentInstancesStore.deletingId ? '移除中' : '移除' }}
        </QqButton>
      </template>
    </QqModal>
  </section>
</template>
