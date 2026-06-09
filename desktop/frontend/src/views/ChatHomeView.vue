<script setup>
import { computed, ref, watch } from 'vue'
import ChatComposer from '@/components/chat/ChatComposer.vue'
import ChatEmptyState from '@/components/chat/ChatEmptyState.vue'
import ChatStatusBar from '@/components/chat/ChatStatusBar.vue'
import QqSelect from '@/components/ued/QqSelect.vue'
import { useAgentsStore } from '@/stores/agents'
import { useAppStore } from '@/stores/app'
import { useChatStore } from '@/stores/chat'
import { useProjectsStore } from '@/stores/projects'
import { useSettingsStore } from '@/stores/settings'

const appStore = useAppStore()
const chatStore = useChatStore()
const agentsStore = useAgentsStore()
const projectsStore = useProjectsStore()
const settingsStore = useSettingsStore()
const draft = ref('')
const selectedAgentId = ref('')

const agentOptions = computed(() => {
  if (agentsStore.items.length === 0) {
    return [{ label: '无可用 Agent', value: '' }]
  }
  return agentsStore.items.map((agent) => ({
    label: agent.name || agent.id,
    value: agent.id,
  }))
})
const selectedAgent = computed(() => agentsStore.items.find((agent) => agent.id === selectedAgentId.value) || null)
const selectedAgentName = computed(() => selectedAgent.value?.name || selectedAgentId.value || '未选择')
const currentProjectContext = computed(() => projectsStore.currentProjectContext)

watch(
  () => settingsStore.settings.gateway.defaultAgentId,
  (value) => {
    if (!selectedAgentId.value || !agentsStore.items.some((agent) => agent.id === selectedAgentId.value)) {
      selectedAgentId.value = value || ''
    }
  },
  { immediate: true },
)

watch(
  () => agentsStore.items,
  (items) => {
    if (selectedAgentId.value && items.some((agent) => agent.id === selectedAgentId.value)) {
      return
    }
    const defaultAgentId = settingsStore.settings.gateway.defaultAgentId
    selectedAgentId.value = items.some((agent) => agent.id === defaultAgentId) ? defaultAgentId : items[0]?.id || ''
  },
  { immediate: true },
)

async function submit() {
  const payload = draft.value
  try {
    draft.value = ''
    await chatStore.sendPrompt(payload, '', { agentId: selectedAgentId.value })
  } catch (error) {
    draft.value = payload
    chatStore.error = error?.message || String(error)
  }
}
</script>

<template>
  <section class="relative flex h-full min-h-0 flex-col bg-[color:var(--qq-canvas)]">
    <ChatStatusBar
      :agent-name="selectedAgentName"
      :gateway-status="appStore.gatewayStatus"
      :project-context="currentProjectContext"
      :socket-status="chatStore.socketState"
    />

    <div class="flex min-h-0 flex-1 flex-col">
      <div class="mx-auto w-full max-w-5xl border-b border-[color:var(--qq-border)] px-5 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs uppercase text-[color:var(--qq-text-tertiary)]">Agent</p>
            <p class="mt-1 text-sm text-[color:var(--qq-text-secondary)]">选择本次对话使用的 Agent</p>
          </div>
          <div class="w-full max-w-sm">
            <QqSelect v-model="selectedAgentId" :disabled="agentsStore.items.length === 0" :options="agentOptions" />
          </div>
        </div>
      </div>
      <ChatEmptyState />
      <ChatComposer
        v-model="draft"
        :busy="false"
        :disabled="!draft.trim() || !selectedAgentId"
        :project-context="currentProjectContext"
        @send="submit"
      />
    </div>
  </section>
</template>
