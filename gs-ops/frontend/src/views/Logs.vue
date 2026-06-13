<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-xl font-semibold">操作日志</h2>
      <p class="text-sm text-slate-500">最近的服务操作审计记录。</p>
    </div>

    <div class="flex flex-col gap-3 rounded-lg border border-line bg-white p-3 shadow-panel sm:flex-row">
      <label class="relative block flex-1">
        <Search class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          v-model="query"
          class="focus-ring h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm"
          placeholder="搜索操作、状态、消息或操作人"
          type="search"
          @keyup.enter="loadLogs"
        />
      </label>
      <AppButton :icon="Search" variant="neutral" @click="loadLogs">搜索</AppButton>
      <AppButton :icon="Trash2" variant="danger" :disabled="!selectedId" @click="clearLogs">清理</AppButton>
    </div>

    <div class="grid gap-4 lg:grid-cols-[280px_1fr]">
      <section class="rounded-lg border border-line bg-white p-3 shadow-panel">
        <button
          v-for="service in services.services"
          :key="service.id"
          class="focus-ring flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
          :class="{ 'bg-blue-50 text-accent': selectedId === service.id }"
          @click="selectService(service.id)"
        >
          <span>{{ service.displayName }}</span>
          <ServiceStatus :status="service.status" />
        </button>
      </section>

      <section class="rounded-lg border border-line bg-slate-950 p-4 font-mono text-sm text-slate-100 shadow-panel">
        <div v-if="logs.length === 0" class="text-slate-400">暂无日志。</div>
        <div v-for="entry in logs" :key="entry.id" class="border-b border-white/10 py-2 last:border-0">
          <span class="text-blue-300">{{ formatDateTime(entry.timestamp) }}</span>
          <span class="text-emerald-300"> {{ formatStatus(entry.status) }}</span>
          <span> {{ formatAction(entry.operation) }}</span>
          <span class="text-slate-400"> 操作人 {{ entry.operator }}</span>
          <p class="mt-1 text-slate-300">{{ formatLogMessage(entry.message) }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Search, Trash2 } from 'lucide-vue-next'
import { clearServiceLogs, searchServiceLogs } from '../api/log'
import AppButton from '../components/common/AppButton.vue'
import ServiceStatus from '../components/service/ServiceStatus.vue'
import { useServiceStore } from '../stores/service'
import { formatAction, formatDateTime, formatLogMessage, formatStatus } from '../utils/format'

const services = useServiceStore()
const selectedId = ref('')
const logs = ref([])
const query = ref('')

onMounted(async () => {
  await services.loadServices()
  if (services.services[0]) {
    await selectService(services.services[0].id)
  }
})

async function selectService(id) {
  selectedId.value = id
  await loadLogs()
}

async function loadLogs() {
  if (!selectedId.value) return
  const response = await searchServiceLogs(selectedId.value, query.value)
  logs.value = response.data
}

async function clearLogs() {
  if (!selectedId.value) return
  await clearServiceLogs(selectedId.value)
  await loadLogs()
}
</script>
