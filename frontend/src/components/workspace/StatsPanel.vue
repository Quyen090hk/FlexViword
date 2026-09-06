<script setup lang="ts">
import { computed } from 'vue'
import type { TranscriptSegment } from '@/types/domain'
import { computeTranscriptStats } from '@/utils/stats'
import { formatDuration } from '@/utils/time'
import { t } from '@/i18n'
import Icon from '@/components/common/Icon.vue'

/**
 * 语音统计面板：关键指标 + 手写 SVG 密度分布图（零图表库依赖）。
 */
const props = defineProps<{ segments: TranscriptSegment[]; durationSec?: number }>()

const stats = computed(() => computeTranscriptStats(props.segments, props.durationSec))

const tiles = computed(() => [
  { icon: 'activity' as const, label: t('stats.chars'), value: formatCount(stats.value.charCount) },
  {
    icon: 'captions' as const,
    label: t('stats.segments'),
    value: String(stats.value.segmentCount),
  },
  {
    icon: 'gauge' as const,
    label: t('stats.pace'),
    value: stats.value.charsPerMinute.toFixed(0),
    unit: t('stats.paceUnit'),
  },
  {
    icon: 'clock' as const,
    label: t('stats.coverage'),
    value: `${Math.round(stats.value.coverage * 100)}%`,
  },
])

function formatCount(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}w` : String(n)
}

/** 把直方图归一化成 SVG 柱高（0-40px），峰值封顶避免单峰独大 */
const bars = computed(() => {
  const peak = stats.value.histogramPeak || 1
  return stats.value.histogram.map((value) => Math.max(2, Math.round((value / peak) * 40)))
})
</script>

<template>
  <section v-if="segments.length > 0" class="stats">
    <header class="head">
      <Icon name="activity" :size="14" />
      <h4>{{ t('stats.title') }}</h4>
      <span class="duration">{{ formatDuration(stats.durationSec) }}</span>
    </header>

    <div class="tiles">
      <div v-for="tile in tiles" :key="tile.label" class="tile">
        <span class="value">
          {{ tile.value }}<small v-if="'unit' in tile && tile.unit">{{ tile.unit }}</small>
        </span>
        <span class="label">
          <Icon :name="tile.icon" :size="12" />
          {{ tile.label }}
        </span>
      </div>
    </div>

    <div class="chart" :title="t('stats.density')">
      <svg viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true">
        <rect
          v-for="(height, i) in bars"
          :key="i"
          :x="i * 10 + 1"
          :y="44 - height"
          width="6"
          :height="height"
          rx="2"
          class="bar"
          :style="{ animationDelay: `${i * 18}ms` }"
        />
      </svg>
      <div class="axis">
        <span>0:00</span>
        <span>{{ formatDuration(stats.durationSec / 2) }}</span>
        <span>{{ formatDuration(stats.durationSec) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats {
  border: 2px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--panel);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.head {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--accent-strong);
}

.head h4 {
  font-size: 0.84rem;
  font-weight: 700;
}

.duration {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-faint);
}

.tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.tile {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.12rem;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.value small {
  font-size: 0.66rem;
  font-weight: 500;
  color: var(--text-faint);
  margin-left: 3px;
}

.label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: var(--text-faint);
  white-space: nowrap;
}

.chart svg {
  width: 100%;
  height: 44px;
  display: block;
}

.bar {
  fill: var(--accent);
  opacity: 0.75;
  transform-origin: bottom;
  animation: bar-rise var(--dur-slow) var(--ease-spring) backwards;
}

@keyframes bar-rise {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

.axis {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  color: var(--text-faint);
  margin-top: 3px;
}
</style>
