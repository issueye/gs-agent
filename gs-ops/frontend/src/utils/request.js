import axios from 'axios'

export const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'X-Operator': 'admin',
  },
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed'
    return Promise.reject(new Error(message))
  },
)

