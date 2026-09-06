<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTasksStore } from '@/stores/tasks'
import { usePlayerStore } from '@/stores/player'
import { t } from '@/i18n'
import { formatDuration, formatBytes } from '@/utils/time'
import AppButton from '@/components/common/AppButton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'

const tasks = useTasksStore()
const player = usePlayerStore()
const router = useRouter()

onMounted(() => tasks.init())

const list = computed(() => tasks.sortedTasks)

function stageLabel(stage: string): string {
  return t(`workspace.stage${stage.charAt(0).toUpperCase()}${stage.slice(1)}`)
}

function stageClass(stage: string): string {
  switch (stage) {
    case 'completed':
      return 'ok'
    case 'failed':
      return 'bad'
    case 'canceled':
      return 'muted'
    default:
      return 'busy'
  }
}

function open(id: string): void {
  tasks.setCurrent(id)
  player.reset()
  // 打开 = 选中并回到工作台，否则用户停留在本页看不到任何反馈
  void router.push('/')
}

function remove(id: string): void {
  if (window.confirm(t('history.confirmDelete'))) void tasks.remove(id)
}

function clearAll(): void {
  if (window.confirm(t('history.confirmClearAll'))) void tasks.clearAll()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString()
}
</script>

<template>
  <div class="history">
    <header class="head">
      <h2>{{ t('history.title') }}</h2>
      <AppButton v-if="list.length > 0" variant="danger" @click="clearAll">
        {{ t('history.clearAll') }}
      </AppButton>
    </header>

    <p v-if="!tasks.persistent" class="warn">{{ t('history.notPersisted') }}</p>

    <EmptyState
      v-if="list.length === 0"
      icon="clock"
      :title="t('history.empty')"
      :description="t('history.emptyHint')"
    />

    <ul v-else class="cards">
      <li
        v-for="item in list"
        :key="item.id"
        class="card"
        :class="{ current: tasks.currentId === item.id }"
      >
        <div class="row-1">
          <span class="name" :title="item.name">{{ item.name }}</span>
          <span class="badge" :class="stageClass(item.stage)">{{ stageLabel(item.stage) }}</span>
        </div>
        <div class="row-2">
          <span>{{ formatDate(item.createdAt) }}</span>
          <span v-if="item.video.durationSec">· {{ formatDuration(item.video.durationSec) }}</span>
          <span v-if="item.video.size > 0">· {{ formatBytes(item.video.size) }}</span>
          <span v-if="item.segments">· {{ item.segments.length }} seg</span>
        </div>
        <ProgressBar
          v-if="!['completed', 'failed', 'canceled'].includes(item.stage)"
          :value="item.progress"
        />
        <p v-if="item.error" class="error">{{ item.error }}</p>
        <div class="actions">
          <AppButton variant="ghost" @click="open(item.id)">{{ t('history.reopen') }}</AppButton>
          <AppButton variant="danger" @click="remove(item.id)">
            {{ t('common.delete') }}
          </AppButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.history {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head h2 {
  font-size: 1.35rem;
  font-weight: 750;
}

.warn {
  font-size: 0.84rem;
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
}

.cards {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s ease;
}

.card:hover {
  border-color: var(--border-strong);
}

.card.current {
  border-color: var(--accent);
}

.row-1 {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name {
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
}

.badge.ok {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 40%, transparent);
}

.badge.bad {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
}

.badge.busy {
  color: var(--accent-strong);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.row-2 {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.error {
  font-size: 0.82rem;
  color: var(--danger);
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 2px;
}
</style>
