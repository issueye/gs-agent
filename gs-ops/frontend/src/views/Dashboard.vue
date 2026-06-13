<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-4">
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">服务总数</p>
        <p class="mt-2 text-3xl font-semibold">{{ services.services.length }}</p>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">运行中</p>
        <p class="mt-2 text-3xl font-semibold text-success">{{ services.runningCount }}</p>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">已停止</p>
        <p class="mt-2 text-3xl font-semibold text-slate-600">{{ services.stoppedCount }}</p>
      </div>
      <div class="rounded-lg border border-line bg-white p-4 shadow-panel">
        <p class="text-sm text-slate-500">异常</p>
        <p class="mt-2 text-3xl font-semibold text-danger">{{ services.errorCount }}</p>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">服务概览</h2>
        <RouterLink class="focus-ring rounded-md text-sm font-medium text-accent" to="/services">查看全部</RouterLink>
      </div>
      <Loading v-if="services.loading" />
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ServiceCard
          v-for="service in services.services"
          :key="service.id"
          :service="service"
          @action="handleAction"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import Loading from '../components/common/Loading.vue'
import ServiceCard from '../components/service/ServiceCard.vue'
import { useServiceStore } from '../stores/service'

const services = useServiceStore()

onMounted(() => {
  services.loadServices()
})

async function handleAction(id, action) {
  await services.action(id, action)
}
</script>
