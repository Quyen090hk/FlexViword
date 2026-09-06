<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { usePlayerStore } from '@/stores/player'
import { useVideoSource } from '@/composables/useVideoSource'
import { useHotkeys } from '@/composables/useHotkeys'
import { findSegmentIndexAt } from '@/composables/useActiveSegment'
import { t } from '@/i18n'
import { formatDuration } from '@/utils/time'
import { PLAYBACK_RATES } from '@/config/constants'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/common/Icon.vue'

/**
 * 播放器 = 字幕同步的"时钟源"：
 * - timeupdate（~4Hz）驱动 currentTime，二分查找命中当前句，写回 player store；
 * - seekRequest watch 实现字幕列表点击跳转（token 防抖同一时刻的重复 seek）；
 * - loadedmetadata 把真实时长回填给任务，供时间轴估算使用；
 * - 底部字幕条实时显示当前句（demo 任务用 currentTime 兜底推算）。
 */
const tasks = useTasksStore()
const player = usePlayerStore()

const videoEl = ref<HTMLVideoElement | null>(null)
const source = useVideoSource(computed(() => tasks.currentTask))

const rate = ref(1)

watch(rate, (value) => {
  if (videoEl.value) videoEl.value.playbackRate = value
})

const isAudio = computed(() => tasks.currentTask?.video.kind === 'audio')

const stageLabel = computed(() => {
  const task = tasks.currentTask
  if (!task) return t('workspace.noVideo')
  return t(`workspace.stage${task.stage.charAt(0).toUpperCase()}${task.stage.slice(1)}`)
})

const segments = computed(() => tasks.currentTask?.segments ?? [])

/** 当前句：优先播放器写入的 activeSegmentId，否则按 currentTime 推算（demo/未播放场景） */
const activeCaption = computed(() => {
  if (segments.value.length === 0) return ''
  const byId = segments.value.find((segment) => segment.id === player.activeSegmentId)
  if (byId) return byId.text
  const index = findSegmentIndexAt(segments.value, player.currentTime)
  return index >= 0 ? (segments.value[index]?.text ?? '') : ''
})

watch(source, (value) => {
  const el = videoEl.value
  if (el && value.url) {
    el.load()
  }
})

function onTimeUpdate(): void {
  const el = videoEl.value
  if (!el) return
  player.currentTime = el.currentTime
  if (segments.value.length === 0) return
  const index = findSegmentIndexAt(segments.value, el.currentTime)
  player.activeSegmentId = index >= 0 ? (segments.value[index]?.id ?? null) : null
}

function onLoadedMetadata(): void {
  const el = videoEl.value
  if (!el) return
  player.duration = el.duration
  const task = tasks.currentTask
  if (task && Number.isFinite(el.duration) && el.duration > 0) {
    tasks.setVideoDuration(task.id, el.duration)
  }
}

function togglePlay(): void {
  const el = videoEl.value
  if (!el || !source.value.url) return
  if (el.paused) void el.play()
  else el.pause()
}

function seekBy(delta: number): void {
  const el = videoEl.value
  if (!el) return
  el.currentTime = Math.min(
    el.duration || Number.POSITIVE_INFINITY,
    Math.max(0, el.currentTime + delta),
  )
}

// 字幕列表 → 播放器：token 变化即跳转
watch(
  () => player.seekRequest?.token,
  (token) => {
    if (token === undefined) return
    const at = player.seekRequest?.at
    const el = videoEl.value
    if (at === undefined || !el || !source.value.url) return
    el.currentTime = at
    if (el.paused) void el.play()
  },
)

useHotkeys([
  { key: ' ', handler: togglePlay },
  { key: 'arrowleft', handler: () => seekBy(-5) },
  { key: 'arrowright', handler: () => seekBy(5) },
])
</script>

<template>
  <div class="player-card">
    <div class="screen">
      <video
        v-if="source.url"
        ref="videoEl"
        class="video"
        :src="source.url"
        controls
        playsinline
        @timeupdate="onTimeUpdate"
        @seeked="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @play="player.isPlaying = true"
        @pause="player.isPlaying = false"
      />
      <div v-if="source.url && isAudio" class="audio-overlay">
        <Icon name="mic" :size="34" />
        <span class="audio-name">{{ tasks.currentTask?.name }}</span>
      </div>
      <div v-else class="placeholder">
        <EmptyState
          icon="film"
          :title="tasks.currentTask ? stageLabel : t('workspace.noVideo')"
          :description="tasks.currentTask?.name"
        />
        <div class="fake-timeline" aria-hidden="true">
          <div class="fake-progress" :style="{ width: `${tasks.currentTask?.progress ?? 0}%` }" />
        </div>
        <span class="fake-time">{{ formatDuration(player.currentTime) }}</span>
      </div>
    </div>

    <div class="sub-bar">
      <Transition name="caption" mode="out-in">
        <p :key="activeCaption" class="caption">{{ activeCaption || '—' }}</p>
      </Transition>
      <div class="controls">
        <label class="rate">
          <Icon name="gauge" :size="13" />
          <select v-model.number="rate" aria-label="playback rate">
            <option v-for="value in PLAYBACK_RATES" :key="value" :value="value">
              {{ value }}×
            </option>
          </select>
        </label>
        <span class="time">{{ formatDuration(player.currentTime) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-card {
  border-radius: var(--radius);
  overflow: hidden;
  border: 2px solid var(--border-strong);
  border-top: 3px solid var(--accent);
  background: var(--bg-soft);
  display: flex;
  flex-direction: column;
}

.screen {
  background: #0a0a0c;
  aspect-ratio: 16 / 9;
  display: grid;
  position: relative;
}

.audio-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.72);
  border-left: 3px solid var(--accent);
  color: var(--accent-contrast);
  pointer-events: none;
  max-width: calc(100% - 24px);
}

.audio-name {
  font-size: 0.82rem;
  font-weight: 600;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
  background:
    radial-gradient(
      ellipse at 30% 20%,
      color-mix(in srgb, var(--accent) 9%, transparent),
      transparent 55%
    ),
    var(--panel);
  padding: 20px;
  height: 100%;
}

.fake-timeline {
  width: min(420px, 80%);
  height: 6px;
  border-radius: 3px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  overflow: hidden;
}

.fake-progress {
  height: 100%;
  background: var(--accent);
  transition: width var(--dur) var(--ease-out);
}

.fake-time {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.sub-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--panel);
  min-height: 52px;
}

.caption {
  flex: 1;
  font-size: 0.96rem;
  font-weight: 650;
  font-style: italic;
  line-height: 1.45;
  color: var(--text);
  border-left: 4px solid var(--accent);
  padding-left: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
}

.caption-enter-active,
.caption-leave-active {
  transition:
    opacity var(--dur) var(--ease-out),
    transform var(--dur) var(--ease-out);
}

.caption-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.caption-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.rate {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-faint);
}

.rate select {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.78rem;
  padding: 3px 4px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.time {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 42px;
  text-align: right;
}
</style>
