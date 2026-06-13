<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section class="w-full max-w-lg rounded-lg bg-white shadow-panel" role="dialog" aria-modal="true">
        <header class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 class="text-base font-semibold">
            <slot name="title">{{ title }}</slot>
          </h2>
          <button class="focus-ring rounded-md p-1 text-slate-500 hover:bg-slate-100" @click="$emit('close')">
            <X class="h-5 w-5" aria-hidden="true" />
            <span class="sr-only">关闭</span>
          </button>
        </header>
        <div class="px-5 py-4">
          <slot name="content">
            <slot />
          </slot>
        </div>
        <footer v-if="$slots.footer" class="border-t border-line px-5 py-4">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { X } from 'lucide-vue-next'

defineProps({
  title: {
    type: String,
    default: '',
  },
})

defineEmits(['close'])
</script>
