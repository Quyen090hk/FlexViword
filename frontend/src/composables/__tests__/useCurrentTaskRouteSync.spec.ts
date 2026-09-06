import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { useCurrentTaskRouteSync } from '../useCurrentTaskRouteSync'
import { useTasksStore } from '@/stores/tasks'
import { clearAllTasks, saveTask } from '@/services/db/task-repository'
import type { TaskRecord } from '@/types/domain'

function makeRecord(id: string): TaskRecord {
  return {
    id,
    name: `${id}.mp4`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stage: 'completed',
    progress: 100,
    video: { name: `${id}.mp4`, size: 0, mime: 'video/mp4' },
  }
}

const Harness = defineComponent({
  setup() {
    useCurrentTaskRouteSync()
    return () => '<div />'
  },
})

describe('useCurrentTaskRouteSync', () => {
  let router: Router
  let pinia: ReturnType<typeof createPinia>

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    // fake-indexeddb 在同文件的测试间持久化：显式清库保证隔离
    await clearAllTasks()
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: Harness }],
    })
    router.push('/')
    await router.isReady()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  async function mountHarness(): Promise<void> {
    // pinia 必须显式安装进 app：不持有引用的 activePinia 会让组件与测试拿到不同实例
    mount(Harness, { global: { plugins: [pinia, router] } })
    await flushPromises()
  }

  it('writes the selected task into ?task=', async () => {
    await mountHarness()
    const store = useTasksStore()
    store.tasks.push(makeRecord('task_a'))
    store.setCurrent('task_a')
    await flushPromises()
    expect(router.currentRoute.value.query.task).toBe('task_a')
  })

  it('clears the query when selection is removed', async () => {
    const store = useTasksStore()
    store.tasks.push(makeRecord('task_a'))
    store.setCurrent('task_a')
    router.replace({ query: { task: 'task_a' } })
    await router.isReady()
    await mountHarness()
    store.setCurrent(null)
    await flushPromises()
    expect(router.currentRoute.value.query.task).toBeUndefined()
  })

  it('restores the selected task from ?task= on mount', async () => {
    // 与生产一致的路径：记录先落在仓库里，由 init() 装载后再挂载
    const store = useTasksStore()
    await saveTask(makeRecord('task_b'))
    await store.init()
    router.replace({ query: { task: 'task_b' } })
    await router.isReady()
    await mountHarness()
    expect(store.currentId).toBe('task_b')
    expect(router.currentRoute.value.query.task).toBe('task_b')
  })

  it('ignores ?task= values that do not exist', async () => {
    const store = useTasksStore()
    await store.init()
    router.replace({ query: { task: 'ghost' } })
    await router.isReady()
    await mountHarness()
    expect(store.byId('ghost')).toBeUndefined()
    expect(store.currentId).toBeNull()
    expect(router.currentRoute.value.query.task).toBe('ghost')
  })
})
