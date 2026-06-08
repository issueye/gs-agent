<script setup>
import { computed, ref, watch } from 'vue'
import { renderMarkdown } from '@/services/utils/markdown'
import { CheckCircle2, ChevronDown, ChevronRight, LoaderCircle, Terminal, XCircle } from 'lucide-vue-next'

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
  showTimestamps: {
    type: Boolean,
    default: true,
  },
})

const renderedContent = computed(() => renderMarkdown(props.message.content))
const toolMetadata = computed(() => props.message.metadata || {})
const toolLabel = computed(() => {
  const meta = toolMetadata.value
  if (!meta.toolCallId && !meta.toolStatus && !meta.toolKind) {
    return ''
  }
  return [meta.toolKind, meta.toolStatus].filter(Boolean).join(' · ')
})

const usageLabel = computed(() => {
  const usage = toolMetadata.value.usage
  if (!usage) {
    return ''
  }
  const parts = []
  if (Number.isFinite(usage.inputTokens)) parts.push(`in ${usage.inputTokens}`)
  if (Number.isFinite(usage.outputTokens)) parts.push(`out ${usage.outputTokens}`)
  if (Number.isFinite(usage.totalTokens)) parts.push(`total ${usage.totalTokens}`)
  return parts.join(' · ')
})

const isToolMessage = computed(() => props.message.role === 'tool' || Boolean(toolMetadata.value.toolCallId))
const messageShellClass = computed(() => {
  if (props.message.role === 'user') return 'message-shell--user'
  if (isToolMessage.value) return 'message-shell--tool'
  return 'message-shell--assistant'
})
const statusLabel = computed(() => props.message.draft ? 'streaming' : '')
const toolStatus = computed(() => toolMetadata.value.toolStatus || '')
const toolIcon = computed(() => {
  if (toolStatus.value === 'completed') return CheckCircle2
  if (toolStatus.value === 'failed' || toolStatus.value === 'cancelled') return XCircle
  return LoaderCircle
})
const toolIconClass = computed(() => {
  if (toolStatus.value === 'completed') return 'text-emerald-600'
  if (toolStatus.value === 'failed' || toolStatus.value === 'cancelled') return 'text-red-600'
  return 'animate-spin text-[var(--qq-accent)]'
})
const isFinalToolStatus = computed(() => ['completed', 'failed', 'cancelled'].includes(toolStatus.value))
const toolExpanded = ref(!isFinalToolStatus.value)
const shouldShowMessageBody = computed(() => !isToolMessage.value || toolExpanded.value)
const toolToggleLabel = computed(() => toolExpanded.value ? '收起' : '展开')

watch(
  () => `${props.message.id}:${toolStatus.value}:${isToolMessage.value}`,
  () => {
    toolExpanded.value = !(isToolMessage.value && isFinalToolStatus.value)
  },
)

function roleLabel(role) {
  if (isToolMessage.value) {
    return 'Tool'
  }
  return role === 'user' ? 'You' : 'Assistant'
}

function formatTimestamp(value) {
  if (!value) {
    return ''
  }
  return new Date(value).toLocaleTimeString()
}
</script>

