import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasksStore } from '@/stores/tasks'

/**
 * URL 状态同步（状态管理阶梯的第 4 级）：
 * 当前任务写入 ?task= 查询参数 —— 刷新可恢复、链接可分享；
 * 反向：带 ?task= 打开时恢复选中。其余 UI 状态仍各归其位（本地/Store）。
 */
export function useCurrentTaskRouteSync(): void {
  const route = useRoute()
  const router = useRouter()
  const tasks = useTasksStore()

  onMounted(async () => {
    // 等待装载真正完成（与 main.ts 的启动装载共享同一个 Promise）
    await tasks.init()
    const requested = route.query.task
    if (typeof requested === 'string' && tasks.byId(requested)) {
      tasks.setCurrent(requested)
    }
  })

  watch(
    () => tasks.currentId,
    (id) => {
      const inQuery = typeof route.query.task === 'string' ? route.query.task : null
      if ((id ?? null) === inQuery) return
      void router.replace({ query: id ? { task: id } : {} })
    },
  )
}
