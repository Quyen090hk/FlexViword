import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { IconName } from '@/components/common/icon-names'
import type { ExportFormat } from '@/utils/exporters'
import { buildExport, downloadText } from '@/utils/exporters'
import { t } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'

export interface CommandItem {
  id: string
  section: string
  icon: IconName
  label: string
  /** 额外匹配词（英文命令补中文拼音/别名等），不参与展示 */
  keywords?: string
  run: () => void
}

/** 全局命令注册表：响应式（语言/任务状态变化自动重建），供 ⌘K 面板消费 */
export function useCommands(): ComputedRef<CommandItem[]> {
  const router = useRouter()
  const tasks = useTasksStore()
  const settings = useSettingsStore()
  const ui = useUiStore()

  return computed<CommandItem[]>(() => {
    const navs: Array<{ path: string; icon: IconName; key: string; kw: string }> = [
      { path: '/', icon: 'film', key: 'nav.workspace', kw: 'workspace work' },
      { path: '/history', icon: 'clock', key: 'nav.history', kw: 'history' },
      { path: '/settings', icon: 'sliders', key: 'nav.settings', kw: 'settings config' },
      { path: '/about', icon: 'info', key: 'nav.about', kw: 'about' },
    ]
    const navigate: CommandItem[] = navs.map((item) => ({
      id: `nav:${item.path}`,
      section: t('palette.navigate'),
      icon: item.icon,
      label: t(item.key),
      keywords: item.kw,
      run: () => void router.push(item.path),
    }))

    const taskCommands: CommandItem[] = [
      {
        id: 'task:demo',
        section: t('palette.tasks'),
        icon: 'plus',
        label: t('workspace.demo'),
        keywords: 'demo',
        run: () => void tasks.addDemoTask().then(() => ui.toast('info', t('toast.demoLoaded'))),
      },
    ]
    const current = tasks.currentTask
    if (current && (tasks.runningId === current.id || tasks.queue.includes(current.id))) {
      taskCommands.push({
        id: 'task:cancel',
        section: t('palette.tasks'),
        icon: 'x',
        label: t('workspace.cancel'),
        run: () => tasks.cancel(current.id),
      })
    } else if (
      current?.stage === 'completed' ||
      current?.stage === 'failed' ||
      current?.stage === 'canceled'
    ) {
      taskCommands.push({
        id: 'task:retry',
        section: t('palette.tasks'),
        icon: 'play',
        label: t('workspace.startOver'),
        run: () => tasks.retry(current.id),
      })
    }

    // 无字幕时不注册导出命令：面板里出现"按了没反应"的哑命令比缺少命令更糟
    const canExport = !!tasks.currentTask?.segments?.length
    const exportCommands: CommandItem[] = canExport
      ? (['srt', 'vtt', 'txt', 'md'] as ExportFormat[]).map((format) => ({
          id: `export:${format}`,
          section: t('palette.export'),
          icon: 'download',
          label: `${t('workspace.export')} ${format.toUpperCase()}`,
          keywords: `export ${format}`,
          run: () => {
            const task = tasks.currentTask
            if (!task?.segments?.length) return
            const { filename, content, mime } = buildExport(
              format,
              task.name,
              task.meta,
              task.segments,
            )
            downloadText(filename, content, mime)
            ui.toast('success', t('toast.exported', { filename }))
          },
        }))
      : []

    const appearance: CommandItem[] = [
      {
        id: 'ui:theme',
        section: t('palette.appearance'),
        icon: settings.settings.theme === 'dark' ? 'sun' : 'moon',
        label:
          settings.settings.theme === 'dark' ? t('settings.themeLight') : t('settings.themeDark'),
        keywords: 'theme dark light',
        run: () =>
          settings.update({ theme: settings.settings.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        id: 'ui:locale',
        section: t('palette.appearance'),
        icon: 'globe',
        label: settings.settings.locale === 'zh-CN' ? 'English' : '简体中文',
        keywords: 'language locale i18n',
        run: () =>
          settings.update({ locale: settings.settings.locale === 'zh-CN' ? 'en-US' : 'zh-CN' }),
      },
    ]

    return [...navigate, ...taskCommands, ...exportCommands, ...appearance]
  })
}
