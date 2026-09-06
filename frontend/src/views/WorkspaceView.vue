<script setup lang="ts">
import { computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useI18n } from '@/i18n'
import { engineAvailability, engineDisplayName } from '@/services/engines'
import { detectPlatform } from '@/services/bridge/platform'
import { useCurrentTaskRouteSync } from '@/composables/useCurrentTaskRouteSync'
import { formatDuration } from '@/utils/time'
import DropZone from '@/components/workspace/DropZone.vue'
import TaskTabs from '@/components/workspace/TaskTabs.vue'
import VideoPlayer from '@/components/workspace/VideoPlayer.vue'
import PipelinePanel from '@/components/workspace/PipelinePanel.vue'
import TranscriptPanel from '@/components/workspace/TranscriptPanel.vue'
import StatsPanel from '@/components/workspace/StatsPanel.vue'
import AppButton from '@/components/common/AppButton.vue'
import Icon from '@/components/common/Icon.vue'

const tasks = useTasksStore()
const settings = useSettingsStore()
const ui = useUiStore()
const { t } = useI18n()

const platform = detectPlatform()

// 当前任务 ↔ ?task= 查询参数双向同步（刷新可恢复、链接可分享）
useCurrentTaskRouteSync()

const task = computed(() => tasks.currentTask)
const availability = computed(() => engineAvailability(platform, settings.settings))

function onEngineChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  settings.update({ engine: value as typeof settings.settings.engine })
}

function loadDemo(): void {
  void tasks.addDemoTask().then(() => ui.toast('info', t('toast.demoLoaded')))
}

function engineSuffix(reason: string): string {
  if (reason === 'ok') return ''
  if (reason === 'needs-api-key') return '· Key'
  if (reason === 'web-only') return '· Web'
  return '· Desktop'
}
</script>

<template>
  <div class="workspace">
    <header class="page-head">
      <div>
        <h2>{{ t('workspace.title') }}</h2>
        <p v-if="tasks.queuedCount > 0" class="queue-hint">
          {{ t('workspace.queuedCount', { count: tasks.queuedCount }) }}
        </p>
      </div>
      <div class="head-tools">
        <label class="engine-select">
          <span>{{ t('workspace.engine') }}</span>
          <select :value="settings.settings.engine" @change="onEngineChange">
            <option value="auto">{{ engineDisplayName('auto') }}</option>
            <option
              v-for="item in availability"
              :key="item.id"
              :value="item.id"
              :disabled="!item.supported"
            >
              {{ engineDisplayName(item.id) }} {{ engineSuffix(item.reason) }}
            </option>
          </select>
        </label>
        <AppButton variant="subtle" @click="loadDemo">
          <Icon name="plus" :size="14" />
          {{ t('workspace.demo') }}
        </AppButton>
      </div>
    </header>

    <TaskTabs />
    <DropZone />

    <div v-if="task" class="grid">
      <div class="left">
        <VideoPlayer />
        <div class="task-meta">
          <span class="name" :title="task.name">{{ task.name }}</span>
          <span v-if="task.video.durationSec" class="chip">
            {{ t('workspace.duration') }} {{ formatDuration(task.video.durationSec) }}
          </span>
          <span class="chip">ID {{ task.id.slice(-6) }}</span>
        </div>
        <PipelinePanel />
        <StatsPanel
          v-if="task.segments?.length"
          :segments="task.segments"
          :duration-sec="task.video.durationSec"
        />
      </div>
      <div class="right">
        <TranscriptPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.page-head h2 {
  font-size: 1.35rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.queue-hint {
  font-size: 0.8rem;
  color: var(--warning);
}

.head-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.engine-select {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--text-muted);
}

.engine-select select {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text);
  font-size: 0.86rem;
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.left {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.84rem;
}

.name {
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.chip {
  font-size: 0.74rem;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
}

.right {
  min-width: 0;
  min-height: 420px;
}

@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .right {
    min-height: 320px;
  }
}
</style>
