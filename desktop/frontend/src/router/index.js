import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import AgentsView from '@/views/AgentsView.vue'
import ChatConversationView from '@/views/ChatConversationView.vue'
import ChatHomeView from '@/views/ChatHomeView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import ProvidersView from '@/views/ProvidersView.vue'
import ScheduledTasksView from '@/views/ScheduledTasksView.vue'
import SearchView from '@/views/SearchView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SkillsView from '@/views/SkillsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', redirect: '/chat' },
        { path: '/chat', name: 'chat-home', component: ChatHomeView },
        { path: '/chat/:id', name: 'chat-conversation', component: ChatConversationView },
        {
          path: '/search',
          name: 'search',
          component: SearchView,
        },
        {
          path: '/providers',
          name: 'providers',
          component: ProvidersView,
        },
        {
          path: '/agents',
          name: 'agents',
          component: AgentsView,
        },
        {
          path: '/skills',
          name: 'skills',
          component: SkillsView,
        },
        {
          path: '/plugins',
          name: 'plugins',
          component: PlaceholderView,
          meta: {
            eyebrow: '占位模块',
            title: 'Plugins',
            description: '插件页先作为结构占位，避免聊天主链路被旁支功能拖住。',
          },
        },
        {
          path: '/scheduled-tasks',
          name: 'scheduled-tasks',
          component: ScheduledTasksView,
        },
        { path: '/settings', name: 'settings', component: SettingsView },
      ],
    },
  ],
})

export default router
