<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  columns: {
    type: Array,
    default: () => [],
  },
  rows: {
    type: Array,
    default: () => [],
  },
})

const slots = useSlots()

const normalizedColumns = computed(() =>
  props.columns.map((column) => ({
    align: 'left',
    ...column,
  })),
)

function hasSlot(key) {
  return Boolean(slots[`cell-${key}`])
}

function statusTone(value) {
  if (value === 'online') return '#38e1b8'
  if (value === 'busy') return '#ffd968'
  if (value === 'offline') return '#ff9db9'
  return 'rgba(255,255,255,0.56)'
}
</script>

<template>
  <div class="qq-panel overflow-hidden rounded-[6px]">
    <div class="scrollbar-thin overflow-x-auto">
      <table class="qq-table min-w-full">
        <thead>
          <tr>
            <th v-for="column in normalizedColumns" :key="column.key" :class="column.align === 'right' ? 'text-right' : ''">
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in rows" :key="row.id || rowIndex">
            <td
              v-for="column in normalizedColumns"
              :key="column.key"
              class="text-sm text-[color:var(--qq-text-secondary)]"
              :class="column.align === 'right' ? 'text-right' : ''"
            >
              <slot v-if="hasSlot(column.key)" :name="`cell-${column.key}`" :row="row" :value="row[column.key]" />
              <template v-else-if="column.type === 'status'">
                <span class="inline-flex items-center gap-2">
                  <span class="qq-status-dot" :style="{ backgroundColor: statusTone(row[column.key]) }" />
                  {{ row[column.key] }}
                </span>
              </template>
              <template v-else>
                {{ row[column.key] }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
