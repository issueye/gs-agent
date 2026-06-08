<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, Eye, Pencil, Play, Plus, RefreshCw, RotateCw, Square, Trash2, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqFormSection from '@/components/ued/QqFormSection.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
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

const editorOpen = ref(false)
const detailOpen = ref(false)
const selectedInstance = ref(null)
const deleteDialog = reactive({
  open: false,
  agent: null,
})
const removeInstanceDialog = reactive({
  open: false,
  instance: null,
})
const form = reactive(emptyForm())
const baseUrl = computed(() => settingsStore.settings.gateway.baseUrl)

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
]

const transportOptions = [
  { label: 'HTTP/SSE', value: 'http' },
  { label: 'ACP stdio', value: 'acp' },
]

const readyInstances = computed(() => agentInstancesStore.items.filter((item) => item.status === 'ready'))
const activeInstances = computed(() =>
  agentInstancesStore.items.filter((item) => ['ready', 'starting', 'draining'].includes(item.status)),
)

function emptyForm() {
  return {
    editingId: '',
    id: '',
    name: '',
    providerId: '',
    modelProvider: 'openai',
    modelName: '',
    baseUrl: '',
    transport: 'http',
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
  if (!providerId) {
    return '自动匹配'
  }
  return providersStore.items.find((item) => item.id === providerId)?.name || providerId
}

function statusClass(status) {
  if (status === 'ready') {
    return 'bg-emerald-300/15 text-emerald-100'
  }
  if (status === 'failed') {
    return 'bg-rose-300/15 text-rose-100'
  }
  if (status === 'draining') {
    return 'bg-amber-300/15 text-amber-100'
  }
  return 'bg-white/10 text-[color:var(--qq-text-secondary)]'
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
    transport: agent.transport || 'http',
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
    transport: form.transport || 'http',
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
  if (!agent) {
    return
  }
  await agentsStore.removeAgent(baseUrl.value, agent.id)
  await agentInstancesStore.fetchInstances(baseUrl.value)
  notificationsStore.notify({
    title: 'Agent 已删除',
    message: agent.name,
    tone: 'success',
  })
  closeDeleteDialog()
}

async function setDefaultAgent(agent) {
  await settingsStore.patch({
    gateway: {
      defaultAgentId: agent.id,
    },
  })
  notificationsStore.notify({
    title: '默认 Agent 已更新',
    message: agent.name,
    tone: 'success',
  })
}

async function startAgent(agent) {
  await agentInstancesStore.startInstance(baseUrl.value, {
    agentId: agent.id,
    name: agent.name,
    transport: agent.transport || 'http',
    commandArgs: agent.commandArgs || [],
  })
  notificationsStore.notify({
    title: 'Agent 实例已启动',
    message: agent.name,
    tone: 'success',
  })
}

async function stopInstance(instance) {
  await agentInstancesStore.stopInstance(baseUrl.value, instance.id)
  notificationsStore.notify({
    title: 'Agent 实例已关闭',
    message: instance.id,
    tone: 'success',
  })
}

async function restartInstance(instance) {
  await agentInstancesStore.restartInstance(baseUrl.value, instance.id)
  notificationsStore.notify({
    title: 'Agent 实例已重启',
    message: instance.id,
    tone: 'success',
  })
}

async function drainInstance(instance) {
  await agentInstancesStore.drainInstance(baseUrl.value, instance.id)
  notificationsStore.notify({
    title: 'Agent 实例已进入排空',
    message: instance.id,
    tone: 'success',
  })
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
  if (!instance) {
    return
  }
  await agentInstancesStore.removeInstance(baseUrl.value, instance.id)
  notificationsStore.notify({
    title: '实例记录已移除',
    message: instance.id,
    tone: 'success',
  })
  closeRemoveInstanceDialog()
}

onMounted(() => {
  if (baseUrl.value) {
    void refreshAll()
  }
})
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <div class="mx-auto max-w-7xl space-y-5">
      <section class="qq-panel-strong rounded-[8px] px-5 py-5">
        <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--qq-text-tertiary)]">Agents</p>
        <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="text-3xl font-semibold text-slate-50">Agent 管理</h2>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--qq-text-secondary)]">
              配置 Agent 绑定的供应商、模型和运行参数，然后手动启动、关闭或重启对应实例。
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <QqButton variant="secondary" :disabled="agentInstancesStore.loading || agentsStore.loading" @click="refreshAll">
              <RefreshCw class="h-4 w-4" />
              {{ agentInstancesStore.loading || agentsStore.loading ? '刷新中...' : '刷新' }}
            </QqButton>
            <QqButton @click="openCreateEditor">
              <Plus class="h-4 w-4" />
              新建 Agent
            </QqButton>
          </div>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Agents</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ agentsStore.items.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Active</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ activeInstances.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Ready</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ readyInstances.length }}</p>
          </div>
        </div>
      </section>

      <div class="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <QqFormSection
          eyebrow="Profiles"
          title="Agent 配置"
          description="API Key 由供应商保存；Agent 可绑定供应商，也可以填写 Base URL 作为覆盖项。"
        >
          <div class="grid gap-3">
            <div
              v-if="!agentsStore.items.length"
              class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
            >
              当前没有 Agent。先新建一个 Agent，并绑定已配置 API Key 的供应商。
            </div>

            <div
              v-for="agent in agentsStore.items"
              :key="agent.id"
              class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ agent.name }}</p>
                    <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ agent.modelProvider || 'openai' }}</span>
                    <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ agent.transport || 'http' }}</span>
                    <span
                      class="rounded-[4px] px-2 py-0.5 text-[11px]"
                      :class="agent.enabled ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-[color:var(--qq-text-tertiary)]'"
                    >
                      {{ agent.enabled ? '启用' : '停用' }}
                    </span>
                    <span
                      v-if="settingsStore.settings.gateway.defaultAgentId === agent.id"
                      class="rounded-[4px] bg-[rgba(72,255,209,0.15)] px-2 py-0.5 text-[11px] text-[color:var(--qq-accent)]"
                    >
                      默认
                    </span>
                  </div>
                  <p class="mt-2 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">ID {{ agent.id }}</p>
                  <p class="mt-1 break-all text-xs leading-5 text-[color:var(--qq-text-secondary)]">
                    {{ providerLabel(agent.providerId) }} · {{ agent.modelName || '使用供应商默认模型' }} · {{ agent.transport || 'http' }}
                  </p>
                  <p class="mt-1 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">
                    {{ agent.baseUrl || '不覆盖 Base URL' }}
                  </p>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                  <QqButton
                    size="sm"
                    :disabled="!agent.enabled || agentInstancesStore.startingAgentId === agent.id"
                    @click="startAgent(agent)"
                  >
                    <Play class="h-4 w-4" />
                  </QqButton>
                  <QqButton variant="secondary" size="sm" @click="openEditEditor(agent)">
                    <Pencil class="h-4 w-4" />
                  </QqButton>
                  <QqButton
                    variant="ghost"
                    size="sm"
                    :disabled="settingsStore.settings.gateway.defaultAgentId === agent.id"
                    @click="setDefaultAgent(agent)"
                  >
                    默认
                  </QqButton>
                  <QqButton
                    variant="danger"
                    size="sm"
                    :disabled="agentsStore.deletingId === agent.id"
                    @click="deleteAgent(agent)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </QqButton>
                </div>
              </div>
            </div>
          </div>
        </QqFormSection>

        <QqFormSection
          eyebrow="Runtime"
          title="Agent 实例"
          description="实例启动时会读取 Agent 与供应商配置，并把模型信息传入 Agent 进程；修改配置后重启实例即可刷新启动参数。"
        >
          <div class="grid gap-3">
            <div
              v-if="!agentInstancesStore.items.length"
              class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
            >
              当前没有运行中的 Agent 实例。点击 Agent 列表里的启动按钮手动启动。
            </div>

            <div
              v-for="instance in agentInstancesStore.items"
              :key="instance.id"
              class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-4"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ instance.name || agentName(instance.agentId) }}</p>
                    <span class="rounded-[4px] px-2 py-0.5 text-[11px]" :class="statusClass(instance.status)">
                      {{ instance.status }}
                    </span>
                    <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">PID {{ instance.pid || '-' }}</span>
                    <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ instance.transport || 'http' }}</span>
                  </div>
                  <p class="mt-2 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">
                    {{ instance.id }} · {{ instance.baseUrl }}
                  </p>
                  <p class="mt-1 break-all text-xs leading-5 text-[color:var(--qq-text-secondary)]">
                    {{ providerLabel(instance.providerId) }} · {{ instance.modelProvider || 'openai' }} · {{ instance.modelName || '未设置模型' }}
                  </p>
                  <p v-if="instance.lastError" class="mt-1 text-xs text-[var(--qq-danger)]">
                    {{ instance.lastError }}
                  </p>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                  <QqButton variant="secondary" size="sm" @click="openInstanceDetail(instance)">
                    <Eye class="h-4 w-4" />
                  </QqButton>
                  <QqButton
                    variant="secondary"
                    size="sm"
                    :disabled="agentInstancesStore.actionId === instance.id"
                    @click="restartInstance(instance)"
                  >
                    <RotateCw class="h-4 w-4" />
                  </QqButton>
                  <QqButton
                    variant="ghost"
                    size="sm"
                    :disabled="agentInstancesStore.actionId === instance.id || instance.status === 'draining'"
                    @click="drainInstance(instance)"
                  >
                    排空
                  </QqButton>
                  <QqButton
                    variant="danger"
                    size="sm"
                    :disabled="agentInstancesStore.actionId === instance.id || instance.status === 'stopped'"
                    @click="stopInstance(instance)"
                  >
                    <Square class="h-4 w-4" />
                  </QqButton>
                  <QqButton
                    v-if="canRemoveInstance(instance)"
                    variant="danger"
                    size="sm"
                    :disabled="agentInstancesStore.deletingId === instance.id"
                    @click="removeInstance(instance)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </QqButton>
                </div>
              </div>
            </div>
          </div>
        </QqFormSection>
      </div>
    </div>

    <QqModal
      v-model="editorOpen"
      :description="form.editingId ? '修改后需要重启已运行实例，新的供应商和模型参数才会在进程启动环境中生效。' : '创建 Agent 后，可以在列表中手动启动对应实例。'"
      :title="form.editingId ? '编辑 Agent' : '新建 Agent'"
      @confirm="saveAgent"
    >
      <div class="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
        <QqFormField label="Agent ID" helper="可选。留空时网关自动生成；保存后不可修改。">
          <QqInput v-model="form.id" :disabled="Boolean(form.editingId)" placeholder="例如：agent-main" />
        </QqFormField>

        <QqFormField label="名称" required>
          <QqInput v-model="form.name" placeholder="例如：默认助手" />
        </QqFormField>

        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="供应商" helper="API Key 在供应商模块维护。">
            <QqSelect v-model="form.providerId" :options="providerOptions" />
          </QqFormField>
          <QqFormField label="供应商类型">
            <QqSelect v-model="form.modelProvider" :options="modelProviderOptions" />
          </QqFormField>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="模型" helper="留空时使用供应商默认模型。">
            <QqInput v-model="form.modelName" placeholder="例如：gpt-4o" />
          </QqFormField>
          <QqFormField label="Base URL 覆盖" helper="留空时使用供应商 Base URL。">
            <QqInput v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
          </QqFormField>
        </div>

        <QqFormField label="连接方式" helper="HTTP/SSE 使用本地端口；ACP 通过标准输入输出连接 Agent。">
          <QqSelect v-model="form.transport" :options="transportOptions" />
        </QqFormField>

        <QqFormField label="命令参数" helper="每行一个参数，会追加到网关自动生成的启动参数之后。">
          <QqTextarea v-model="form.commandArgs" :rows="3" placeholder="例如：--runner-mode&#10;sdk" />
        </QqFormField>

        <QqFormField label="系统提示词">
          <QqTextarea v-model="form.systemPrompt" :rows="4" placeholder="输入该 Agent 的默认系统提示词" />
        </QqFormField>

        <QqFormField label="最大迭代次数" helper="0 表示使用运行时默认值。">
          <QqInput v-model="form.maxIterations" type="number" placeholder="0" />
        </QqFormField>

        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="工具白名单" helper="每行一个工具名。">
            <QqTextarea v-model="form.toolWhitelist" :rows="3" placeholder="bash&#10;apply_patch" />
          </QqFormField>
          <QqFormField label="网络允许列表" helper="每行一个域名或地址。">
            <QqTextarea v-model="form.networkAllow" :rows="3" placeholder="api.openai.com" />
          </QqFormField>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="MCP Server IDs" helper="每行一个 ID。">
            <QqTextarea v-model="form.mcpServerIds" :rows="3" placeholder="filesystem" />
          </QqFormField>
          <QqFormField label="Skill IDs" helper="每行一个 ID。">
            <QqTextarea v-model="form.skillIds" :rows="3" placeholder="openai-docs" />
          </QqFormField>
        </div>

        <QqSwitch v-model="form.enabled" label="启用 Agent" description="停用后不能从桌面端启动新的实例。" />
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="agentsStore.saving" @click="closeEditor">
          <X class="h-4 w-4" />
          取消
        </QqButton>
        <QqButton :disabled="agentsStore.saving" @click="saveAgent">
          <Check class="h-4 w-4" />
          {{ agentsStore.saving ? '保存中...' : '保存 Agent' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="detailOpen"
      description="这里显示该实例启动时解析到的供应商和模型快照。"
      title="实例信息"
    >
      <div v-if="selectedInstance" class="grid gap-3 text-sm">
        <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
          <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Instance</p>
          <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ selectedInstance.id }}</p>
          <p class="mt-1 break-all text-[color:var(--qq-text-secondary)]">{{ selectedInstance.baseUrl }}</p>
          <p class="mt-1 break-all text-[color:var(--qq-text-secondary)]">{{ selectedInstance.transport || 'http' }}</p>
          <p
            v-if="selectedInstance.commandArgs?.length"
            class="mt-1 break-all text-[color:var(--qq-text-secondary)]"
          >
            {{ selectedInstance.commandArgs.join(' ') }}
          </p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Agent</p>
            <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ agentName(selectedInstance.agentId) }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Provider</p>
            <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">{{ providerLabel(selectedInstance.providerId) }}</p>
          </div>
        </div>
        <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3">
          <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Model</p>
          <p class="mt-2 break-all text-[color:var(--qq-text-primary)]">
            {{ selectedInstance.modelProvider || 'openai' }} · {{ selectedInstance.modelName || '未设置模型' }}
          </p>
          <p class="mt-1 break-all text-[color:var(--qq-text-secondary)]">
            {{ selectedInstance.modelBaseUrl || '默认 Base URL' }} · API Key {{ selectedInstance.apiKeySet ? '已传入' : '未配置' }}
          </p>
        </div>
      </div>

      <template #footer>
        <QqButton variant="ghost" @click="detailOpen = false">关闭</QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="deleteDialog.open"
      description="删除后该 Agent 配置会从网关移除，已保存的会话不会被删除。"
      title="删除 Agent"
    >
      <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteDialog.agent?.name || '未选择 Agent' }}</p>
        <p class="mt-1 break-all">ID {{ deleteDialog.agent?.id || '-' }}</p>
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(agentsStore.deletingId)" @click="closeDeleteDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(agentsStore.deletingId)" @click="confirmDeleteAgent">
          <Trash2 class="h-4 w-4" />
          {{ agentsStore.deletingId ? '删除中...' : '删除 Agent' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="removeInstanceDialog.open"
      description="移除只会清理这条实例记录，不会删除 Agent 配置。运行中或排空中的实例需要先关闭后再移除。"
      title="移除实例记录"
    >
      <div
        v-if="removeInstanceDialog.instance"
        class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]"
      >
        <p class="font-medium text-[color:var(--qq-text-primary)]">
          {{ removeInstanceDialog.instance.name || agentName(removeInstanceDialog.instance.agentId) }}
        </p>
        <p class="mt-1 break-all">{{ removeInstanceDialog.instance.id }}</p>
        <p class="mt-1 break-all">{{ removeInstanceDialog.instance.baseUrl || '无地址' }}</p>
        <p class="mt-1">状态 {{ removeInstanceDialog.instance.status }}</p>
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(agentInstancesStore.deletingId)" @click="closeRemoveInstanceDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(agentInstancesStore.deletingId)" @click="confirmRemoveInstance">
          <Trash2 class="h-4 w-4" />
          {{ agentInstancesStore.deletingId ? '移除中...' : '移除记录' }}
        </QqButton>
      </template>
    </QqModal>
  </section>
</template>
