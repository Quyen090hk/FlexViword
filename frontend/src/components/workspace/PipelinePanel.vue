<script setup lang="ts">
import { computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { t } from '@/i18n'
import { formatDuration } from '@/utils/time'
import AppButton from '@/components/common/AppButton.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { TaskStage } from '@/types/domain'

/**
 * 流水线面板：阶段指示器 + 进度条 + 错误/操作区。
 * 进度按阶段加权映射（提取 0-40，识别 40-95），来自引擎的 report 回调。
 */
const tasks = useTasksStore()

const STAGES: TaskStage[] = ['queued', 'downloading', 'extracting', 'transcribing', 'completed']

const task = computed(() => tasks.currentTask)

const stageIndex = computed(() => {
  const current = task.value
  if (!current) return -1
  if (current.stage === 'failed' || current.stage === 'canceled') return 1
  return STAGES.indexOf(current.stage)
})

function stageLabel(stage: TaskStage): string {
  return t(`workspace.stage${stage.charAt(0).toUpperCase()}${stage.slice(1)}`)
}

const statusText = computed(() => {
  const current = task.value
  if (!current) return ''
  if (current.stage === 'failed') return current.error ?? ''
  if (current.stage === 'completed') {
    return current.meta
      ? `${current.meta.model} · ${formatDuration(current.meta.durationSec ?? 0)}`
      : ''
  }
  return current.message ?? ''
})
</script>

<template>
  <div v-if="task" class="pipeline">
    <div class="stages">
      <template v-for="(stage, i) in STAGES" :key="stage">
        <div class="stage" :class="{ done: i < stageIndex, current: i === stageIndex }">
          <span class="marker">
            <span v-if="i < stageIndex" class="check">✓</span>
            <span
              v-else-if="i === stageIndex && (stage === 'extracting' || stage === 'transcribing')"
              class="spinner"
            />
          </span>
          <span class="name">{{ stageLabel(stage) }}</span>
        </div>
        <div v-if="i < STAGES.length - 1" class="connector" :class="{ filled: i < stageIndex }" />
      </template>
      <div
        v-if="task.stage === 'failed' || task.stage === 'canceled'"
        class="stage abnormal"
        :class="task.stage"
      >
        <span class="marker"><span>!</span></span>
        <span class="name">{{ stageLabel(task.stage) }}</span>
      </div>
    </div>

    <ProgressBar :value="task.progress" show-label />

    <p v-if="statusText" class="status" :class="{ error: task.stage === 'failed' }">
      {{ statusText }}
    </p>

    <div class="actions">
      <AppButton
        v-if="tasks.runningId === task.id || tasks.queue.includes(task.id)"
        variant="subtle"
        @click="tasks.cancel(task.id)"
      >
        {{ t('workspace.cancel') }}
      </AppButton>
      <AppButton
        v-else-if="
          task.stage === 'failed' || task.stage === 'canceled' || task.stage === 'completed'
        "
        variant="ghost"
        @click="tasks.retry(task.id)"
      >
        {{ t('workspace.startOver') }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.pipeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stages {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.stage {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  color: var(--text-faint);
}

.stage.current {
  color: var(--accent-strong);
  font-weight: 600;
}

.stage.done {
  color: var(--text-muted);
}

.stage.abnormal .marker {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
}

.stage.abnormal.canceled {
  color: var(--text-muted);
}

.stage.abnormal.canceled .marker {
  background: var(--bg-soft);
  color: var(--text-muted);
}

.marker {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 2px solid var(--border-strong);
  font-size: 0.68rem;
  font-weight: 700;
  flex-shrink: 0;
  transform: rotate(45deg) skewX(var(--skew));
  transition: all var(--dur-fast) var(--ease-out);
}

.marker > * {
  transform: rotate(-45deg) skewX(var(--unskew));
}

.stage.done .marker {
  border-color: var(--success);
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
}

.stage.current .marker {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
}

.connector {
  width: 16px;
  height: 2px;
  background: var(--border-strong);
  transform: skewX(var(--skew));
}

.connector.filled {
  background: var(--accent);
}

.check {
  font-weight: 700;
}

.spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--accent-soft);
  border-top-color: var(--accent-strong);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status {
  font-size: 0.84rem;
  color: var(--text-muted);
}

.status.error {
  color: var(--danger);
}

.actions {
  display: flex;
  gap: 10px;
}
</style>
