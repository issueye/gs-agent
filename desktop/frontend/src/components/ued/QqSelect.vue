<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

let selectSeed = 0

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  options: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '请选择',
  },
})

const emit = defineEmits(['update:modelValue'])

const triggerRef = ref(null)
const menuRef = ref(null)
const open = ref(false)
const activeIndex = ref(-1)
const menuStyle = ref({})
const selectId = `qq-select-${selectSeed += 1}`

const selectedIndex = computed(() => props.options.findIndex((option) => option.value === props.modelValue))
const selectedOption = computed(() => props.options[selectedIndex.value] || null)
const activeOption = computed(() => props.options[activeIndex.value] || null)
const displayLabel = computed(() => selectedOption.value?.label || props.placeholder)

watch(
  () => props.options,
  () => {
    if (open.value) {
      syncActiveIndex()
      void nextTick(positionMenu)
    }
  },
)

watch(
  () => props.modelValue,
  () => {
    if (open.value) {
      syncActiveIndex()
    }
  },
)

function toggle() {
  if (props.disabled) {
    return
  }
  if (open.value) {
    close()
  } else {
    openMenu()
  }
}

function openMenu() {
  if (props.disabled) {
    return
  }
  open.value = true
  syncActiveIndex()
  void nextTick(() => {
    positionMenu()
    scrollActiveOptionIntoView()
  })
}

function close() {
  open.value = false
}

function syncActiveIndex() {
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : props.options.length > 0 ? 0 : -1
}

function selectOption(option) {
  if (!option || option.disabled) {
    return
  }
  emit('update:modelValue', option.value)
  close()
  void nextTick(() => triggerRef.value?.focus())
}

function positionMenu() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) {
    return
  }
  const gap = 6
  const maxHeight = Math.min(260, Math.max(160, window.innerHeight - rect.bottom - gap - 12))
  menuStyle.value = {
    left: `${rect.left}px`,
    top: `${rect.bottom + gap}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function moveActive(step) {
  if (!open.value) {
    openMenu()
    return
  }
  if (props.options.length === 0) {
    activeIndex.value = -1
    return
  }

  let nextIndex = activeIndex.value
  for (let attempts = 0; attempts < props.options.length; attempts += 1) {
    nextIndex = (nextIndex + step + props.options.length) % props.options.length
    if (!props.options[nextIndex]?.disabled) {
      activeIndex.value = nextIndex
      break
    }
  }
  void nextTick(scrollActiveOptionIntoView)
}

function scrollActiveOptionIntoView() {
  const optionElement = menuRef.value?.querySelector(`[data-option-index="${activeIndex.value}"]`)
  optionElement?.scrollIntoView({ block: 'nearest' })
}

function handleKeydown(event) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveActive(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      moveActive(-1)
      break
    case 'Home':
      event.preventDefault()
      activeIndex.value = firstEnabledIndex()
      void nextTick(scrollActiveOptionIntoView)
      break
    case 'End':
      event.preventDefault()
      activeIndex.value = lastEnabledIndex()
      void nextTick(scrollActiveOptionIntoView)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!open.value) {
        openMenu()
      } else {
        selectOption(activeOption.value)
      }
      break
    case 'Escape':
      event.preventDefault()
      close()
      break
    case 'Tab':
      close()
      break
    default:
      break
  }
}

function firstEnabledIndex() {
  const index = props.options.findIndex((option) => !option.disabled)
  return index >= 0 ? index : -1
}

function lastEnabledIndex() {
  for (let index = props.options.length - 1; index >= 0; index -= 1) {
    if (!props.options[index]?.disabled) {
      return index
    }
  }
  return -1
}

function handleDocumentPointerDown(event) {
  const path = event.composedPath?.() || []
  if (path.includes(triggerRef.value) || path.includes(menuRef.value)) {
    return
  }
  close()
}

function handleViewportChange() {
  if (open.value) {
    positionMenu()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <div class="relative">
    <button
      ref="triggerRef"
      type="button"
      class="qq-field-control flex w-full items-center justify-between gap-3 px-3 text-left text-sm transition"
      :aria-activedescendant="open && activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined"
      :aria-controls="`${selectId}-listbox`"
      :aria-disabled="disabled"
      :aria-expanded="open"
      :class="disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'"
      :disabled="disabled"
      role="combobox"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <span class="min-w-0 truncate" :class="selectedOption ? 'text-[color:var(--qq-text-primary)]' : 'text-[color:var(--qq-text-tertiary)]'">
        {{ displayLabel }}
      </span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-[color:var(--qq-text-tertiary)] transition"
        :class="open ? 'rotate-180 text-[color:var(--qq-accent)]' : ''"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        class="fixed z-[80] overflow-y-auto rounded-xl border border-[color:var(--qq-border-strong)] bg-white/95 p-1 shadow-[0_18px_42px_rgba(15,23,42,0.16)] backdrop-blur-xl"
        :style="menuStyle"
        :id="`${selectId}-listbox`"
        role="listbox"
      >
        <button
          v-for="(option, index) in options"
          :id="`${selectId}-option-${index}`"
          :key="`${option.value}-${index}`"
          :data-option-index="index"
          class="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition"
          :class="[
            option.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
            option.value === modelValue
              ? 'bg-[rgba(0,136,255,0.12)] text-[color:var(--qq-text-primary)]'
              : index === activeIndex
                ? 'bg-[rgba(15,23,42,0.055)] text-[color:var(--qq-text-primary)]'
                : 'text-[color:var(--qq-text-secondary)] hover:bg-[rgba(15,23,42,0.055)] hover:text-[color:var(--qq-text-primary)]',
          ]"
          role="option"
          type="button"
          :aria-selected="option.value === modelValue"
          :disabled="option.disabled"
          @mouseenter="activeIndex = index"
          @click="selectOption(option)"
        >
          <span class="min-w-0">
            <span class="block truncate">{{ option.label }}</span>
            <span v-if="option.description" class="mt-0.5 block truncate text-xs text-[color:var(--qq-text-tertiary)]">
              {{ option.description }}
            </span>
          </span>
          <Check v-if="option.value === modelValue" class="h-4 w-4 shrink-0 text-[color:var(--qq-accent)]" />
        </button>

        <div v-if="options.length === 0" class="px-3 py-2 text-sm text-[color:var(--qq-text-tertiary)]">
          暂无选项
        </div>
      </div>
    </Teleport>
  </div>
</template>
