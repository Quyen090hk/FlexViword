<script setup lang="ts">
import { computed, ref } from 'vue'
import { mediaFromDataTransfer, pickMediaFiles } from '@/services/bridge/file-picker'
import { getWailsApp, isDesktop } from '@/services/bridge/platform'
import { useTasksStore } from '@/stores/tasks'
import { useUiStore } from '@/stores/ui'
import { useRecorder } from '@/composables/useRecorder'
import { t } from '@/i18n'
import { formatBytes } from '@/utils/time'
import Icon from '@/components/common/Icon.vue'
import type { PickedMedia } from '@/services/bridge/file-picker'

/**
 * 媒体输入区：拖拽/点击（多选批量）+ 麦克风录音 + 文件夹导入（桌面）+ 链接导入（桌面）。
 * 音频文件与视频走同一条转写管线（ffmpeg 解码为 16k WAV）。
 */
const tasks = useTasksStore()
const ui = useUiStore()
const desktop = isDesktop()

const dragActive = ref(false)
const busy = ref(false)
const linkURL = ref('')
const linkBusy = ref(false)
const recorder = useRecorder()

const currentVideo = computed(() => tasks.currentTask?.video ?? null)
const hasVideo = computed(
  () => currentVideo.value !== null && (currentVideo.value.size > 0 || !!currentVideo.value.path),
)
const auxDisabled = computed(
  () => busy.value || recorder.state.value === 'recording' || linkBusy.value,
)

async function pick(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const picked = await pickMediaFiles(true)
    await accept(picked)
  } finally {
    busy.value = false
  }
}

async function onDrop(event: DragEvent): Promise<void> {
  dragActive.value = false
  if (busy.value) return
  busy.value = true
  try {
    const file = event.dataTransfer ? mediaFromDataTransfer(event.dataTransfer) : null
    await accept(file ? [{ name: file.name, size: file.size, mime: file.type, file }] : [])
  } finally {
    busy.value = false
  }
}

async function accept(picked: PickedMedia[]): Promise<void> {
  if (picked.length === 0) return
  const files = picked.map((p) => p.file).filter((f): f is File => !!f)
  if (files.length > 0) {
    const added = await tasks.addFromFiles(files)
    if (added > 1) ui.toast('success', t('input.batchAdded', { count: added }))
    return
  }
  // 桌面模式：只有路径
  for (const item of picked) {
    if (item.path) await tasks.addFromPath(item.name, item.path, item.size, item.mime)
  }
}

async function toggleRecord(): Promise<void> {
  if (recorder.state.value === 'recording') {
    const file = await recorder.stop()
    if (file) {
      await tasks.addFromFile(file)
      ui.toast('success', t('input.recordSaved'))
    }
    return
  }
  await recorder.start()
}

async function importFolder(): Promise<void> {
  if (!desktop || auxDisabled.value) return
  busy.value = true
  try {
    const entries = await getWailsApp().ImportMediaFolder()
    if (!entries || entries.length === 0) return
    const added = await tasks.addFromPaths(entries)
    ui.toast('success', t('input.folderAdded', { count: added }))
  } finally {
    busy.value = false
  }
}

