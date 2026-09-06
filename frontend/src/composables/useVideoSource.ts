import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { TaskRecord } from '@/types/domain'
import { getVideoFile } from '@/services/db/task-repository'
import { getWailsApp, isDesktop } from '@/services/bridge/platform'

export type VideoSourceKind = 'object' | 'remote' | 'none'

export interface VideoSource {
  kind: VideoSourceKind
  url: string | null
}

/**
 * 把任务解析为 <video> 可播放的 src：
 * - web：从任务仓库取回 File → ObjectURL（切任务时 revoke，防内存泄漏）
 * - wails：Go 侧起本地流媒体服务（支持 Range，进度条可拖动）
 * - 演示任务 / 文件缺失：none，播放器显示占位
 */
export function useVideoSource(task: Ref<TaskRecord | null | undefined>) {
  const source = ref<VideoSource>({ kind: 'none', url: null })
  let currentObjectUrl: string | null = null

  function cleanup(): void {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl)
      currentObjectUrl = null
    }
  }

  watch(
    task,
    async (record) => {
      cleanup()
      source.value = { kind: 'none', url: null }
      if (!record) return
      if (isDesktop()) {
        if (!record.video.path) return
        try {
          const url = await getWailsApp().GetVideoStreamURL(record.video.path)
          source.value = { kind: 'remote', url }
        } catch {
          source.value = { kind: 'none', url: null }
        }
        return
      }
      const file = await getVideoFile(record.id)
      if (file) {
        currentObjectUrl = URL.createObjectURL(file)
        source.value = { kind: 'object', url: currentObjectUrl }
      }
    },
    { immediate: true },
  )

  onScopeDispose(cleanup)

  return source
}
