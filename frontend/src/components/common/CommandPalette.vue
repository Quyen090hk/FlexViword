<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useCommands, type CommandItem } from '@/composables/useCommands'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { fuzzyMatch, splitByIndices } from '@/utils/fuzzy'
import { t } from '@/i18n'
import Icon from '@/components/common/Icon.vue'
import type { IconName } from '@/components/common/icon-names'

/**
 * ⌘K 命令面板。
 * 检索：label 命中优先、keywords 兜底（自实现子序列模糊匹配，见 utils/fuzzy）。
 * 键盘：↑↓ 选择、Enter 执行、Esc 关闭、Tab 被陷阱限制在面板内；hover 同步激活项。
 */
const ui = useUiStore()
const commands = useCommands()

const query = ref('')
const activeIndex = ref(0)
const listEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const paletteEl = ref<HTMLElement | null>(null)

useFocusTrap(
  paletteEl,
  computed(() => ui.paletteOpen),
)

interface ScoredCommand {
  command: CommandItem
  score: number
  indices: number[]
}

function scoreCommand(queryText: string, command: CommandItem): ScoredCommand | null {
  const onLabel = fuzzyMatch(queryText, command.label)
  const onKeywords = command.keywords ? fuzzyMatch(queryText, command.keywords) : null
  if (!onLabel && !onKeywords) return null
  const labelScore = onLabel?.score ?? Number.NEGATIVE_INFINITY
  const keywordScore = (onKeywords?.score ?? Number.NEGATIVE_INFINITY) - 4
  return {
    command,
    score: Math.max(labelScore, keywordScore),
    indices: onLabel?.indices ?? [],
  }
}

const LIMIT = 24

const sections = computed(() => {
  const q = query.value.trim()
  const scored: ScoredCommand[] = []
  for (const command of commands.value) {
    if (!q) {
      scored.push({ command, score: 0, indices: [] })
      continue
    }
    const result = scoreCommand(q, command)
    if (result) scored.push(result)
  }
  scored.sort((a, b) => b.score - a.score)

  const grouped: Array<{ section: string; items: ScoredCommand[] }> = []
  for (const entry of scored.slice(0, LIMIT)) {
    const last = grouped[grouped.length - 1]
    if (last && last.section === entry.command.section) last.items.push(entry)
    else grouped.push({ section: entry.command.section, items: [entry] })
  }
  return grouped
})

const flatItems = computed<ScoredCommand[]>(() => sections.value.flatMap((s) => s.items))

watch(flatItems, (items) => {
  if (activeIndex.value >= items.length) activeIndex.value = Math.max(0, items.length - 1)
})

// Esc 在面板内任意位置（包括结果列表）都可关闭，而不只在输入框聚焦时
function onEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') ui.closePalette()
}

watch(
  () => ui.paletteOpen,
  async (open) => {
    if (open) {
      query.value = ''
      activeIndex.value = 0
      window.addEventListener('keydown', onEscape)
      await nextTick()
      inputEl.value?.focus()
    } else {
      window.removeEventListener('keydown', onEscape)
    }
  },
)

// 面板打开状态下组件被卸载时，清理全局监听
onScopeDispose(() => window.removeEventListener('keydown', onEscape))

watch(activeIndex, async (index) => {
  await nextTick()
  listEl.value?.querySelector(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' })
})

function move(delta: number): void {
  const total = flatItems.value.length
  if (total === 0) return
  activeIndex.value = (activeIndex.value + delta + total) % total
}

function run(entry: ScoredCommand): void {
  ui.closePalette()
  entry.command.run()
}

function runActive(): void {
  const entry = flatItems.value[activeIndex.value]
  if (entry) run(entry)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="ui.paletteOpen" class="overlay" @click.self="ui.closePalette()">
        <div
          :ref="(el) => (paletteEl = el as HTMLElement | null)"
          class="palette"
          role="dialog"
          aria-modal="true"
          :aria-label="t('palette.title')"
        >
          <div class="input-row">
            <Icon name="search" :size="16" />
            <input
              ref="inputEl"
              v-model="query"
              :placeholder="t('palette.placeholder')"
              type="text"
              spellcheck="false"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="runActive"
            />
            <kbd>esc</kbd>
          </div>

          <div ref="listEl" class="results">
            <template v-for="group in sections" :key="group.section">
              <p class="section">{{ group.section }}</p>
              <button
                v-for="entry in group.items"
                :key="entry.command.id"
                :data-idx="flatItems.indexOf(entry)"
                class="item"
                :class="{ active: flatItems.indexOf(entry) === activeIndex }"
                type="button"
                @mouseenter="activeIndex = flatItems.indexOf(entry)"
                @click="run(entry)"
              >
                <Icon :name="entry.command.icon as IconName" :size="15" />
                <span class="label">
                  <template
                    v-for="(part, i) in splitByIndices(entry.command.label, entry.indices)"
                    :key="i"
                  >
                    <mark v-if="part.hit">{{ part.text }}</mark>
                    <template v-else>{{ part.text }}</template>
                  </template>
                </span>
                <span v-if="flatItems.indexOf(entry) === activeIndex" class="go">↵</span>
              </button>
            </template>
            <p v-if="flatItems.length === 0" class="empty">{{ t('palette.empty') }}</p>
          </div>

          <footer class="hints">
            <span><kbd>↑</kbd><kbd>↓</kbd> {{ t('palette.move') }}</span>
            <span><kbd>↵</kbd> {{ t('palette.run') }}</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1600;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 14vh 20px 20px;
}

.palette {
  width: min(580px, 100%);
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-faint);
}

.input-row input {
  flex: 1;
  border: none;
  outline: none;
  background: none;
  font-size: 1rem;
  color: var(--text);
}

kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 1px 6px;
  background: var(--bg-soft);
}

.results {
  max-height: 340px;
  overflow-y: auto;
  padding: 6px;
}

.section {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  padding: 10px 10px 4px;
}

.item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  border: none;
  background: none;
  text-align: left;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text);
  font-size: 0.9rem;
}

.item.active {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.item mark {
  background: none;
  color: var(--accent-strong);
  font-weight: 700;
}

.item.active mark {
  color: var(--accent-strong);
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.go {
  font-size: 0.8rem;
  color: var(--accent-strong);
}

.empty {
  padding: 28px;
  text-align: center;
  color: var(--text-faint);
  font-size: 0.88rem;
}

.hints {
  display: flex;
  gap: 16px;
  padding: 9px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-soft);
  font-size: 0.72rem;
  color: var(--text-faint);
}

.hints span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
