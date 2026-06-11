<script setup>
import { LoaderCircle, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, RefreshCw, Trash2 } from 'lucide-vue-next'

defineProps({
  conversations: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  streaming: { type: Boolean, default: false },
  runningConversationIds: { type: Array, default: () => [] },
  deletingId: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
})

defineEmits(['delete', 'new-chat', 'refresh', 'toggle-collapse'])

const formatTime = (v) => v ? new Date(v).toLocaleDateString() : ''
const isRunning = (conv, ids) => conv?.id && ids.includes(conv.id)
</script>

<template>
  <aside class="sidebar" :class="collapsed && 'sidebar--collapsed'">
    <!-- 折叠状态 -->
    <div v-if="collapsed" class="sidebar-collapsed">
      <button class="icon-btn" title="展开会话列表" @click="$emit('toggle-collapse')">
        <PanelLeftOpen class="h-4 w-4" />
      </button>
      <button class="icon-btn icon-btn--primary" title="新建会话" @click="$emit('new-chat')">
        <MessageSquarePlus class="h-4 w-4" />
      </button>
      <button class="icon-btn" title="刷新会话" @click="$emit('refresh')">
        <RefreshCw class="h-4 w-4" />
      </button>
      <div class="mt-2 flex flex-col items-center gap-2 text-[11px] text-[var(--qq-text-tertiary)]">
        <span class="count-badge">{{ conversations.length }}</span>
        <span v-if="streaming" class="status-indicator" title="有会话正在运行">
          <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
        </span>
      </div>
    </div>

    <!-- 展开状态 -->
    <template v-else>
      <div class="sidebar-header">
        <div>
          <p class="text-xs uppercase text-[var(--qq-text-tertiary)]">会话</p>
          <h2 class="mt-1 text-sm font-semibold text-[var(--qq-text-primary)]">会话列表</h2>
        </div>
        <div class="flex items-center gap-2">
          <button class="icon-btn" title="收起会话列表" @click="$emit('toggle-collapse')">
            <PanelLeftClose class="h-4 w-4" />
          </button>
          <button class="icon-btn" title="刷新" @click="$emit('refresh')">
            <RefreshCw class="h-4 w-4" />
          </button>
          <button class="icon-btn icon-btn--primary" title="新建会话" @click="$emit('new-chat')">
            <MessageSquarePlus class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="sidebar-status">
        {{ loading ? '正在读取网关会话...' : streaming ? `${runningConversationIds.length} 个会话正在运行` : '按最后活动时间排序' }}
      </div>

      <div class="sidebar-list scrollbar-thin">
        <div
          v-for="conv in conversations"
          :key="conv.id"
          class="conv-item"
          :class="conv.id === activeId && 'conv-item--active'"
        >
          <div class="flex items-start justify-between gap-3">
            <RouterLink :to="`/chat/${conv.id}`" class="min-w-0 flex-1">
              <h3 class="line-clamp-2 text-sm font-medium text-[var(--qq-text-primary)]">
                {{ conv.title || '未命名会话' }}
              </h3>
              <p class="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-[var(--qq-text-tertiary)]">
                <span class="truncate">{{ conv.agentId }}<span v-if="conv.status"> · {{ conv.status }}</span></span>
                <span v-if="isRunning(conv, runningConversationIds) || conv.status === 'running'" class="running-badge">
                  <LoaderCircle class="h-3 w-3 animate-spin" />
                  运行中
                </span>
              </p>
            </RouterLink>
            <div class="flex shrink-0 items-start gap-2">
              <span class="pt-0.5 text-[11px] text-[var(--qq-text-tertiary)]">
                {{ formatTime(conv.updatedAt || conv.createdAt) }}
              </span>
              <button class="delete-btn" type="button" title="删除会话" @click="$emit('delete', conv.id)">
                <Trash2 v-if="deletingId !== conv.id" class="h-3.5 w-3.5" />
                <span v-else class="text-[10px]">...</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="!loading && !conversations.length" class="px-4 py-8 text-sm text-[var(--qq-text-tertiary)]">
          当前还没有会话。发送第一条消息后，会话会立即出现在这里。
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  min-height: 0;
  flex-shrink: 0;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--qq-border);
  background: var(--qq-sidebar);
  width: 20rem;
  transition: width 200ms ease-out;
}
.sidebar--collapsed { width: 3rem; }

.sidebar-collapsed {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.75rem;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--qq-border);
  padding: 0.75rem 1rem;
}

.sidebar-status {
  border-bottom: 1px solid var(--qq-border);
  padding: 0.625rem 1rem;
  font-size: 12px;
  color: var(--qq-text-tertiary);
}

.sidebar-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.icon-btn {
  display: inline-flex;
  height: 2rem;
  width: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid var(--qq-border);
  background: rgba(255,255,255,0.7);
  color: var(--qq-text-secondary);
  transition: all 120ms;
}
.icon-btn:hover { background: white; color: var(--qq-text-primary); }
.icon-btn--primary {
  border: 0;
  background: var(--qq-accent);
  color: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.icon-btn--primary:hover { background: var(--qq-accent-strong); }

.count-badge {
  border: 1px solid var(--qq-border);
  border-radius: 0.5rem;
  background: rgba(255,255,255,0.7);
  padding: 0.25rem 0.5rem;
  color: var(--qq-text-secondary);
}

.status-indicator {
  display: inline-flex;
  height: 1.5rem;
  width: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(72,255,209,0.14);
  color: var(--qq-accent);
}

.conv-item {
  display: block;
  margin-bottom: 0.25rem;
  border-radius: 0.75rem;
  padding: 0.75rem;
  transition: background 120ms;
}
.conv-item:hover { background: rgba(15,23,42,0.055); }
.conv-item--active {
  background: white;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  ring: 1px solid var(--qq-border);
}

.running-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
  border-radius: 0.5rem;
  background: rgba(0,136,255,0.12);
  padding: 0.125rem 0.375rem;
  font-size: 10px;
  color: var(--qq-accent);
}

.delete-btn {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: var(--qq-text-tertiary);
  transition: all 120ms;
}
.delete-btn:hover { background: #fef2f2; color: #dc2626; }
</style>
