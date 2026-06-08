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
  if (status === 'connected') return '网关在线'
  if (status === 'unconfigured') return '网关未配置'
  if (status === 'offline') return '网关离线'
  return '网关连接中'
}

function socketLabel(status) {
  if (status === 'open') return '通道就绪'
  if (status === 'connecting') return '通道连接中'
  if (status === 'closed') return '通道已关闭'
  return '通道空闲'
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 px-5 py-3 text-xs text-[color:var(--qq-text-secondary)]">
    <span class="qq-badge rounded-lg px-2 py-0.5">{{ gatewayLabel(gatewayStatus) }}</span>
    <span class="qq-badge rounded-lg px-2 py-0.5">{{ socketLabel(socketStatus) }}</span>
    <span class="qq-badge rounded-lg px-2 py-0.5">Agent {{ agentName }}</span>
    <span v-if="projectContext" class="qq-badge max-w-full rounded-lg px-2 py-0.5">
      项目 {{ projectContext.name }} · {{ projectContext.rootDir }}
    </span>
  </div>
</template>
