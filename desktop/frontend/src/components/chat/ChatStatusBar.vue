<script setup>
defineProps({
  gatewayStatus: {
    type: String,
    default: 'unknown',
  },
  socketStatus: {
    type: String,
    default: 'idle',
  },
  agentName: {
    type: String,
    default: '未选择',
  },
  projectContext: {
    type: Object,
    default: null,
  },
})

function gatewayLabel(status) {
  if (status === 'connected') return 'Gateway Online'
  if (status === 'unconfigured') return 'Gateway Unconfigured'
  if (status === 'offline') return 'Gateway Offline'
  return 'Gateway Pending'
}

function socketLabel(status) {
  if (status === 'open') return 'Socket Ready'
  if (status === 'connecting') return 'Socket Connecting'
  if (status === 'closed') return 'Socket Closed'
  return 'Socket Idle'
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 px-5 py-3 text-xs text-[color:var(--qq-text-secondary)]">
    <span class="qq-badge rounded-lg px-2 py-0.5">{{ gatewayLabel(gatewayStatus) }}</span>
    <span class="qq-badge rounded-lg px-2 py-0.5">{{ socketLabel(socketStatus) }}</span>
    <span class="qq-badge rounded-lg px-2 py-0.5">Agent {{ agentName }}</span>
    <span v-if="projectContext" class="qq-badge max-w-full rounded-lg px-2 py-0.5">
      Project {{ projectContext.name }} · {{ projectContext.rootDir }}
    </span>
  </div>
</template>
