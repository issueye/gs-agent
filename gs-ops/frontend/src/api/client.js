// API 客户端基础配置
const API_BASE_URL = 'http://127.0.0.1:7310/api'

// 获取 Token
function getToken() {
  return localStorage.getItem('access_token')
}

// 设置 Token
function setToken(token) {
  localStorage.setItem('access_token', token)
}

// 移除 Token
function removeToken() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// HTTP 请求封装
async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const config = {
    ...options,
    headers,
  }

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config)
    const data = await response.json()

    if (!response.ok) {
      // Token 过期，尝试刷新
      if (response.status === 401 && token) {
        const refreshed = await refreshToken()
        if (refreshed) {
          // 重试原请求
          return request(url, options)
        } else {
          // 刷新失败，跳转登录
          removeToken()
          window.location.href = '/#/login'
          throw new Error('登录已过期，请重新登录')
        }
      }

      throw new Error(data.message || '请求失败')
    }

    return data
  } catch (error) {
    console.error('API request error:', error)
    throw error
  }
}

// 刷新 Token
async function refreshToken() {
  try {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      return false
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        setToken(data.data.accessToken)
        localStorage.setItem('refresh_token', data.data.refreshToken)
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Refresh token error:', error)
    return false
  }
}

export default {
  get: (url, options) => request(url, { ...options, method: 'GET' }),
  post: (url, data, options) =>
    request(url, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (url, data, options) =>
    request(url, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
  setToken,
  getToken,
  removeToken,
}
