<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { TranscriptSegment } from '@/types/domain'
import { useTasksStore } from '@/stores/tasks'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useVirtualList } from '@/composables/useVirtualList'
import { t } from '@/i18n'
import { formatDuration } from '@/utils/time'
import {
  buildExport,
  downloadText,
  buildPlainText,
  FORMAT_TIMESTAMP_POLICY,
  FORMAT_DEFAULT_TIMESTAMPS,
} from '@/utils/exporters'
import AppButton from '@/components/common/AppButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/common/Icon.vue'
import AppModal from '@/components/common/AppModal.vue'
import type { ExportFormat } from '@/utils/exporters'

/**
 * 字幕面板：
 * - 固定行高虚拟列表（长转录零卡顿）；
 * - 播放位置 → activeSegmentId（player store），反向点击 → requestSeek；
 * - 编辑走底部编辑条（保持行高恒定，虚拟化假设不被破坏），支持撤销/重做；
 * - 导出前先预览生成内容（SRT/VTT/TXT/MD）。
 */
const ITEM_HEIGHT = 64

const tasks = useTasksStore()
const player = usePlayerStore()
const settings = useSettingsStore()
const ui = useUiStore()

const filter = ref('')
const containerRef = ref<HTMLElement | null>(null)
const editingId = ref<string | null>(null)
const draft = ref('')
const preview = ref<{
  format: ExportFormat
  filename: string
  mime: string
} | null>(null)
/** 导出是否包含时间戳（仅 optional 格式可切换；required 格式固定为 true） */
const withTimestamps = ref(true)
const exportOptions = computed(() => ({ includeTimestamps: withTimestamps.value }))

/** 预览内容实时重生成：模态框里切换时间戳开关立即反映 */
const previewContent = computed(() => {
  const p = preview.value
  if (!p) return ''
  return buildExport(p.format, task.value?.name ?? '', task.value?.meta, segments.value, {
    includeTimestamps: withTimestamps.value,
  }).content
})

const timestampSwitchable = computed(
  () => preview.value !== null && FORMAT_TIMESTAMP_POLICY[preview.value.format] === 'optional',
)

const task = computed(() => tasks.currentTask)
const segments = computed<TranscriptSegment[]>(() => task.value?.segments ?? [])

const filtered = computed(() => {
  const keyword = filter.value.trim().toLowerCase()
  if (!keyword) return segments.value
  return segments.value.filter((segment) => segment.text.toLowerCase().includes(keyword))
})

/** 任务尚在流水线中：字幕区显示骨架屏而不是空态文案 */
const isBusy = computed(() => {
  const current = task.value
  if (!current) return false
  return (
    tasks.runningId === current.id ||
    ['queued', 'downloading', 'extracting', 'transcribing'].includes(current.stage)
  )
})

const { virtualItems, totalHeight, onScroll, measure, scrollToIndex } = useVirtualList({
  items: filtered,
  itemHeight: ITEM_HEIGHT,
  container: containerRef,
})

onMounted(measure)

/** 跟随播放：当前句变化时平滑滚动到可见区 */
watch(
  () => player.activeSegmentId,
  (id) => {
    if (!id || !settings.settings.autoScrollTranscript || !player.isPlaying) return
    const index = filtered.value.findIndex((segment) => segment.id === id)
    if (index >= 0) scrollToIndex(Math.max(0, index - 2), 'smooth')
  },
)

function seekTo(segment: TranscriptSegment): void {
  player.requestSeek(segment.start)
}

function startEdit(segment: TranscriptSegment): void {
  editingId.value = segment.id
  draft.value = segment.text
}

function commitEdit(): void {
  if (task.value && editingId.value) {
    tasks.updateSegment(task.value.id, editingId.value, draft.value.trim())
  }
  editingId.value = null
}

function cancelEdit(): void {
  editingId.value = null
}

const canUndo = computed(() =>
  task.value ? (tasks.editHistory.get(task.value.id)?.undo.length ?? 0) > 0 : false,
)
const canRedo = computed(() =>
  task.value ? (tasks.editHistory.get(task.value.id)?.redo.length ?? 0) > 0 : false,
)

function undo(): void {
  if (task.value) tasks.undoEdit(task.value.id)
}

function redo(): void {
  if (task.value) tasks.redoEdit(task.value.id)
}

const EXPORTS: { format: ExportFormat; key: string }[] = [
  { format: 'srt', key: 'SRT' },
  { format: 'vtt', key: 'VTT' },
  { format: 'txt', key: 'TXT' },
  { format: 'md', key: 'Markdown' },
]

