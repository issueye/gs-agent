<template>
  <header class="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
    <div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <div>
        <p class="text-sm text-slate-500">运维管理平台</p>
        <h1 class="text-lg font-semibold">GS-OPS</h1>
      </div>
      <div class="flex items-center gap-3">
        <div class="hidden items-center gap-2 rounded-md border border-line bg-field px-3 py-2 text-sm sm:flex">
          <ShieldCheck class="h-4 w-4 text-success" aria-hidden="true" />
          {{ roleLabel }}
        </div>

        <!-- 用户菜单 -->
        <div class="relative" ref="userMenuRef">
          <button
            @click="toggleUserMenu"
            class="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm font-semibold text-white hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {{ initials }}
          </button>

          <!-- 下拉菜单 -->
          <div
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg border border-gray-200 py-2"
          >
            <div class="px-4 py-3 border-b border-gray-200">
              <p class="text-sm font-semibold text-gray-900">{{ currentUser?.displayName || currentUser?.username }}</p>
              <p class="text-xs text-gray-500 mt-1">{{ currentUser?.email || currentUser?.username }}</p>
            </div>

            <router-link
              v-if="canManageUsers"
              to="/users"
              @click="closeUserMenu"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Users class="inline h-4 w-4 mr-2" />
              用户管理
            </router-link>

            <router-link
              to="/settings"
              @click="closeUserMenu"
              class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Settings class="inline h-4 w-4 mr-2" />
              个人设置
            </router-link>

            <div class="border-t border-gray-200 my-2"></div>

            <button
              @click="handleLogout"
              class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              <LogOut class="inline h-4 w-4 mr-2" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck, Users, Settings, LogOut } from 'lucide-vue-next'
import { useUserStore } from '../../stores/user'

const router = useRouter()
const userStore = useUserStore()

const showUserMenu = ref(false)
const userMenuRef = ref(null)

const currentUser = computed(() => userStore.currentUser)
const canManageUsers = computed(() => userStore.hasPermission('users:manage'))

const initials = computed(() => {
  if (!currentUser.value) return 'U'
  const name = currentUser.value.displayName || currentUser.value.username
  return name.slice(0, 1).toUpperCase()
})

const roleLabel = computed(() => {
  if (!currentUser.value) return ''
  const roleLabels = {
    admin: '管理员',
    operator: '操作员',
    viewer: '查看者'
  }
  return roleLabels[currentUser.value.role] || currentUser.value.role
})

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu() {
  showUserMenu.value = false
}

async function handleLogout() {
  closeUserMenu()
  await userStore.logout()
  router.push('/login')
}

// 点击外部关闭菜单
function handleClickOutside(event) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    closeUserMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
