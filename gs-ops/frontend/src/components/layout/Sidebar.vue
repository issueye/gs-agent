<template>
  <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">
    <div class="flex h-16 items-center border-b border-line px-5">
      <div class="grid h-9 w-9 place-items-center rounded-md bg-accent text-sm font-bold text-white">GS</div>
      <div class="ml-3">
        <p class="text-sm font-semibold">GS-OPS</p>
        <p class="text-xs text-slate-500">服务控制台</p>
      </div>
    </div>
    <nav class="space-y-1 px-3 py-4">
      <RouterLink
        v-for="item in visibleNavItems"
        :key="item.to"
        :to="item.to"
        class="focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        active-class="bg-blue-50 text-accent"
      >
        <component :is="item.icon" class="h-4 w-4" aria-hidden="true" />
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { Activity, FileText, Gauge, Settings, Server, Users } from 'lucide-vue-next'
import { useUserStore } from '../../stores/user'

const userStore = useUserStore()

const navItems = [
  { label: '仪表盘', to: '/', icon: Gauge },
  { label: '服务管理', to: '/services', icon: Server },
  { label: '操作日志', to: '/logs', icon: FileText },
  { label: '用户管理', to: '/users', icon: Users, permission: 'users:manage' },
  { label: '系统设置', to: '/settings', icon: Settings },
  { label: '监控', to: '/monitor', icon: Activity },
]

// 根据权限过滤菜单项
const visibleNavItems = computed(() => {
  return navItems.filter(item => {
    // 没有权限要求的菜单项始终显示
    if (!item.permission) {
      return true
    }
    // 检查用户是否有该权限
    return userStore.hasPermission(item.permission)
  })
})
</script>
