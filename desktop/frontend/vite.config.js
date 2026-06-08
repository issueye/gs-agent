import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wails from '@wailsio/runtime/plugins/vite'

const gatewayProxyTarget = process.env.GATEWAY_PROXY_TARGET || 'http://127.0.0.1:8080'

const gatewayProxy = {
  target: gatewayProxyTarget,
  changeOrigin: true,
  ws: true,
}

export default defineConfig({
  plugins: [vue(), wails('./bindings')],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/health': gatewayProxy,
      '/v1': gatewayProxy,
    },
  },
  preview: {
    proxy: {
      '/health': gatewayProxy,
      '/v1': gatewayProxy,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
