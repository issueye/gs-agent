import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Logs from '../views/Logs.vue'
import ServiceDetail from '../views/ServiceDetail.vue'
import ServiceList from '../views/ServiceList.vue'
import Settings from '../views/Settings.vue'
import Login from '../views/Login.vue'
import UserManagement from '../views/UserManagement.vue'
import { useUserStore } from '../stores/user'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/services',
      name: 'services',
      component: ServiceList,
      meta: { requiresAuth: true }
    },
    {
      path: '/services/:id',
      name: 'service-detail',
      component: ServiceDetail,
      meta: { requiresAuth: true }
    },
    {
      path: '/logs',
      name: 'logs',
      component: Logs,
      meta: { requiresAuth: true }
    },
    {
      path: '/users',
      name: 'users',
      component: UserManagement,
      meta: {
        requiresAuth: true,
        requiredPermission: 'users:manage'
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: Settings,
      meta: { requiresAuth: true }
    },
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  // 不需要认证的路由
  if (to.meta.requiresAuth === false) {
    // 如果已登录，跳转到首页
    if (userStore.isAuthenticated) {
      next('/')
    } else {
      next()
    }
    return
  }

  // 需要认证的路由
  if (!userStore.isAuthenticated) {
    // 尝试从 Token 恢复登录状态
    await userStore.initialize()

    if (!userStore.isAuthenticated) {
      // 未登录，跳转到登录页
      next('/login')
      return
    }
  }

  // 检查权限
  if (to.meta.requiredPermission) {
    if (!userStore.hasPermission(to.meta.requiredPermission)) {
      // 无权限，跳转到首页
      alert('您没有访问该页面的权限')
      next('/')
      return
    }
  }

  next()
})

export default router