<template>
  <article
    class="flex"
    :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
    :data-testid="`chat-message-${message.role}`"
  >
    <div class="message-shell" :class="messageShellClass">
      <header class="mb-2 flex items-center gap-2" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
        <span
          class="inline-flex rounded-lg px-2 py-0.5 text-[11px] uppercase"
          :class="
            message.role === 'user'
              ? 'bg-[rgba(15,23,42,0.08)] text-[color:var(--qq-text-secondary)]'
              : 'bg-[rgba(0,136,255,0.12)] text-[var(--qq-accent)]'
          "
        >
          {{ roleLabel(message.role) }}
        </span>
        <span v-if="message.draft" class="text-xs text-[color:var(--qq-text-tertiary)]">streaming</span>
        <span
          v-if="toolLabel && !isToolMessage"
          class="inline-flex items-center gap-1 rounded-lg bg-white/70 px-2 py-0.5 text-[11px] text-[color:var(--qq-text-secondary)]"
        >
          <LoaderCircle class="h-3 w-3 animate-spin" />
          {{ toolLabel }}
        </span>
        <span v-if="usageLabel" class="text-xs text-[color:var(--qq-text-tertiary)]">{{ usageLabel }}</span>
        <span v-if="statusLabel" class="text-xs text-[color:var(--qq-text-tertiary)]">{{ statusLabel }}</span>
        <time v-if="showTimestamps" class="text-xs text-[color:var(--qq-text-tertiary)]">
          {{ formatTimestamp(message.createdAt) }}
        </time>
      </header>

      <div
        class="border px-3 py-2.5 shadow-sm"
        :class="[
          message.role === 'user' ? 'border-transparent bg-[color:var(--qq-user-bubble)]' : 'border-[color:var(--qq-border)] bg-white/82',
          isToolMessage ? 'border-[rgba(0,136,255,0.22)] bg-[rgba(237,243,255,0.72)]' : '',
        ]"
        style="border-radius: 16px;"
      >
        <button
          v-if="isToolMessage"
          type="button"
          class="tool-message-toggle flex w-full items-center gap-2 rounded-lg text-left text-xs text-[color:var(--qq-text-secondary)]"
          :class="shouldShowMessageBody ? 'mb-2' : ''"
          :aria-expanded="toolExpanded"
          @click="toolExpanded = !toolExpanded"
        >
          <component :is="toolIcon" class="h-3.5 w-3.5 shrink-0" :class="toolIconClass" />
          <Terminal class="h-3.5 w-3.5 shrink-0 text-[color:var(--qq-text-tertiary)]" />
          <span class="min-w-0 flex-1 truncate font-medium text-[color:var(--qq-text-primary)]">
            {{ toolMetadata.toolTitle || toolMetadata.toolKind || '工具调用' }}
          </span>
          <span v-if="toolMetadata.toolStatus" class="shrink-0">· {{ toolMetadata.toolStatus }}</span>
          <span class="tool-message-toggle__label inline-flex shrink-0 items-center gap-1">
            <component :is="toolExpanded ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
            {{ toolToggleLabel }}
          </span>
        </button>
        <div
          v-if="shouldShowMessageBody"
          class="markdown-body text-sm leading-7"
          :class="message.error ? 'text-red-700' : 'text-[color:var(--qq-text-primary)]'"
          v-html="renderedContent"
        />
        <div
          v-if="shouldShowMessageBody && (isToolMessage || usageLabel)"
          class="mt-2 border-t border-[color:var(--qq-border)] pt-2 text-xs text-[color:var(--qq-text-tertiary)]"
        >
          <span v-if="isToolMessage" class="mr-3">tool {{ toolMetadata.toolKind || 'other' }} · {{ toolMetadata.toolStatus || 'pending' }}</span>
          <span v-if="usageLabel">usage {{ usageLabel }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.markdown-body {
  overflow-wrap: anywhere;
}

.message-shell {
  max-width: min(920px, 82%);
}

.message-shell--user {
  max-width: min(720px, 70%);
}

.message-shell--tool {
  max-width: min(980px, 86%);
}

.tool-message-toggle {
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.tool-message-toggle:hover {
  background: rgba(15, 23, 42, 0.055);
  color: var(--qq-text-primary);
}

.tool-message-toggle:focus-visible {
  outline: 1px solid rgba(0, 136, 255, 0.42);
  outline-offset: 2px;
}

.tool-message-toggle__label {
  border: 1px solid var(--qq-border);
  border-radius: 8px;
  padding: 0.12rem 0.4rem;
  color: var(--qq-text-secondary);
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre),
.markdown-body :deep(.markdown-table-scroll) {
  margin: 0.7rem 0;
}

.markdown-body :deep(p:first-child),
.markdown-body :deep(ul:first-child),
.markdown-body :deep(ol:first-child),
.markdown-body :deep(blockquote:first-child),
.markdown-body :deep(pre:first-child),
.markdown-body :deep(.markdown-table-scroll:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child),
.markdown-body :deep(ul:last-child),
.markdown-body :deep(ol:last-child),
.markdown-body :deep(blockquote:last-child),
.markdown-body :deep(pre:last-child),
.markdown-body :deep(.markdown-table-scroll:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 1rem 0 0.45rem;
  color: var(--qq-text-primary);
  font-weight: 700;
  line-height: 1.35;
}

.markdown-body :deep(h1) {
  font-size: 1.35rem;
}

.markdown-body :deep(h2) {
  font-size: 1.15rem;
}

.markdown-body :deep(h3) {
  font-size: 1rem;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.25rem;
}

.markdown-body :deep(ul) {
  list-style: disc;
}

.markdown-body :deep(ol) {
  list-style: decimal;
}

.markdown-body :deep(li + li) {
  margin-top: 0.25rem;
}

.markdown-body :deep(strong) {
  color: var(--qq-text-primary);
  font-weight: 700;
}

.markdown-body :deep(a) {
  color: var(--qq-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.markdown-body :deep(.markdown-table-scroll) {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid var(--qq-border);
  border-radius: 12px;
  background:
    linear-gradient(90deg, rgba(0, 136, 255, 0.06), transparent 35%),
    rgba(255, 255, 255, 0.72);
}

.markdown-body :deep(table) {
  width: 100%;
  min-width: max-content;
  border-collapse: separate;
  border-spacing: 0;
}

.markdown-body :deep(thead) {
  background: rgba(244, 247, 252, 0.96);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  border-right: 1px solid rgba(15, 23, 42, 0.06);
  padding: 0.55rem 0.75rem;
  text-align: left;
  vertical-align: top;
  white-space: normal;
  word-break: break-word;
}

.markdown-body :deep(th:last-child),
.markdown-body :deep(td:last-child) {
  border-right: 0;
}

.markdown-body :deep(th) {
  color: var(--qq-text-secondary);
  font-size: 0.78rem;
  font-weight: 700;
}

.markdown-body :deep(td) {
  color: var(--qq-text-primary);
}

.markdown-body :deep(tbody tr:last-child td) {
  border-bottom: 0;
}

.markdown-body :deep(tbody tr:hover) {
  background: rgba(15, 23, 42, 0.04);
}

.markdown-body :deep(table code) {
  white-space: nowrap;
}

.markdown-body :deep(code) {
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  background: rgba(242, 244, 248, 0.92);
  padding: 0.1rem 0.32rem;
  color: var(--qq-text-primary);
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  border: 1px solid var(--qq-border);
  border-radius: 12px;
  background: rgba(247, 249, 252, 0.96);
  padding: 0.8rem;
}

.markdown-body :deep(pre code) {
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--qq-accent);
  padding-left: 0.8rem;
  color: var(--qq-text-secondary);
}
</style>
