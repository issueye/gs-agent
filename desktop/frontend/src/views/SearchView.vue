<script setup>
import { computed } from 'vue'
import { Search, X } from 'lucide-vue-next'
import SearchResultList from '@/components/search/SearchResultList.vue'
import SearchStatePanel from '@/components/search/SearchStatePanel.vue'
import QqButton from '@/components/ued/QqButton.vue'
import QqInput from '@/components/ued/QqInput.vue'
import { useAppStore } from '@/stores/app'
import { useConversationsStore } from '@/stores/conversations'
import { useSearchStore } from '@/stores/search'

const appStore = useAppStore()
const conversationsStore = useConversationsStore()
const searchStore = useSearchStore()

const isLoading = computed(() => appStore.booting || conversationsStore.loading || conversationsStore.hasLoadingMessages)
const gatewayNotice = computed(() => {
  if (appStore.gatewayStatus === 'unconfigured') {
    return {
      title: '网关未配置',
      description: '当前只能搜索已经保存在前端内存里的会话和消息；配置网关后会话列表会重新同步。',
    }
  }
  if (appStore.gatewayStatus === 'offline') {
    return {
      title: '网关离线',
      description: '本地缓存仍可搜索，但新的会话和消息需要网关恢复后才会同步。',
    }
  }
  return null
})

const statePanel = computed(() => {
  if (isLoading.value) {
    return {
      state: 'loading',
      title: '正在准备本地索引',
      description: '会话列表或缓存消息正在同步，搜索结果会在数据就绪后更新。',
    }
  }

  if (!searchStore.hasQuery) {
    return {
      state: gatewayNotice.value ? 'gateway' : 'empty',
      title: '输入关键词开始搜索',
      description: '可搜索已加载的会话标题，以及当前已经缓存到前端的聊天消息。',
    }
  }

  if (searchStore.results.length === 0) {
    return {
      state: gatewayNotice.value ? 'gateway' : 'empty',
      title: '没有找到匹配结果',
      description: '换一个关键词试试。还未打开过的会话消息不会进入本地缓存索引。',
    }
  }

  return null
})

const resultCountLabel = computed(() => (searchStore.hasQuery ? `${searchStore.results.length} 个结果` : '等待输入'))

async function refresh() {
  await appStore.refreshGatewayData()
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="border-b border-white/10 bg-[rgba(18,58,51,0.34)] px-4 py-4 backdrop-blur-xl">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.2em] text-[color:var(--qq-text-tertiary)]">Local Search</p>
          <h2 class="mt-1 text-lg font-semibold text-slate-50">搜索本地会话缓存</h2>
          <p class="mt-1 text-sm text-[color:var(--qq-text-secondary)]">
            {{ searchStore.summary.conversations }} 个会话 · {{ searchStore.summary.cachedMessages }} 条缓存消息 · {{ resultCountLabel }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <QqButton variant="secondary" size="sm" :disabled="appStore.booting || conversationsStore.loading" @click="refresh">
            刷新
          </QqButton>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <QqInput
          :model-value="searchStore.query"
          class="min-w-0 flex-1"
          placeholder="搜索标题或已缓存消息"
          data-testid="local-search-input"
          @update:model-value="searchStore.setQuery"
        >
          <template #prefix>
            <Search class="h-4 w-4" />
          </template>
        </QqInput>
        <button
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-white/10 bg-[rgba(255,255,255,0.08)] text-[color:var(--qq-text-secondary)] transition hover:border-white/20 hover:bg-[rgba(255,255,255,0.14)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          title="清空搜索"
          :disabled="!searchStore.query"
          @click="searchStore.clearQuery"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </header>

    <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div v-if="gatewayNotice" class="mb-4 border border-amber-200/20 bg-amber-200/10 px-4 py-3" style="border-radius: 6px;" data-testid="search-gateway-notice">
        <p class="text-sm font-semibold text-amber-100">{{ gatewayNotice.title }}</p>
        <p class="mt-1 text-sm leading-6 text-[color:var(--qq-text-secondary)]">{{ gatewayNotice.description }}</p>
      </div>

      <SearchStatePanel
        v-if="statePanel"
        :description="statePanel.description"
        :state="statePanel.state"
        :title="statePanel.title"
        data-testid="search-state-panel"
      />

      <SearchResultList v-else :query="searchStore.query" :results="searchStore.results" />
    </div>
  </section>
</template>
