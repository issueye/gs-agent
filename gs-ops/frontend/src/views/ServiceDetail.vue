<template>
  <Loading v-if="services.loading && !service" />
  <div v-else-if="service" class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <RouterLink class="focus-ring mb-3 inline-flex text-sm font-medium text-accent" to="/services">
          返回服务列表
        </RouterLink>
        <div class="flex items-center gap-3">
          <h2 class="text-2xl font-semibold">{{ service.displayName }}</h2>
          <ServiceStatus :status="service.status" />
        </div>
        <p class="mt-1 text-sm text-slate-500">{{ service.description }}</p>
      </div>
      <div class="flex gap-2">
        <AppButton v-if="service.status !== 'running'" :icon="Play" @click="run('start')">启动</AppButton>
        <AppButton v-else :icon="Square" variant="neutral" @click="run('stop')">停止</AppButton>
        <AppButton :icon="RotateCw" variant="neutral" @click="run('restart')">重启</AppButton>
      </div>
    </div>

    <section class="grid gap-4 md:grid-cols-4">
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">版本</p>
        <p class="mt-2 font-semibold">{{ service.version }}</p>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">类型</p>
        <p class="mt-2 font-semibold">{{ formatServiceType(service.type) }}</p>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">PID</p>
        <p class="mt-2 font-semibold">{{ service.pid || '-' }}</p>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">运行时长</p>
        <p class="mt-2 font-semibold">{{ formatDuration(service.uptime) }}</p>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel lg:col-span-2">
        <h3 class="font-semibold">运行信息</h3>
        <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt class="text-slate-500">安装路径</dt><dd class="mt-1 font-medium">{{ service.installPath }}</dd></div>
          <div><dt class="text-slate-500">配置路径</dt><dd class="mt-1 font-medium">{{ service.configPath }}</dd></div>
          <div><dt class="text-slate-500">日志路径</dt><dd class="mt-1 font-medium">{{ service.logPath }}</dd></div>
          <div><dt class="text-slate-500">健康检查</dt><dd class="mt-1 font-medium">{{ service.healthCheck?.url || '-' }}</dd></div>
        </dl>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <h3 class="font-semibold">监控指标</h3>
        <dl class="mt-4 space-y-3 text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">CPU</dt><dd class="font-medium">{{ metrics?.cpu ?? 0 }}%</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">内存</dt><dd class="font-medium">{{ metrics?.memory ?? 0 }} MB</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">连接数</dt><dd class="font-medium">{{ metrics?.connections ?? 0 }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 class="font-semibold">配置管理</h3>
        <AppButton :icon="Archive" variant="neutral" @click="createBackup">备份配置</AppButton>
      </div>
      <form class="mt-4 grid gap-4 lg:grid-cols-2" @submit.prevent="saveConfig">
        <label class="block">
          <span class="text-sm text-slate-500">环境变量</span>
          <textarea v-model="environmentText" class="focus-ring mt-1 h-32 w-full rounded-md border border-line p-3 font-mono text-sm" />
        </label>
        <label class="block">
          <span class="text-sm text-slate-500">命令</span>
          <textarea v-model="commandsText" class="focus-ring mt-1 h-32 w-full rounded-md border border-line p-3 font-mono text-sm" />
        </label>
        <div class="lg:col-span-2">
          <AppButton :icon="Save" type="submit">保存配置</AppButton>
        </div>
      </form>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-semibold">版本历史</h3>
          <div class="flex gap-2">
            <input
              v-model="targetVersion"
              class="focus-ring h-9 w-32 rounded-md border border-line px-3 text-sm"
              placeholder="0.1.1"
            />
            <AppButton :icon="UploadCloud" @click="upgrade">升级</AppButton>
          </div>
        </div>
        <div class="mt-4 space-y-3">
          <div v-for="entry in services.versions" :key="entry.id" class="rounded-md border border-line p-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium">{{ entry.version }}</p>
                <p class="text-xs text-slate-500">{{ formatAction(entry.action) }} · {{ formatDateTime(entry.timestamp) }}</p>
              </div>
              <AppButton :icon="Undo2" variant="neutral" @click="rollback(entry.version)">回滚</AppButton>
            </div>
          </div>
          <p v-if="services.versions.length === 0" class="text-sm text-slate-500">暂无版本记录。</p>
        </div>
      </div>

      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <h3 class="font-semibold">配置备份</h3>
        <div class="mt-4 space-y-3">
          <div v-for="backup in services.backups" :key="backup.id" class="rounded-md border border-line p-3 text-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-medium">{{ backup.id }}</p>
                <p class="text-xs text-slate-500">v{{ backup.version }} · {{ formatDateTime(backup.timestamp) }}</p>
              </div>
              <AppButton :icon="RotateCcw" variant="neutral" @click="restoreBackup(backup.id)">恢复</AppButton>
            </div>
          </div>
          <p v-if="services.backups.length === 0" class="text-sm text-slate-500">暂无备份。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Archive, Play, RotateCcw, RotateCw, Save, Square, Undo2, UploadCloud } from 'lucide-vue-next'
import AppButton from '../components/common/AppButton.vue'
import Loading from '../components/common/Loading.vue'
import ServiceStatus from '../components/service/ServiceStatus.vue'
import { useMonitorStore } from '../stores/monitor'
import { useServiceStore } from '../stores/service'
import { formatAction, formatDateTime, formatDuration, formatServiceType } from '../utils/format'

const route = useRoute()
const services = useServiceStore()
const monitor = useMonitorStore()
const commandsText = ref('{}')
const environmentText = ref('{}')
const targetVersion = ref('')

const service = computed(() => services.current)
const metrics = computed(() => monitor.metricsByService[route.params.id])

watch(service, (value) => {
  if (!value) return
  commandsText.value = JSON.stringify(value.commands || {}, null, 2)
  environmentText.value = JSON.stringify(value.environment || {}, null, 2)
})

onMounted(async () => {
  await services.loadService(route.params.id)
  await monitor.loadMetrics(route.params.id)
  await services.loadVersions(route.params.id)
  await services.loadBackups(route.params.id)
})

async function run(action) {
  await services.action(route.params.id, action)
  await monitor.loadMetrics(route.params.id)
}

async function saveConfig() {
  await services.saveConfig(route.params.id, {
    commands: JSON.parse(commandsText.value),
    environment: JSON.parse(environmentText.value),
    healthCheck: service.value.healthCheck,
  })
}

async function createBackup() {
  await services.createBackup(route.params.id)
}

async function restoreBackup(backupId) {
  await services.restoreBackup(route.params.id, backupId)
}

async function upgrade() {
  await services.upgrade(route.params.id, targetVersion.value || null)
  targetVersion.value = ''
}

async function rollback(version) {
  await services.rollback(route.params.id, version)
}
</script>
