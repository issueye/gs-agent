<script setup>
import { computed, ref, watch } from 'vue'
import { renderMarkdown } from '@/services/utils/markdown'
import { CheckCircle2, ChevronDown, ChevronRight, LoaderCircle, Terminal, XCircle } from 'lucide-vue-next'

const props = defineProps({
  message: { type: Object, required: true },
  showTimestamps: { type: Boolean, default: true },
})

const LABELS = {
  kind: { search: '搜索', read: '读取', edit: '修改', execute: '执行', fetch: '获取', 'agent.im': '网关' },
  status: { running: '运行中', pending: '运行中', in_progress: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消' },
  role: { user: '你', assistant: '助手', tool: '工具' },
}

const meta = computed(() => props.message.metadata || {})
const isTool = computed(() => props.message.role === 'tool' || meta.value.toolCallId)
const toolExpanded = ref(false)

const rendered = computed(() => renderMarkdown(props.message.content))
const roleLabel = computed(() => LABELS.role[isTool.value ? 'tool' : props.message.role] || props.message.role)
const kindLabel = computed(() => LABELS.kind[meta.value.toolKind] || meta.value.toolKind || '工具')
const statusLabel = computed(() => LABELS.status[meta.value.toolStatus] || meta.value.toolStatus)
const toolTitle = computed(() => meta.value.toolTitle || kindLabel.value)

const icon = computed(() => {
  const status = meta.value.toolStatus
  if (status === 'completed') return { component: CheckCircle2, class: 'text-emerald-600' }
  if (status === 'failed' || status === 'cancelled') return { component: XCircle, class: 'text-red-600' }
  return { component: LoaderCircle, class: 'animate-spin text-[var(--qq-accent)]' }
})

const usage = computed(() => {
  const u = meta.value.usage
  if (!u) return ''
  const parts = []
  if (u.inputTokens) parts.push(`in ${u.inputTokens}`)
  if (u.outputTokens) parts.push(`out ${u.outputTokens}`)
  return parts.join(' · ')
})

const inputSummary = computed(() => {
  const input = meta.value.rawInput
  if (!input) return ''
  if (typeof input === 'string') return input.slice(0, 80) + (input.length > 80 ? '...' : '')
  if (input.query) return `查询：${input.query}`
  if (input.path) return `路径：${input.path}`
  if (input.command) return `命令：${input.command}`
  return ''
})

watch(() => props.message.id, () => { toolExpanded.value = false })
</script>

<template>
  <article class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
    <div class="message-shell" :class="`message-shell--${isTool ? 'tool' : message.role}`">
      <header v-if="!isTool" class="mb-1 flex items-center gap-2" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
        <span class="role-badge" :class="`role-badge--${message.role}`">{{ roleLabel }}</span>
        <span v-if="message.draft" class="text-xs text-[var(--qq-text-tertiary)]">生成中</span>
        <span v-if="usage" class="text-xs text-[var(--qq-text-tertiary)]">{{ usage }}</span>
        <time v-if="showTimestamps" class="text-xs text-[var(--qq-text-tertiary)]">
          {{ message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : '' }}
        </time>
      </header>

      <div class="message-bubble" :class="[`message-bubble--${message.role}`, isTool && 'message-bubble--tool']">
        <button v-if="isTool" type="button" class="tool-toggle" :class="toolExpanded && 'mb-2'" @click="toolExpanded = !toolExpanded">
          <component :is="icon.component" class="h-3.5 w-3.5 shrink-0" :class="icon.class" />
          <Terminal class="h-3.5 w-3.5 shrink-0 text-[var(--qq-text-tertiary)]" />
          <span class="min-w-0 flex-1 truncate font-medium text-[var(--qq-text-primary)]">{{ toolTitle }}</span>
          <span v-if="inputSummary" class="hidden min-w-0 flex-1 truncate sm:inline">{{ inputSummary }}</span>
          <span v-if="statusLabel" class="shrink-0">· {{ statusLabel }}</span>
          <time v-if="showTimestamps" class="shrink-0 text-[11px] text-[var(--qq-text-tertiary)]">
            {{ message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : '' }}
          </time>
          <span class="tool-toggle-btn">
            <component :is="toolExpanded ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
            {{ toolExpanded ? '收起' : '展开' }}
          </span>
        </button>
        <div v-if="!isTool || toolExpanded" class="markdown-body" :class="message.error && 'text-red-700'" v-html="rendered" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.message-shell { max-width: min(920px, 84%); }
.message-shell--user { max-width: min(720px, 72%); }
.message-shell--tool { max-width: min(760px, 80%); }

.role-badge {
  display: inline-flex;
  border-radius: 0.5rem;
  padding: 0.125rem 0.5rem;
  font-size: 11px;
  text-transform: uppercase;
}
.role-badge--user { background: rgba(15,23,42,0.08); color: var(--qq-text-secondary); }
.role-badge--assistant { background: rgba(0,136,255,0.12); color: var(--qq-accent); }

.message-bubble {
  border: 1px solid var(--qq-border);
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.82);
}
.message-bubble--user { border-color: transparent; background: var(--qq-user-bubble); }
.message-bubble--tool { border-color: var(--tool-message-border); background: var(--tool-message-bg); }

