<script setup>
import { onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import AppNotifications from '@/components/common/AppNotifications.vue'
import { useAgentsStore } from '@/stores/agents'
import { useAppStore } from './stores/app'
import { useChatStore } from './stores/chat'
import { useConversationsStore } from './stores/conversations'
import { useNotificationsStore } from './stores/notifications'

const appStore = useAppStore()
const agentsStore = useAgentsStore()
const chatStore = useChatStore()
const conversationsStore = useConversationsStore()
const notificationsStore = useNotificationsStore()

onMounted(() => {
  appStore.bootstrap()
})

watch(
  () => appStore.error,
  (message) => {
    if (!message) {
      return
    }
    notificationsStore.error(message, { title: '网关连接失败' })
    appStore.error = ''
  },
)

watch(
  () => chatStore.error,
  (message) => {
    if (!message) {
      return
    }
    notificationsStore.error(message, { title: '聊天请求失败' })
    chatStore.error = ''
  },
)

watch(
  () => conversationsStore.error,
  (message) => {
    if (!message) {
      return
    }
    notificationsStore.error(message, { title: '会话操作失败' })
    conversationsStore.error = ''
  },
)

watch(
  () => agentsStore.error,
  (message) => {
    if (!message) {
      return
    }
    notificationsStore.error(message, { title: 'Agent 读取失败' })
    agentsStore.error = ''
  },
)
</script>

<template>
  <RouterView />
  <AppNotifications />
</template>
