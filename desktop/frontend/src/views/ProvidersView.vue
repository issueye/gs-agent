<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-vue-next'
import QqButton from '@/components/ued/QqButton.vue'
import QqFormField from '@/components/ued/QqFormField.vue'
import QqFormSection from '@/components/ued/QqFormSection.vue'
import QqInput from '@/components/ued/QqInput.vue'
import QqModal from '@/components/ued/QqModal.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import QqSwitch from '@/components/ued/QqSwitch.vue'
import { useNotificationsStore } from '@/stores/notifications'
import { useProvidersStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'

const providersStore = useProvidersStore()
const settingsStore = useSettingsStore()
const notificationsStore = useNotificationsStore()

const editorOpen = ref(false)
const form = reactive(emptyForm())
const deleteDialog = reactive({
  open: false,
  provider: null,
})
const baseUrl = computed(() => settingsStore.settings.gateway.baseUrl)
const activeProviders = computed(() => providersStore.items.filter((provider) => provider.enabled))
const configuredKeys = computed(() => providersStore.items.filter((provider) => provider.apiKeySet))

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
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
  await providersStore.fetchProviders(baseUrl.value)
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

  await providersStore.saveProvider(baseUrl.value, {
    ...form,
    name: form.name.trim(),
    type: form.type.trim(),
    baseUrl: form.baseUrl.trim(),
    defaultModel: form.defaultModel.trim(),
    apiKey: form.apiKey.trim(),
  })
  notificationsStore.notify({
    title: form.editingId ? '供应商已更新' : '供应商已创建',
    message: form.name.trim(),
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
  if (!provider) {
    return
  }
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

onMounted(() => {
  if (baseUrl.value) {
    void refreshProviders()
  }
})
</script>

<template>
  <section class="scrollbar-thin h-full overflow-y-auto px-5 py-5">
    <div class="mx-auto max-w-7xl space-y-5">
      <section class="qq-panel-strong rounded-[8px] px-5 py-5">
        <p class="text-xs uppercase tracking-[0.24em] text-[color:var(--qq-text-tertiary)]">Providers</p>
        <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 class="text-3xl font-semibold text-slate-50">供应商管理</h2>
            <p class="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--qq-text-secondary)]">
              API Key、Base URL 和默认模型由网关统一保存；Agent 可按供应商类型自动使用启用中的供应商配置。
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <QqButton variant="secondary" :disabled="providersStore.loading" @click="refreshProviders">
              <RefreshCw class="h-4 w-4" />
              {{ providersStore.loading ? '刷新中...' : '刷新' }}
            </QqButton>
            <QqButton @click="openCreateEditor">
              <Plus class="h-4 w-4" />
              新建供应商
            </QqButton>
          </div>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Providers</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ providersStore.items.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">Active</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ activeProviders.length }}</p>
          </div>
          <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-3">
            <p class="text-xs uppercase tracking-[0.16em] text-[color:var(--qq-text-tertiary)]">API Keys</p>
            <p class="mt-2 text-2xl font-semibold text-[color:var(--qq-text-primary)]">{{ configuredKeys.length }}</p>
          </div>
        </div>
      </section>

      <QqFormSection
        eyebrow="Directory"
        title="供应商列表"
        description="同类型可配置多个供应商；自动匹配会使用最近更新且启用的供应商。"
      >
        <div class="grid gap-3">
          <div
            v-if="!providersStore.items.length"
            class="rounded-[6px] border border-dashed border-white/15 bg-[rgba(9,32,28,0.16)] px-4 py-6 text-sm text-[color:var(--qq-text-secondary)]"
          >
            当前网关还没有供应商。创建一个供应商后，Agent 就可以复用它的密钥和接口地址。
          </div>

          <div
            v-for="provider in providersStore.items"
            :key="provider.id"
            class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-4 py-4"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-semibold text-[color:var(--qq-text-primary)]">{{ provider.name }}</p>
                  <span class="qq-badge rounded-[4px] px-2 py-0.5 text-[11px]">{{ provider.type }}</span>
                  <span
                    class="rounded-[4px] px-2 py-0.5 text-[11px]"
                    :class="provider.enabled ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-[color:var(--qq-text-tertiary)]'"
                  >
                    {{ provider.enabled ? '启用' : '停用' }}
                  </span>
                </div>
                <p class="mt-2 break-all text-xs leading-5 text-[color:var(--qq-text-tertiary)]">
                  ID {{ provider.id }}
                </p>
                <p class="mt-1 break-all text-xs leading-5 text-[color:var(--qq-text-secondary)]">
                  {{ provider.baseUrl || '默认接口地址' }} · {{ provider.defaultModel || '未设置默认模型' }}
                </p>
                <p class="mt-1 text-xs text-[color:var(--qq-text-tertiary)]">
                  API Key {{ provider.apiKeySet ? provider.apiKeyPreview || '已保存' : '未配置' }}
                </p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <QqButton variant="secondary" size="sm" @click="openEditEditor(provider)">
                  <Pencil class="h-4 w-4" />
                </QqButton>
                <QqButton
                  variant="danger"
                  size="sm"
                  :disabled="providersStore.deletingId === provider.id"
                  @click="deleteProvider(provider)"
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
      :description="form.editingId ? 'API Key 留空保存时不会覆盖已有密钥；修改后需要重启使用该供应商的 Agent 实例。' : '创建后 Agent 可以绑定该供应商，或按供应商类型自动匹配。'"
      :title="form.editingId ? '编辑供应商' : '新建供应商'"
      @confirm="saveProvider"
    >
      <div class="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
        <QqFormField label="供应商 ID" helper="可选。留空时网关会自动生成；保存后不可修改。">
          <QqInput v-model="form.id" :disabled="Boolean(form.editingId)" placeholder="例如：openai-main" />
        </QqFormField>

        <QqFormField label="名称" required>
          <QqInput v-model="form.name" placeholder="例如：OpenAI 主账号" />
        </QqFormField>

        <QqFormField label="类型" required helper="类型会用于匹配 Agent 的 model_provider。">
          <QqSelect v-model="form.type" :options="providerOptions" />
        </QqFormField>

        <QqFormField label="Base URL" helper="OpenAI 官方可留空；兼容接口填写形如 https://host/v1。">
          <QqInput v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
        </QqFormField>

        <QqFormField label="默认模型" helper="当 Agent 未填写模型名时使用。">
          <QqInput v-model="form.defaultModel" placeholder="例如：gpt-4o" />
        </QqFormField>

        <QqFormField label="API Key" helper="密钥只在保存时发送，列表中只显示脱敏状态。">
          <QqInput v-model="form.apiKey" type="password" placeholder="sk-..." />
        </QqFormField>

        <QqSwitch v-model="form.enabled" label="启用供应商" description="停用后不会被未绑定 provider_id 的 Agent 自动匹配。" />
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="providersStore.saving" @click="closeEditor">
          <X class="h-4 w-4" />
          取消
        </QqButton>
        <QqButton :disabled="providersStore.saving" @click="saveProvider">
          <Check class="h-4 w-4" />
          {{ providersStore.saving ? '保存中...' : '保存供应商' }}
        </QqButton>
      </template>
    </QqModal>

    <QqModal
      v-model="deleteDialog.open"
      description="删除后，绑定该供应商的 Agent 将无法继续使用这份 API Key 和 Base URL 配置。"
      title="删除供应商"
    >
      <div class="rounded-[6px] border border-white/10 bg-[rgba(9,32,28,0.18)] px-3 py-3 text-sm leading-6 text-[color:var(--qq-text-secondary)]">
        <p class="font-medium text-[color:var(--qq-text-primary)]">{{ deleteDialog.provider?.name || '未选择供应商' }}</p>
        <p class="mt-1 break-all">ID {{ deleteDialog.provider?.id || '-' }}</p>
        <p class="mt-1 break-all">{{ deleteDialog.provider?.baseUrl || '默认接口地址' }}</p>
      </div>

      <template #footer>
        <QqButton variant="ghost" :disabled="Boolean(providersStore.deletingId)" @click="closeDeleteDialog">取消</QqButton>
        <QqButton variant="danger" :disabled="Boolean(providersStore.deletingId)" @click="confirmDeleteProvider">
          <Trash2 class="h-4 w-4" />
          {{ providersStore.deletingId ? '删除中...' : '删除供应商' }}
        </QqButton>
      </template>
    </QqModal>
  </section>
</template>
