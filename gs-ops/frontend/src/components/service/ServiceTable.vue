<template>
  <div class="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
    <table class="min-w-full divide-y divide-line">
      <thead class="bg-slate-50">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">服务</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">状态</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">端口</th>
          <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">运行时长</th>
          <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="service in services" :key="service.id" class="hover:bg-slate-50">
          <td class="px-4 py-3">
            <RouterLink class="focus-ring font-medium text-ink" :to="`/services/${service.id}`">
              {{ service.displayName }}
            </RouterLink>
            <p class="text-xs text-slate-500">{{ service.name }} · {{ service.version }}</p>
          </td>
          <td class="px-4 py-3"><ServiceStatus :status="service.status" /></td>
          <td class="px-4 py-3 text-sm">{{ service.port }}</td>
          <td class="px-4 py-3 text-sm">{{ formatDuration(service.uptime) }}</td>
          <td class="px-4 py-3">
            <div class="flex justify-end gap-2">
              <AppButton
                v-if="service.status !== 'running'"
                :icon="Play"
                variant="neutral"
                @click="$emit('action', service.id, 'start')"
              />
              <AppButton v-else :icon="Square" variant="neutral" @click="$emit('action', service.id, 'stop')" />
              <AppButton :icon="RotateCw" variant="neutral" @click="$emit('action', service.id, 'restart')" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { Play, RotateCw, Square } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import ServiceStatus from './ServiceStatus.vue'
import { formatDuration } from '../../utils/format'

defineProps({
  services: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['action'])
</script>