async function importLink(): Promise<void> {
  const url = linkURL.value.trim()
  if (!desktop || linkBusy.value || !url) return
  linkBusy.value = true
  ui.toast('info', t('input.linkDownloading'))
  try {
    const app = getWailsApp()
    const path = await app.DownloadMedia(url)
    const name = path.replace(/\\/g, '/').split('/').pop() ?? path
    await tasks.addFromPath(name, path, 0, '')
    linkURL.value = ''
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('yt-dlp not found')) {
      ui.toast('error', t('input.linkNeedYtdlp'))
    } else if (message.includes('bilibili risk control')) {
      ui.toast('error', t('input.linkRiskControl'))
    } else {
      ui.toast('error', t('input.linkFailed', { message }))
    }
  } finally {
    linkBusy.value = false
  }
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="input-area">
    <div
      v-if="!hasVideo"
      class="dropzone"
      :class="{ active: dragActive, busy }"
      role="button"
      tabindex="0"
      :aria-label="t('workspace.dropTitle')"
      @click="pick"
      @keydown.enter="pick"
      @keydown.space.prevent="pick"
      @dragover.prevent="dragActive = true"
      @dragleave="dragActive = false"
      @drop.prevent="onDrop"
    >
      <div class="glyph">
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        >
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M4 21h16" />
        </svg>
      </div>
      <p class="title">{{ busy ? t('common.loading') : t('workspace.dropTitle') }}</p>
      <p class="hint">{{ t('workspace.dropHint') }}</p>
    </div>
    <button v-else class="replace" type="button" :disabled="busy" @click="pick">
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <path d="M4 4h16v16H4z" />
        <path d="M4 9h16" />
        <path d="M9 4v16" />
        <path d="M15 4v16" />
      </svg>
      <span class="replace-name">{{ currentVideo?.name }}</span>
      <span v-if="currentVideo && currentVideo.size > 0" class="replace-meta">{{
        formatBytes(currentVideo.size)
      }}</span>
      <span class="replace-action">{{ busy ? t('common.loading') : t('workspace.browse') }}</span>
    </button>

    <div class="aux-row">
      <button
        class="aux"
        :class="{ recording: recorder.state.value === 'recording' }"
        type="button"
        :disabled="auxDisabled && recorder.state.value !== 'recording'"
        @click="toggleRecord"
      >
        <span v-if="recorder.state.value === 'recording'" class="rec-dot" />
        <Icon :name="recorder.state.value === 'recording' ? 'pause' : 'mic'" :size="14" />
        {{
          recorder.state.value === 'recording'
            ? `${t('input.recording')} ${fmtElapsed(recorder.elapsedSec.value)} · ${t('input.recordStop')}`
            : t('input.record')
        }}
      </button>

      <template v-if="desktop">
        <button class="aux" type="button" :disabled="auxDisabled" @click="importFolder">
          <Icon name="folder" :size="14" />
          {{ t('input.folder') }}
        </button>
        <form class="link-form" @submit.prevent="importLink">
          <input
            v-model="linkURL"
            class="link-input"
            type="url"
            :placeholder="t('input.linkPlaceholder')"
            spellcheck="false"
          />
          <button class="aux link-go" type="submit" :disabled="linkBusy || !linkURL.trim()">
            <Icon name="download" :size="14" />
            {{ linkBusy ? t('input.linkDownloading') : t('input.link') }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dropzone {
  border: 2px dashed var(--border-strong);
  background: radial-gradient(
    color-mix(in srgb, var(--accent) 14%, transparent) 1.2px,
    transparent 1.7px
  );
  background-size: 10px 10px;
  background-position: center;
  padding: 42px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.18s var(--ease-out);
  text-align: center;
  width: 100%;
}

.dropzone:hover,
.dropzone:focus-visible,
.dropzone.active {
  border-color: var(--accent);
  background-color: var(--accent-soft);
}

.dropzone.busy {
  opacity: 0.6;
  pointer-events: none;
}

.glyph {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-contrast);
  transform: skewX(var(--skew)) rotate(-3deg);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.7);
  margin-bottom: 4px;
}

.glyph svg {
  transform: skewX(var(--unskew));
}

.title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 750;
  font-size: 1.04rem;
}

.hint {
  font-size: 0.83rem;
  color: var(--text-muted);
  max-width: 340px;
}

.replace {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  font-size: 0.88rem;
}

.replace:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--panel-hover);
}

.replace:disabled {
  opacity: 0.6;
}

.replace svg {
  color: var(--accent-strong);
  flex-shrink: 0;
}

.replace-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.replace-meta {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.replace-action {
  margin-left: auto;
  color: var(--accent-strong);
  font-weight: 600;
  flex-shrink: 0;
}

.aux-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.aux {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-out);
}

.aux:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.aux:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.aux.recording {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: dot-pulse 1.1s var(--ease-out) infinite;
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.link-form {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 220px;
}

.link-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text);
  font-size: 0.8rem;
}

.link-input:focus {
  outline: none;
  border-color: var(--accent);
}

.link-go:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
