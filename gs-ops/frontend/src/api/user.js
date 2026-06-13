import client from './client'

// 获取用户列表
export function getUserList() {
  return client.get('/users')
}

// 获取用户详情
export function getUser(id) {
  return client.get(`/users/${id}`)
}

// 创建用户
export function createUser(userData) {
  return client.post('/users', userData)
}

// 更新用户
export function updateUser(id, userData) {
  return client.put(`/users/${id}`, userData)
}

// 删除用户
export function deleteUser(id) {
  return client.delete(`/users/${id}`)
}

// 重置用户密码
export function resetUserPassword(id, newPassword) {
  return client.put(`/users/${id}/password`, { newPassword })
}