/** 导出前先预览：生成内容放进 Modal，确认后再下载 */
function requestExport(format: ExportFormat): void {
  const current = task.value
  if (!current?.segments?.length) return
  const { filename, mime } = buildExport(
    format,
    current.name,
    current.meta,
    current.segments,
    exportOptions.value,
  )
  // 时间戳偏好按格式重置为默认值（SRT/VTT 固定带，TXT 默认关、MD 默认开）
  withTimestamps.value = FORMAT_DEFAULT_TIMESTAMPS[format]
  preview.value = { format, filename, mime }
}

function confirmExport(): void {
  if (!preview.value) return
  downloadText(preview.value.filename, previewContent.value, preview.value.mime)
  ui.toast('success', t('toast.exported', { filename: preview.value.filename }))
  preview.value = null
}

async function copyAll(): Promise<void> {
  const current = task.value
  if (!current?.segments?.length) return
  try {
    await navigator.clipboard.writeText(buildPlainText(current.segments))
    ui.toast('success', t('common.copied'))
  } catch {
    ui.toast('error', t('errors.unknown'))
  }
}
</script>

<template>
  <section class="panel">
    <header class="head">
      <h3 class="title">
        {{ t('workspace.transcriptTitle') }}
        <span v-if="segments.length" class="count"
          >{{ filtered.length }}/{{ segments.length }}</span
        >
      </h3>
      <div class="tools">
        <label class="search">
          <Icon name="search" :size="14" />
          <input v-model="filter" :placeholder="t('workspace.searchPlaceholder')" type="search" />
        </label>
        <div v-if="segments.length" class="history-tools">
          <AppButton
            variant="subtle"
            :disabled="!canUndo"
            :aria-label="t('common.undo')"
            @click="undo"
          >
            <Icon name="undo" :size="14" />
          </AppButton>
          <AppButton
            variant="subtle"
            :disabled="!canRedo"
            :aria-label="t('common.redo')"
            @click="redo"
          >
            <Icon name="redo" :size="14" />
          </AppButton>
        </div>
        <details v-if="segments.length" class="menu">
          <summary>
            <Icon name="download" :size="14" />
            {{ t('workspace.export') }}
          </summary>
          <div class="menu-body">
            <button
              v-for="item in EXPORTS"
              :key="item.format"
              type="button"
              @click="requestExport(item.format)"
            >
              {{ item.key }}
            </button>
          </div>
        </details>
        <AppButton v-if="segments.length" variant="subtle" @click="copyAll">
          <Icon name="copy" :size="14" />
          {{ t('workspace.copyAll') }}
        </AppButton>
      </div>
    </header>

    <div v-if="filtered.length > 0" ref="containerRef" class="list" @scroll.passive="onScroll">
      <div class="spacer" :style="{ height: `${totalHeight}px` }">
        <div
          v-for="v in virtualItems"
          :key="v.item.id"
          class="item"
          :class="{ active: player.activeSegmentId === v.item.id }"
          :style="{ transform: `translateY(${v.offset}px)`, height: `${ITEM_HEIGHT - 6}px` }"
          @click="seekTo(v.item)"
        >
          <div class="meta">
            <span class="timecode">
              {{ formatDuration(v.item.start) }} → {{ formatDuration(v.item.end) }}
            </span>
            <span v-if="v.item.edited" class="edited">{{ t('workspace.edited') }}</span>
          </div>
          <p class="text">{{ v.item.text }}</p>
          <button
            class="edit"
            type="button"
            :aria-label="t('workspace.edit')"
            @click.stop="startEdit(v.item)"
          >
            <Icon name="pencil" :size="13" />
          </button>
        </div>
      </div>
    </div>
    <div
      v-else-if="task && isBusy"
      class="skeleton"
      role="status"
      aria-busy="true"
      :aria-label="t('common.loading')"
    >
      <div v-for="i in 5" :key="i" class="skeleton-row" :style="{ animationDelay: `${i * 130}ms` }">
        <span class="skeleton-time" />
        <span class="skeleton-text" />
      </div>
    </div>
    <EmptyState
      v-else-if="task"
      icon="film"
      :title="segments.length > 0 ? t('workspace.noMatch') : t('workspace.noSegments')"
    />

    <footer v-if="editingId" class="editor">
      <textarea v-model="draft" rows="3" @keydown.enter.ctrl="commitEdit" />
      <div class="editor-actions">
        <span class="hint">Ctrl + Enter</span>
        <AppButton variant="subtle" @click="cancelEdit">{{ t('common.cancel') }}</AppButton>
        <AppButton variant="primary" @click="commitEdit">{{ t('common.confirm') }}</AppButton>
      </div>
    </footer>

    <AppModal
      :open="preview !== null"
      :title="preview ? `${t('common.preview')} · ${preview.format.toUpperCase()}` : ''"
      wide
      @close="preview = null"
    >
      <div v-if="preview" class="preview-tools">
        <label v-if="timestampSwitchable" class="ts-toggle">
          <button
            type="button"
            class="switch"
            :class="{ on: withTimestamps }"
            role="switch"
            :aria-checked="withTimestamps"
            @click="withTimestamps = !withTimestamps"
          >
            <span class="knob" />
          </button>
          {{ t('export.includeTimestamps') }}
        </label>
        <span v-else class="ts-locked">{{ t('export.timestampsRequired') }}</span>
      </div>
      <pre v-if="preview" class="preview">{{ previewContent }}</pre>
      <template #footer>
        <AppButton variant="subtle" @click="preview = null">{{ t('common.cancel') }}</AppButton>
        <AppButton variant="primary" @click="confirmExport">
          <Icon name="download" :size="14" />
          {{ t('common.download') }}
        </AppButton>
      </template>
    </AppModal>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--panel);
  overflow: hidden;
  min-height: 320px;
  height: 100%;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 2px solid var(--accent);
  flex-wrap: wrap;
}

