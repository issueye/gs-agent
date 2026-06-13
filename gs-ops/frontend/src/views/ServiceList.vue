<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-xl font-semibold">服务管理</h2>
        <p class="text-sm text-slate-500">安装、启动、停止、重启并查看托管服务。</p>
      </div>
      <div class="flex gap-2">
        <AppButton :icon="PackagePlus" @click="openCreateModal">安装服务</AppButton>
        <AppButton :icon="RefreshCw" variant="neutral" @click="services.loadServices()">刷新</AppButton>
      </div>
    </div>

    <div class="rounded-lg border border-line bg-white p-3 shadow-panel">
      <label class="relative block">
        <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          v-model="query"
          class="focus-ring h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm"
          placeholder="搜索服务"
          type="search"
        />
      </label>
    </div>

    <Loading v-if="services.loading" />
    <ServiceTable v-else :services="filteredServices" @action="handleAction" />

    <Modal :open="createOpen" title="安装服务" @close="closeCreateModal">
      <form class="space-y-4" @submit.prevent="submitCreate">
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase text-slate-500" for="template">模板</label>
          <select
            id="template"
            v-model="form.templateId"
            class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm"
            @change="applyTemplateDefaults"
          >
            <option v-for="template in services.templates" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>
          <p v-if="selectedTemplate" class="mt-1 text-xs text-slate-500">{{ selectedTemplate.description }}</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">服务 ID</span>
            <input
              v-model.trim="form.id"
              class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm"
              placeholder="billing-api"
              required
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">进程名称</span>
            <input
              v-model.trim="form.name"
              class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm"
              placeholder="gs-billing-api"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">显示名称</span>
            <input
              v-model.trim="form.displayName"
              class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm"
              placeholder="计费 API"
              required
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">端口</span>
            <input
              v-model.number="form.port"
              class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm"
              max="65535"
              min="1"
              required
              type="number"
            />
          </label>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">描述</span>
          <textarea
            v-model.trim="form.description"
            class="focus-ring min-h-20 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm"
            placeholder="说明这个服务的用途"
          />
        </label>

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">安装路径</span>
            <input v-model.trim="form.installPath" class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">配置路径</span>
            <input v-model.trim="form.configPath" class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase text-slate-500">日志路径</span>
            <input v-model.trim="form.logPath" class="focus-ring h-9 w-full rounded-md border border-line bg-white px-3 text-sm" />
          </label>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.autoStart" class="focus-ring h-4 w-4 rounded border-line text-accent" type="checkbox" />
          主机启动后自动启动
        </label>

        <p v-if="createError" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ createError }}
        </p>
      </form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <AppButton variant="neutral" @click="closeCreateModal">取消</AppButton>
          <AppButton :disabled="creating" :icon="PackagePlus" @click="submitCreate">
            {{ creating ? '安装中' : '安装' }}
          </AppButton>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { PackagePlus, RefreshCw, Search } from 'lucide-vue-next'
import AppButton from '../components/common/AppButton.vue'
import Loading from '../components/common/Loading.vue'
import Modal from '../components/common/Modal.vue'
import ServiceTable from '../components/service/ServiceTable.vue'
import { useServiceStore } from '../stores/service'

const query = ref('')
const services = useServiceStore()
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const form = ref(defaultForm())

const filteredServices = computed(() => {
  const value = query.value.trim().toLowerCase()
  if (!value) return services.services
  return services.services.filter((service) =>
    [service.name, service.displayName, service.description].some((field) => String(field || '').toLowerCase().includes(value)),
  )
})

const selectedTemplate = computed(() => services.templates.find((template) => template.id === form.value.templateId))

onMounted(() => {
  services.loadServices()
  services.loadTemplates().then(() => {
    if (!form.value.templateId && services.templates.length > 0) {
      form.value.templateId = services.templates[0].id
      applyTemplateDefaults()
    }
  })
})

async function handleAction(id, action) {
  await services.action(id, action)
}

function defaultForm() {
  return {
    templateId: '',
    id: '',
    name: '',
    displayName: '',
    description: '',
    installPath: '',
    configPath: '',
    logPath: '',
    port: 8080,
    autoStart: false,
  }
}

function openCreateModal() {
  createError.value = ''
  createOpen.value = true
  if (!form.value.templateId && services.templates.length > 0) {
    form.value.templateId = services.templates[0].id
    applyTemplateDefaults()
  }
}

function closeCreateModal() {
  if (creating.value) return
  createOpen.value = false
}

function applyTemplateDefaults() {
  const template = selectedTemplate.value
  if (!template) return
  const defaults = template.defaults || {}
  form.value.port = defaults.port || form.value.port
  form.value.autoStart = defaults.autoStart === true
  form.value.installPath = defaults.installPath || ''
  form.value.configPath = defaults.configPath || ''
  form.value.logPath = defaults.logPath || ''
  if (!form.value.description) form.value.description = template.description || ''
}

async function submitCreate() {
  if (creating.value) return
  createError.value = ''
  creating.value = true
  try {
    await services.create({
      ...form.value,
      name: form.value.name || form.value.id,
    })
    form.value = defaultForm()
    if (services.templates.length > 0) {
      form.value.templateId = services.templates[0].id
      applyTemplateDefaults()
    }
    createOpen.value = false
  } catch (error) {
    createError.value = error.message
  } finally {
    creating.value = false
  }
}
</script>
