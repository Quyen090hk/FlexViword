import { createRouter, createWebHashHistory } from 'vue-router'
import { t } from '@/i18n'

/**
 * Hash 历史：桌面壳（wails://）与静态部署（file:// / 无服务端重写）都能工作。
 * 每个视图懒加载 —— 路由级代码分割是首屏性能的基础手段。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'workspace',
      component: () => import('@/views/WorkspaceView.vue'),
      meta: { title: 'nav.workspace' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { title: 'nav.history' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'nav.settings' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: 'nav.about' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const app = 'FlexViword'
  document.title = to.meta.title ? `${t(to.meta.title as string)} · ${app}` : app
})

export { router }
