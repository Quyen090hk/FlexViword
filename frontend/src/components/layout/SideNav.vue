<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { detectPlatform } from '@/services/bridge/platform'
import { useUiStore } from '@/stores/ui'
import { APP_VERSION } from '@/config/constants'
import Icon from '@/components/common/Icon.vue'
import type { IconName } from '@/components/common/icon-names'

const { t } = useI18n()
const ui = useUiStore()

const platform = detectPlatform()

const links: { to: string; icon: IconName; key: string }[] = [
  { to: '/', icon: 'film', key: 'nav.workspace' },
  { to: '/history', icon: 'clock', key: 'nav.history' },
  { to: '/settings', icon: 'sliders', key: 'nav.settings' },
  { to: '/about', icon: 'info', key: 'nav.about' },
]

const platformLabel = computed(() => t(`platform.${platform}`))
</script>

<template>
  <nav class="sidenav">
    <div class="brand">
      <div class="logo"><span class="logo-text">FV</span></div>
      <div class="brand-text">
        <span class="name">FlexViword</span>
        <span class="tagline">{{ t('nav.tagline') }}</span>
      </div>
    </div>

    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="item"
      active-class="active"
    >
      <span class="item-face">
        <Icon :name="link.icon" :size="16" />
        <span>{{ t(link.key) }}</span>
      </span>
    </RouterLink>

    <button class="palette-trigger" type="button" @click="ui.openPalette()">
      <span class="item-face">
        <Icon name="command" :size="14" />
        <span>{{ t('palette.open') }}</span>
        <kbd>⌘K</kbd>
      </span>
    </button>

    <div class="footer">
      <span class="platform-badge">
        <span class="dot" />
        {{ platformLabel }}
      </span>
      <span class="version">v{{ APP_VERSION }}</span>
    </div>
  </nav>
</template>

<style scoped>
.sidenav {
  width: var(--sidebar-width);
  flex-shrink: 0;
  border-right: 2px solid var(--accent);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  gap: 5px;
  position: relative;
}

/* 右缘红色斜切条：侧栏与内容区的分界 */
.sidenav::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    var(--accent) 0%,
    var(--accent) 55%,
    transparent 55.2%,
    transparent 72%,
    var(--accent) 72.2%
  );
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 4px 4px 20px;
}

.logo {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  background: var(--accent);
  transform: skewX(var(--skew));
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.75);
  flex-shrink: 0;
}

.logo-text {
  transform: skewX(var(--unskew));
  font-family: var(--font-display);
  font-weight: 700;
  font-style: italic;
  font-size: 1rem;
  color: var(--accent-contrast);
  letter-spacing: 0.02em;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.name {
  font-family: var(--font-display);
  font-weight: 700;
  font-style: italic;
  font-size: 1rem;
  letter-spacing: -0.01em;
}

.tagline {
  font-size: 0.72rem;
  color: var(--text-faint);
}

.item {
  display: block;
  padding: 2px 0;
  color: var(--text-muted);
  font-size: 0.92rem;
  font-weight: 600;
  transition: color var(--dur-fast) var(--ease-out);
}

.item-face {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  transform: skewX(var(--skew));
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.item-face > * {
  transform: skewX(var(--unskew));
}

.item-face > span:last-child {
  display: flex;
}

.item:hover {
  color: var(--text);
}

.item:hover .item-face {
  background: var(--panel-hover);
}

/* 激活态：红色平行四边形 + 硬投影，文字反白 */
.item.active {
  color: var(--accent-contrast);
}

.item.active .item-face {
  background: var(--accent);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.7);
  color: var(--accent-contrast);
}

.palette-trigger {
  margin-top: 12px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 0;
  text-align: left;
}

.palette-trigger .item-face {
  border: 2px dashed var(--border-strong);
  transition: all var(--dur-fast) var(--ease-out);
}

.palette-trigger:hover {
  color: var(--accent-strong);
}

.palette-trigger:hover .item-face {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.palette-trigger span {
  flex: 1;
  text-align: left;
}

.palette-trigger kbd {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 3px;
  padding: 1px 6px;
  background: var(--bg-soft);
}

.footer {
  margin-top: auto;
  padding: 10px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.76rem;
  color: var(--text-muted);
  border: 1px solid var(--border);
  padding: 4px 11px;
  transform: skewX(var(--skew));
}

.platform-badge > * {
  transform: skewX(var(--unskew));
}

.dot {
  width: 7px;
  height: 7px;
  background: var(--accent);
}

.version {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-faint);
}

@media (max-width: 720px) {
  .sidenav {
    width: 100%;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    padding: 10px 12px;
  }

  .brand {
    padding: 0 8px 0 0;
  }

  .brand-text,
  .footer,
  .palette-trigger {
    display: none;
  }

  .item {
    flex-shrink: 0;
  }
}
</style>
