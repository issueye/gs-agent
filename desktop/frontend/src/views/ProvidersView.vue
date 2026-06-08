<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, KeyRound, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
import QqTag from '@/components/ued/QqTag.vue'
import { useAgentsStore } from '@/stores/agents'
import { useNotificationsStore } from '@/stores/notifications'
import { useProvidersStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'

const providersStore = useProvidersStore()
const agentsStore = useAgentsStore()
const settingsStore = useSettingsStore()
const notificationsStore = useNotificationsStore()

const editorOpen = ref(false)
const query = ref('')
const typeFilter = ref('all')
const stateFilter = ref('all')
const form = reactive(emptyForm())
const deleteDialog = reactive({
  open: false,
  provider: null,
})

const baseUrl = computed(() => settingsStore.settings.gateway.baseUrl)
const activeProviders = computed(() => providersStore.items.filter((provider) => provider.enabled))
const configuredKeys = computed(() => providersStore.items.filter((provider) => provider.apiKeySet))
const providerTypes = computed(() => [...new Set(providersStore.items.map((provider) => provider.type).filter(Boolean))])

const filteredProviders = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return providersStore.items.filter((provider) => {
    if (typeFilter.value !== 'all' && provider.type !== typeFilter.value) return false
    if (stateFilter.value === 'enabled' && !provider.enabled) return false
    if (stateFilter.value === 'disabled' && provider.enabled) return false
    if (stateFilter.value === 'missing-key' && provider.apiKeySet) return false
    if (!keyword) return true
    return [provider.name, provider.id, provider.type, provider.baseUrl, provider.defaultModel]
      .some((value) => String(value || '').toLowerCase().includes(keyword))
  })
})

const typeOptions = computed(() => [
  { label: '全部类型', value: 'all' },
  ...providerTypes.value.map((type) => ({ label: type, value: type })),
])

const stateOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
  { label: '缺少密钥', value: 'missing-key' },
]

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: '兼容接口', value: 'compatible' },
]