.tool-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.5rem;
  text-align: left;
  font-size: 12px;
  color: var(--qq-text-secondary);
  transition: background-color 160ms, color 160ms;
}
.tool-toggle:hover { background: rgba(15,23,42,0.055); color: var(--qq-text-primary); }
.tool-toggle:focus-visible { outline: 1px solid rgba(0,136,255,0.42); outline-offset: 2px; }

.tool-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  border: 1px solid var(--qq-border);
  border-radius: 8px;
  padding: 0.12rem 0.4rem;
  color: var(--qq-text-secondary);
}

.markdown-body { overflow-wrap: anywhere; font-size: 14px; line-height: 1.75; color: var(--qq-text-primary); }
.markdown-body :deep(p), .markdown-body :deep(ul), .markdown-body :deep(ol), .markdown-body :deep(blockquote), .markdown-body :deep(pre), .markdown-body :deep(.markdown-table-scroll) { margin: 0.7rem 0; }
.markdown-body :deep(:first-child) { margin-top: 0; }
.markdown-body :deep(:last-child) { margin-bottom: 0; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3), .markdown-body :deep(h4) { margin: 1rem 0 0.45rem; font-weight: 700; line-height: 1.35; color: var(--qq-text-primary); }
.markdown-body :deep(h1) { font-size: 1.35rem; }
.markdown-body :deep(h2) { font-size: 1.15rem; }
.markdown-body :deep(h3) { font-size: 1rem; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.25rem; }
.markdown-body :deep(ul) { list-style: disc; }
.markdown-body :deep(ol) { list-style: decimal; }
.markdown-body :deep(li + li) { margin-top: 0.25rem; }
.markdown-body :deep(strong) { font-weight: 700; color: var(--qq-text-primary); }
.markdown-body :deep(a) { color: var(--qq-accent); text-decoration: underline; text-underline-offset: 3px; }
.markdown-body :deep(code) { border: 1px solid rgba(15,23,42,0.1); border-radius: 8px; background: rgba(242,244,248,0.92); padding: 0.1rem 0.32rem; font-size: 0.9em; }
.markdown-body :deep(pre) { overflow-x: auto; border: 1px solid var(--qq-border); border-radius: 12px; background: rgba(247,249,252,0.96); padding: 0.8rem; }
.markdown-body :deep(pre code) { border: 0; background: transparent; padding: 0; }
.markdown-body :deep(blockquote) { border-left: 3px solid var(--qq-accent); padding-left: 0.8rem; color: var(--qq-text-secondary); }
.markdown-body :deep(.markdown-table-scroll) { width: 100%; overflow-x: auto; border: 1px solid var(--qq-border); border-radius: 12px; background: linear-gradient(90deg, rgba(0,136,255,0.06), transparent 35%), rgba(255,255,255,0.72); }
.markdown-body :deep(table) { width: 100%; min-width: max-content; border-collapse: separate; border-spacing: 0; }
.markdown-body :deep(thead) { background: rgba(244,247,252,0.96); }
.markdown-body :deep(th), .markdown-body :deep(td) { border-bottom: 1px solid rgba(15,23,42,0.08); border-right: 1px solid rgba(15,23,42,0.06); padding: 0.55rem 0.75rem; text-align: left; vertical-align: top; white-space: normal; word-break: break-word; }
.markdown-body :deep(th:last-child), .markdown-body :deep(td:last-child) { border-right: 0; }
.markdown-body :deep(th) { color: var(--qq-text-secondary); font-size: 0.78rem; font-weight: 700; }
.markdown-body :deep(tbody tr:last-child td) { border-bottom: 0; }
.markdown-body :deep(tbody tr:hover) { background: rgba(15,23,42,0.04); }
.markdown-body :deep(table code) { white-space: nowrap; }
</style>
