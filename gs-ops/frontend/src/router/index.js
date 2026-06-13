import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Logs from '../views/Logs.vue'
import ServiceDetail from '../views/ServiceDetail.vue'
import ServiceList from '../views/ServiceList.vue'
import Settings from '../views/Settings.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/services', name: 'services', component: ServiceList },
    { path: '/services/:id', name: 'service-detail', component: ServiceDetail },
    { path: '/logs', name: 'logs', component: Logs },
    { path: '/settings', name: 'settings', component: Settings },
  ],
})

export default router
