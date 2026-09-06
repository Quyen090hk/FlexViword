import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useTasksStore } from './stores/tasks'
import { useSettingsStore } from './stores/settings'
import '@fontsource-variable/space-grotesk'
import './styles/tokens.css'
import './styles/base.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 任务记录在应用启动时异步装载（IndexedDB → store）
useTasksStore().init()

// 开发态调试钩子：控制台可直接操作 store（E2E 手测用），生产构建不存在
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__flexviword = {
    tasks: useTasksStore(),
    settings: useSettingsStore(),
  }
}

app.mount('#app')