.title {
  font-size: 0.95rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count {
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-tools {
  display: flex;
  gap: 4px;
}

/* 识别中的骨架屏：脉冲动画只走 opacity（prefers-reduced-motion 下全局失效） */
.skeleton {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  animation: skeleton-pulse 1.4s var(--ease-out) infinite;
}

.skeleton-time {
  width: 86px;
  height: 10px;
  border-radius: 5px;
  background: var(--border);
  flex-shrink: 0;
}

.skeleton-text {
  flex: 1;
  height: 12px;
  border-radius: 6px;
  background: var(--border);
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.preview-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 2px 2px;
}

.ts-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--text-muted);
  cursor: pointer;
}

.ts-locked {
  font-size: 0.78rem;
  color: var(--text-faint);
}

.switch {
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-soft);
  position: relative;
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out);
  flex-shrink: 0;
}

.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all var(--dur-fast) var(--ease-spring);
}

.switch.on {
  background: var(--accent);
  border-color: var(--accent);
}

.switch.on .knob {
  left: 18px;
  background: var(--accent-contrast);
}

.preview {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  line-height: 1.6;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 50vh;
  overflow-y: auto;
}

.search {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  color: var(--text-faint);
  background: var(--bg-soft);
}

.search:focus-within {
  border-color: var(--accent);
}

.search input {
  border: none;
  background: none;
  outline: none;
  width: 150px;
  font-size: 0.84rem;
  color: var(--text);
}

.menu {
  position: relative;
}

.menu summary {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text);
  background: var(--panel);
  user-select: none;
}

.menu summary::-webkit-details-marker {
  display: none;
}

.menu[open] summary {
  border-color: var(--accent);
}

.menu-body {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 130px;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  padding: 5px;
  display: flex;
  flex-direction: column;
  z-index: 20;
}

.menu-body button {
  border: none;
  background: none;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text);
}

.menu-body button:hover {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.list {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.spacer {
  position: relative;
}

.item {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 9px 14px 9px 16px;
  border-left: 3px solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  transition:
    background 0.14s ease,
    border-color 0.14s ease;
}

.item:hover {
  background: var(--panel-hover);
}

.item.active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timecode {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.item.active .timecode {
  color: var(--accent-strong);
}

.edited {
  font-size: 0.68rem;
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
  padding: 0 6px;
  border-radius: 999px;
}

.text {
  font-size: 0.9rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.edit {
  position: absolute;
  right: 10px;
  top: 8px;
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.item:hover .edit {
  opacity: 1;
}

.edit:hover {
  color: var(--accent-strong);
  background: var(--bg-soft);
}

.editor {
  border-top: 1px solid var(--border);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-soft);
}

.editor textarea {
  width: 100%;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--panel);
  padding: 10px 12px;
  resize: vertical;
  font-size: 0.9rem;
}

.editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.hint {
  font-size: 0.72rem;
  color: var(--text-faint);
  margin-right: auto;
}
</style>
