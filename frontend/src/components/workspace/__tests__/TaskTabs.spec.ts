import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import TaskTabs from '../TaskTabs.vue'
import { useTasksStore } from '@/stores/tasks'
import type { TaskRecord } from '@/types/domain'

function makeRecord(id: string, name: string, stage: TaskRecord['stage']): TaskRecord {
  return {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stage,
    progress: stage === 'completed' ? 100 : 0,
    video: { name, size: 0, mime: 'video/mp4' },
    // completed 任务视为有字幕数据（关闭需确认）
    segments:
      stage === 'completed' ? [{ id: `${id}_seg`, start: 0, end: 1, text: 'sample' }] : undefined,
  }
}

describe('TaskTabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.confirm = vi.fn(() => true)
  })

  async function seed(): Promise<ReturnType<typeof useTasksStore>> {
    const store = useTasksStore()
    store.tasks.push(
      makeRecord('task_a', 'a.mp4', 'completed'),
      makeRecord('task_b', 'b.mp4', 'transcribing'),
      makeRecord('task_c', 'c.mp4', 'failed'),
    )
    store.setCurrent('task_a')
    await flushPromises()
    return store
  }

  it('renders one tab per task with the active one marked', async () => {
    await seed()
    const wrapper = mount(TaskTabs)
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    const active = tabs.find((tab) => tab.attributes('aria-selected') === 'true')
    expect(active?.text()).toContain('a.mp4')
  })

  it('clicking a tab selects the task', async () => {
    const store = await seed()
    const wrapper = mount(TaskTabs)
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(store.currentId).toBe('task_b')
  })

  it('close removes the task without confirm when it has no transcript', async () => {
    const store = await seed()
    store.byId('task_b')!.stage = 'queued' // 无字幕数据
    const wrapper = mount(TaskTabs)
    const confirmSpy = vi.spyOn(window, 'confirm')
    await wrapper.findAll('[role="tab"]')[1]!.find('.tab-close').trigger('click')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(store.byId('task_b')).toBeUndefined()
  })

  it('asks for confirmation before closing a task that has a transcript', async () => {
    const store = await seed()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(TaskTabs)
    // task_a 已完成（有字幕）→ 关闭需确认；mock 返回 false → 不删除
    await wrapper.findAll('[role="tab"]')[0]!.find('.tab-close').trigger('click')
    expect(confirmSpy).toHaveBeenCalled()
    expect(store.byId('task_a')).toBeDefined()
  })
})
