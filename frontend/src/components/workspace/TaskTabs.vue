<script setup lang="ts">
import { computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { t } from '@/i18n'
import Icon from '@/components/common/Icon.vue'

/**
 * 任务标签页：工作台内的任务切换器（浏览器标签的隐喻）。
 * 点击切换（与 ?task= URL 双向同步）、关闭即删除任务；
 * 前缀圆点编码任务状态（运行中脉冲 / 完成绿 / 失败红）。
 */
const tasks = useTasksStore()

const MAX_TABS = 12

const tabs = computed(() => tasks.sortedTasks.slice(0, MAX_TABS))

function isOpen(id: string): boolean {
  return tasks.currentId === id
}

function open(id: string): void {
  tasks.setCurrent(id)
}

/** 关闭 = 删除任务；有字幕数据时先确认，避免误触丢数据 */
function close(id: string): void {
  const task = tasks.byId(id)
  const hasData = !!task?.segments?.length
  if (!hasData || window.confirm(t('history.confirmDelete'))) {
    void tasks.remove(id)
  }
}

function dotClass(stage: string): string {
  if (stage === 'completed') return 'ok'
  if (stage === 'failed') return 'bad'
  if (stage === 'canceled') return 'muted'
  return 'busy'
}
</script>

<template>
  <div v-if="tabs.length > 0" class="task-tabs" role="tablist" :aria-label="t('nav.workspace')">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      role="tab"
      :aria-selected="isOpen(tab.id)"
      class="tab"
      :class="{ active: isOpen(tab.id) }"
      :title="tab.name"
      @click="open(tab.id)"
    >
      <span class="tab-dot" :class="dotClass(tab.stage)" />
      <span class="tab-name">{{ tab.name }}</span>
      <span
        class="tab-close"
        role="button"
        tabindex="-1"
        :aria-label="`${t('common.close')} ${tab.name}`"
        @click.stop="close(tab.id)"
      >
        <Icon name="x" :size="10" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.task-tabs {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 7px 12px;
  max-width: 200px;
  border: 2px solid var(--border-strong);
  background: var(--panel);
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transform: skewX(var(--skew));
  transition: all var(--dur-fast) var(--ease-out);
  flex-shrink: 0;
}

.tab > * {
  transform: skewX(var(--unskew));
}

.tab:hover {
  border-color: var(--accent);
  color: var(--text);
}

.tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.7);
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tab-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  transform: rotate(45deg);
  background: var(--text-faint);
}

.tab-dot.ok {
  background: var(--success);
}

.tab-dot.bad {
  background: var(--danger);
}

.tab-dot.muted {
  background: var(--border-strong);
}

.tab-dot.busy {
  background: var(--accent);
  animation: dot-pulse 1.1s var(--ease-out) infinite;
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.tab-close {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 2px;
  color: inherit;
  opacity: 0.65;
  transition: all var(--dur-fast) var(--ease-out);
}

.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
}
</style>
