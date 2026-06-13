<template>
  <article class="rounded-lg border border-line bg-white p-4 shadow-panel">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="font-semibold">{{ service.displayName }}</h3>
        <p class="mt-1 line-clamp-2 text-sm text-slate-500">{{ service.description }}</p>
      </div>
      <ServiceStatus :status="service.status" />
    </div>
    <dl class="mt-4 grid grid-cols-3 gap-3 text-sm">
      <div>
        <dt class="text-xs text-slate-500">端口</dt>
        <dd class="font-medium">{{ service.port }}</dd>
      </div>
      <div>
        <dt class="text-xs text-slate-500">PID</dt>
        <dd class="font-medium">{{ service.pid || '-' }}</dd>
      </div>
      <div>
        <dt class="text-xs text-slate-500">运行时长</dt>
        <dd class="font-medium">{{ formatDuration(service.uptime) }}</dd>
      </div>
    </dl>
    <div class="mt-4 flex items-center justify-between gap-3">
      <RouterLink class="focus-ring rounded-md text-sm font-medium text-accent" :to="`/services/${service.id}`">
        详情
      </RouterLink>
      <div class="flex gap-2">
        <AppButton
          v-if="service.status !== 'running'"
          :icon="Play"
          variant="neutral"
          @click="$emit('action', service.id, 'start')"
        />
        <AppButton v-else :icon="Square" variant="neutral" @click="$emit('action', service.id, 'stop')" />
        <AppButton :icon="RotateCw" variant="neutral" @click="$emit('action', service.id, 'restart')" />
      </div>
    </div>
  </article>
</template>

<script setup>
import { Play, RotateCw, Square } from 'lucide-vue-next'
import AppButton from '../common/AppButton.vue'
import ServiceStatus from './ServiceStatus.vue'
import { formatDuration } from '../../utils/format'

defineProps({
  service: {
    type: Object,
    required: true,
  },
})

defineEmits(['action'])
</script>
