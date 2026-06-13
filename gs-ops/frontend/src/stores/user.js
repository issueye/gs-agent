import { defineStore } from 'pinia'
import * as authApi from '../api/auth'
import * as userApi from '../api/user'
import client from '../api/client'

export const useUserStore = defineStore('user', {
  state: () => ({
    currentUser: null,
    permissions: [],
    isAuthenticated: false,
    loading: false,
  }),

  getters: {
    // 是否是管理员
    isAdmin: (state) => state.currentUser?.role === 'admin',

    // 是否是操作员
    isOperator: (state) => state.currentUser?.role === 'operator',

    // 是否是查看者
    isViewer: (state) => state.currentUser?.role === 'viewer',

    // 检查是否有某个权限
    hasPermission: (state) => (permission) => {
      return state.permissions.includes(permission)
    },

    // 检查是否有任一权限
    hasAnyPermission: (state) => (...permissions) => {
      return permissions.some(p => state.permissions.includes(p))
    },

    // 检查是否有所有权限
    hasAllPermissions: (state) => (...permissions) => {
      return permissions.every(p => state.permissions.includes(p))
    },
  },

  actions: {
    // 登录
    async login(username, password) {
      this.loading = true
      try {
        const response = await authApi.login(username, password)
        if (response.success) {
          const { user, accessToken, refreshToken } = response.data

          // 保存 Token
          client.setToken(accessToken)
          localStorage.setItem('refresh_token', refreshToken)

          // 保存用户信息
          this.currentUser = user
          this.isAuthenticated = true

          // 获取权限
          await this.fetchPermissions()

          return true
        }
        return false
      } catch (error) {
        console.error('Login error:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 登出
    async logout() {
      try {
        await authApi.logout()
      } catch (error) {
        console.error('Logout error:', error)
      } finally {
        // 清除本地状态
        this.currentUser = null
        this.permissions = []
        this.isAuthenticated = false
        client.removeToken()
      }
    },

    // 获取当前用户信息
    async fetchCurrentUser() {
      try {
        const response = await authApi.getCurrentUser()
        if (response.success) {
          this.currentUser = response.data
          this.isAuthenticated = true
          return true
        }
        return false
      } catch (error) {
        console.error('Fetch current user error:', error)
        this.isAuthenticated = false
        return false
      }
    },

    // 获取用户权限
    async fetchPermissions() {
      try {
        const response = await authApi.getUserPermissions()
        if (response.success) {
          this.permissions = response.data.permissions || []
          return true
        }
        return false
      } catch (error) {
        console.error('Fetch permissions error:', error)
        return false
      }
    },

    // 修改密码
    async changePassword(oldPassword, newPassword) {
      this.loading = true
      try {
        const response = await authApi.changePassword(oldPassword, newPassword)
        return response.success
      } catch (error) {
        console.error('Change password error:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    // 初始化（页面加载时调用）
    async initialize() {
      const token = client.getToken()
      if (token) {
        await this.fetchCurrentUser()
        await this.fetchPermissions()
      }
    },
  },
})

