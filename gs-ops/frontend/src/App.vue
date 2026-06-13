<template>
  <div class="min-h-screen bg-field text-ink">
    <!-- 登录页面不显示布局 -->
    <template v-if="$route.path === '/login'">
      <RouterView />
    </template>

    <!-- 主布局 -->
    <template v-else>
      <AppSidebar />
      <div class="min-h-screen lg:pl-64">
        <AppHeader />
        <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <RouterView />
        </main>
        <AppFooter />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppFooter from './components/layout/Footer.vue'
import AppHeader from './components/layout/Header.vue'
import AppSidebar from './components/layout/Sidebar.vue'
import { useUserStore } from './stores/user'

const route = useRoute()
const userStore = useUserStore()

// 应用启动时初始化用户状态
onMounted(async () => {
  await userStore.initialize()
})
</script>

