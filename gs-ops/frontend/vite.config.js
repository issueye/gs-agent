import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 7311,
    proxy: {
      '/api': 'http://127.0.0.1:7310',
      '/ws': {
        target: 'ws://127.0.0.1:7310',
        ws: true,
      },
    },
  },
})

