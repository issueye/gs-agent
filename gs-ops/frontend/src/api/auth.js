import client from './client'

// 登录
export function login(username, password) {
  return client.post('/auth/login', { username, password })
}

// 登出
export function logout() {
  return client.post('/auth/logout', {})
}

// 获取当前用户信息
export function getCurrentUser() {
  return client.get('/auth/me')
}

// 获取当前用户权限
export function getUserPermissions() {
  return client.get('/auth/permissions')
}

// 修改密码
export function changePassword(oldPassword, newPassword) {
  return client.put('/auth/password', { oldPassword, newPassword })
}

// 刷新 Token
export function refreshToken(refreshToken) {
  return client.post('/auth/refresh', { refreshToken })
}