function emptyForm() {
  return {
    editingId: '',
    id: '',
    name: '',
    type: 'openai',
    baseUrl: '',
    defaultModel: '',
    apiKey: '',
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

function openEditEditor(provider) {
  Object.assign(form, {
    editingId: provider.id,
    id: provider.id,
    name: provider.name || '',
    type: provider.type || 'openai',
    baseUrl: provider.baseUrl || '',
    defaultModel: provider.defaultModel || '',
    apiKey: '',
    enabled: Boolean(provider.enabled),
  })
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

async function refreshProviders() {
  await Promise.all([
    providersStore.fetchProviders(baseUrl.value),
    agentsStore.fetchAgents(baseUrl.value).catch(() => []),
  ])
}

async function saveProvider() {
  if (!form.name.trim()) {
    notificationsStore.error('请填写供应商名称。', { title: '供应商配置不完整' })
    return
  }
  if (!form.type.trim()) {
    notificationsStore.error('请选择供应商类型。', { title: '供应商配置不完整' })
    return
  }

  const saved = await providersStore.saveProvider(baseUrl.value, {
    ...form,
    id: form.id.trim(),
    name: form.name.trim(),
    type: form.type.trim(),
    baseUrl: form.baseUrl.trim(),
    defaultModel: form.defaultModel.trim(),
    apiKey: form.apiKey.trim(),
  })
  notificationsStore.notify({
    title: form.editingId ? '供应商已更新' : '供应商已创建',
    message: saved.name,
    tone: 'success',
  })
  closeEditor()
  resetForm()
}

function deleteProvider(provider) {
  deleteDialog.provider = provider
  deleteDialog.open = true
}

function closeDeleteDialog() {
  deleteDialog.open = false
  deleteDialog.provider = null
}

async function confirmDeleteProvider() {
  const provider = deleteDialog.provider
  if (!provider) return
  await providersStore.removeProvider(baseUrl.value, provider.id)
  notificationsStore.notify({
    title: '供应商已删除',
    message: provider.name,
    tone: 'success',
  })
  if (form.editingId === provider.id) {
    closeEditor()
    resetForm()
  }
  closeDeleteDialog()
}

function agentUsage(providerId) {
  return agentsStore.items.filter((agent) => agent.providerId === providerId).length
}

function providerHealth(provider) {
  if (!provider.enabled) return { label: '停用', tone: 'default' }
  if (!provider.apiKeySet) return { label: '缺少密钥', tone: 'warning' }
  return { label: '可用', tone: 'success' }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-'
}

onMounted(() => {
  if (baseUrl.value) {
    void refreshProviders()
  }
})
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <div class="mx-auto max-w-7xl space-y-4">
      <section class="qq-panel-strong rounded-[8px] px-4 py-4">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--qq-text-tertiary)]">Providers</p>
            <h2 class="mt-1 text-2xl font-semibold text-[color:var(--qq-text-primary)]">供应商管理</h2>
          </div>
          <div class="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
            <div class="rounded-[6px] border border-[color:var(--qq-border)] bg-white/55 px-3 py-2">
              <p class="text-xs text-[color:var(--qq-text-tertiary)]">总数</p>
              <p class="mt-1 text-xl font-semibold">{{ providersStore.items.length }}</p>
            </div>
            <div class="rounded-[6px] border border-[color:var(--qq-border)] bg-white/55 px-3 py-2">
              <p class="text-xs text-[color:var(--qq-text-tertiary)]">启用</p>
              <p class="mt-1 text-xl font-semibold">{{ activeProviders.length }}</p>
            </div>
            <div class="rounded-[6px] border border-[color:var(--qq-border)] bg-white/55 px-3 py-2">
              <p class="text-xs text-[color:var(--qq-text-tertiary)]">密钥</p>
              <p class="mt-1 text-xl font-semibold">{{ configuredKeys.length }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="qq-panel rounded-[8px] px-4 py-4">
        <div class="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_170px_150px_auto] xl:items-center">
          <QqInput v-model="query" placeholder="搜索名称、ID、模型或 Base URL">
            <template #prefix>
              <Search class="h-4 w-4" />
            </template>
          </QqInput>
          <QqSelect v-model="typeFilter" :options="typeOptions" />
          <QqSelect v-model="stateFilter" :options="stateOptions" />
          <div class="flex flex-wrap gap-2 xl:justify-end">
            <QqButton variant="secondary" :disabled="providersStore.loading" @click="refreshProviders">
              <RefreshCw class="h-4 w-4" />
              {{ providersStore.loading ? '刷新中' : '刷新' }}
            </QqButton>
            <QqButton @click="openCreateEditor">
              <Plus class="h-4 w-4" />
              新建
            </QqButton>
          </div>
        </div>
      </section>

      <section class="qq-panel overflow-hidden rounded-[8px]">
        <div class="scrollbar-thin overflow-x-auto">
          <table class="qq-table min-w-[980px]">
            <thead>
              <tr>
                <th>供应商</th>
                <th>类型</th>
                <th>模型</th>
                <th>密钥</th>
                <th>Agent</th>
                <th>更新</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="provider in filteredProviders" :key="provider.id">
                <td class="align-top">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span
                        class="qq-status-dot"
                        :class="provider.enabled && provider.apiKeySet ? 'bg-emerald-500' : provider.enabled ? 'bg-amber-500' : 'bg-slate-300'"
                      />
                      <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ provider.name }}</p>
                    </div>
                    <p class="mt-1 break-all text-xs text-[color:var(--qq-text-tertiary)]">{{ provider.id }}</p>
                    <p class="mt-1 max-w-[340px] truncate text-xs text-[color:var(--qq-text-secondary)]">
                      {{ provider.baseUrl || '默认接口地址' }}
                    </p>
                  </div>
                </td>
                <td><QqTag>{{ provider.type }}</QqTag></td>
                <td class="text-sm text-[color:var(--qq-text-secondary)]">{{ provider.defaultModel || '-' }}</td>
                <td>
                  <QqTag :tone="providerHealth(provider).tone">
                    <KeyRound class="h-3.5 w-3.5" />
                    {{ provider.apiKeySet ? provider.apiKeyPreview || '已保存' : providerHealth(provider).label }}
                  </QqTag>
                </td>
                <td class="text-sm text-[color:var(--qq-text-secondary)]">{{ agentUsage(provider.id) }}</td>
                <td class="text-xs text-[color:var(--qq-text-tertiary)]">{{ formatDate(provider.updatedAt) }}</td>
                <td>
                  <div class="flex justify-end gap-2">
                    <QqButton variant="secondary" size="sm" @click="openEditEditor(provider)" aria-label="编辑供应商">
                      <Pencil class="h-4 w-4" />
                    </QqButton>
                    <QqButton
                      variant="danger"
                      size="sm"
                      :disabled="providersStore.deletingId === provider.id"
                      @click="deleteProvider(provider)"
                      aria-label="删除供应商"
                    >
                      <Trash2 class="h-4 w-4" />
                    </QqButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="!filteredProviders.length"
          class="border-t border-[color:var(--qq-border)] px-4 py-10 text-center text-sm text-[color:var(--qq-text-secondary)]"
        >
          没有匹配的供应商。
        </div>
      </section>
    </div>

    <QqModal
      v-model="editorOpen"
      :description="form.editingId ? 'API Key 留空不会覆盖已保存密钥。' : '保存后 Agent 可以绑定该供应商。'"
      :title="form.editingId ? '编辑供应商' : '新建供应商'"
      @confirm="saveProvider"
    >
      <div class="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="供应商 ID" helper="留空自动生成；保存后不可修改。">
            <QqInput v-model="form.id" :disabled="Boolean(form.editingId)" placeholder="openai-main" />
          </QqFormField>
          <QqFormField label="类型" required>
            <QqSelect v-model="form.type" :options="providerOptions" />
          </QqFormField>
        </div>
        <QqFormField label="名称" required>
          <QqInput v-model="form.name" placeholder="OpenAI 主账号" />
        </QqFormField>
        <div class="grid gap-4 md:grid-cols-2">
          <QqFormField label="Base URL">
            <QqInput v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
          </QqFormField>
          <QqFormField label="默认模型">
            <QqInput v-model="form.defaultModel" placeholder="gpt-4o" />
          </QqFormField>
        </div>
        <QqFormField label="API Key" helper="密钥只在保存时发送，列表只显示脱敏状态。">
          <QqInput v-model="form.apiKey" type="password" placeholder="sk-..." />
        </QqFormField>
        <QqSwitch v-model="form.enabled" label="启用供应商" description="停用后不会被 Agent 自动匹配。" />
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="providersStore.saving" @click="closeEditor">
          <X class="h-4 w-4" />
          取消
        </QqButton>
        <QqButton :disabled="providersStore.saving" @click="saveProvider">
          <Check class="h-4 w-4" />
          {{ providersStore.saving ? '保存中' : '保存' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="deleteDialog.open"
      description="删除后，绑定该供应商的 Agent 会失去这份模型配置。"
      title="删除供应商"
    >
      <div class="rounded-[6px] border border-[color:var(--qq-border)] bg-white/60 px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteDialog.provider?.name || '-' }}</p>
        <p class="mt-1 break-all">ID {{ deleteDialog.provider?.id || '-' }}</p>
        <p class="mt-1">关联 Agent {{ deleteDialog.provider ? agentUsage(deleteDialog.provider.id) : 0 }}</p>
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(providersStore.deletingId)" @click="closeDeleteDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(providersStore.deletingId)" @click="confirmDeleteProvider">
          <Trash2 class="h-4 w-4" />
          {{ providersStore.deletingId ? '删除中' : '删除' }}
        </QqButton>
      </template>
    </QqModal>
  </section>
</template>
