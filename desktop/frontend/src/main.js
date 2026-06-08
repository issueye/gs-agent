import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/tailwind.css'
import './assets/qq-ued.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
