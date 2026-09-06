<script setup lang="ts">
import { computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { detectPlatform } from '@/services/bridge/platform'
import { t } from '@/i18n'
import { APP_VERSION } from '@/config/constants'
import { formatDuration } from '@/utils/time'
import Icon from '@/components/common/Icon.vue'

/**
 * 关于页：非等距 Bento 网格（参考 taste-skill 的 Bento 范式），
 * 引入实时数据（任务数/字幕数/当前引擎），让页面"活着"。
 */
const tasks = useTasksStore()
const settings = useSettingsStore()

const platform = detectPlatform()

const totalSegments = computed(() =>
  tasks.tasks.reduce((sum, task) => sum + (task.segments?.length ?? 0), 0),
)
const totalChars = computed(() =>
  tasks.tasks.reduce((sum, task) => {
    for (const segment of task.segments ?? []) sum += segment.text.replace(/\s/g, '').length
    return sum
  }, 0),
)
const totalDuration = computed(() =>
  tasks.tasks.reduce((sum, task) => sum + (task.video.durationSec ?? 0), 0),
)
const currentEngine = computed(() =>
  settings.settings.engine === 'auto' ? t('workspace.engineAuto') : settings.settings.engine,
)

const stack = [
  'Vue 3.5',
  'TypeScript',
  'Pinia',
  'Vue Router',
  'Vite 6',
  'Vitest',
  'ESLint 9',
  'Transformers.js',
  'ffmpeg.wasm',
  'IndexedDB',
  'Wails v2',
]

const highlights = [
  { icon: 'activity' as const, key: 'pipeline.progress' },
  { icon: 'captions' as const, key: 'pipeline.sync' },
  { icon: 'gauge' as const, key: 'pipeline.virtual' },
  { icon: 'download' as const, key: 'pipeline.export' },
  { icon: 'globe' as const, key: 'pipeline.i18n' },
  { icon: 'command' as const, key: 'pipeline.cross' },
]
</script>

<template>
  <div class="about">
    <div class="bento">
      <section class="card intro">
        <div class="logo">FV</div>
        <div>
          <h2>{{ t('about.title') }}</h2>
          <p class="lead">{{ t('about.intro') }}</p>
        </div>
      </section>

      <section class="card live">
        <p class="card-title">{{ t('history.title') }}</p>
        <div class="live-grid">
          <div class="metric">
            <span class="num">{{ tasks.tasks.length }}</span>
            <span class="label">{{ t('history.title') }}</span>
          </div>
          <div class="metric">
            <span class="num">{{ totalSegments }}</span>
            <span class="label">{{ t('stats.segments') }}</span>
          </div>
          <div class="metric">
            <span class="num">{{
              totalChars >= 10000 ? `${(totalChars / 10000).toFixed(1)}w` : totalChars
            }}</span>
            <span class="label">{{ t('stats.chars') }}</span>
          </div>
          <div class="metric">
            <span class="num">{{ formatDuration(totalDuration) }}</span>
            <span class="label">{{ t('workspace.duration') }}</span>
          </div>
        </div>
      </section>

      <section class="card engine">
        <p class="card-title">{{ t('about.engineTitle') }}</p>
        <p class="desc">{{ t('about.engineDesc') }}</p>
        <div class="engine-flow">
          <span class="node">mock</span>
          <span class="arrow">→</span>
          <span class="node">whisper-local<em>+ 浏览器推理</em></span>
          <span class="arrow">→</span>
          <span class="node">siliconflow<em>+ ffmpeg.wasm</em></span>
          <span class="arrow">→</span>
          <span class="node">wails<em>+ Go</em></span>
        </div>
        <p class="engine-now">
          {{ t('workspace.engine') }}: <strong>{{ currentEngine }}</strong> ·
          {{ t(`platform.${platform}`) }}
        </p>
      </section>

      <section class="card features">
        <p class="card-title">{{ t('about.featureTitle') }}</p>
        <ul class="feature-list">
          <li v-for="item in highlights" :key="item.key">
            <Icon :name="item.icon" :size="14" />
            {{ t(item.key) }}
          </li>
        </ul>
      </section>

      <section class="card stack">
        <p class="card-title">{{ t('about.stackTitle') }}</p>
        <div class="chips">
          <span v-for="item in stack" :key="item" class="chip">{{ item }}</span>
        </div>
      </section>

      <section class="card links">
        <p class="card-title">{{ t('about.links') }}</p>
        <a href="https://github.com/Quyen090hk/FlexViword" target="_blank" rel="noreferrer">
          {{ t('about.repo') }} ↗
        </a>
        <p class="version-note">v{{ APP_VERSION }} · MIT</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about {
  max-width: 980px;
  margin: 0 auto;
}

.bento {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: auto;
  gap: 14px;
}

.card {
  border: 2px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--panel);
  padding: 22px 24px;
  animation: rise-in var(--dur-slow) var(--ease-out) backwards;
}

.card:nth-child(2) {
  animation-delay: 60ms;
}

.card:nth-child(3) {
  animation-delay: 120ms;
}

.card:nth-child(4) {
  animation-delay: 180ms;
}

.card:nth-child(5) {
  animation-delay: 240ms;
}

.card:nth-child(6) {
  animation-delay: 300ms;
}

.card-title {
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.intro {
  grid-column: span 6;
  display: flex;
  align-items: center;
  gap: 26px;
  position: relative;
  overflow: hidden;
  border-color: var(--accent);
  box-shadow: var(--shadow);
}

/* 右缘半调网点装饰条 */
.intro::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 84px;
  background-image: radial-gradient(
    color-mix(in srgb, var(--accent) 40%, transparent) 1.4px,
    transparent 1.9px
  );
  background-size: 10px 10px;
  pointer-events: none;
}

.logo {
  width: 76px;
  height: 76px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 1.7rem;
  color: var(--accent-contrast);
  background: var(--accent);
  transform: skewX(var(--skew)) rotate(-2deg);
  box-shadow: 5px 5px 0 rgba(0, 0, 0, 0.75);
}

.intro h2 {
  font-size: 1.55rem;
  font-style: italic;
  font-weight: 800;
  margin-bottom: 8px;
}

.lead {
  color: var(--text-muted);
  font-size: 0.94rem;
  line-height: 1.7;
  max-width: 62ch;
}

.live {
  grid-column: span 6;
}

.live-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.num {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 800;
  font-size: 1.75rem;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.label {
  font-size: 0.74rem;
  color: var(--text-faint);
}

.engine {
  grid-column: span 4;
}

.desc {
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.65;
  margin-bottom: 14px;
}

.engine-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.node {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  padding: 4px 12px;
  color: var(--text);
}

.node em {
  font-style: normal;
  color: var(--text-faint);
}

.arrow {
  color: var(--text-faint);
}

.engine-now {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.engine-now strong {
  color: var(--accent-strong);
}

.features {
  grid-column: span 2;
}

.feature-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.feature-list li svg {
  color: var(--accent-strong);
  flex-shrink: 0;
  margin-top: 2px;
}

.stack {
  grid-column: span 4;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  transition: all var(--dur-fast) var(--ease-out);
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.links {
  grid-column: span 2;
  display: flex;
  flex-direction: column;
}

.links a {
  font-size: 0.92rem;
  font-weight: 600;
}

.version-note {
  margin-top: auto;
  padding-top: 12px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-faint);
}

@media (max-width: 860px) {
  .engine,
  .features,
  .stack,
  .links {
    grid-column: span 6;
  }

  .intro {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}
</style>
