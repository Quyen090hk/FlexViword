<script setup lang="ts">
import SideNav from '@/components/layout/SideNav.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import CommandPalette from '@/components/common/CommandPalette.vue'
import { useUiStore } from '@/stores/ui'
import { useHotkeys } from '@/composables/useHotkeys'

const ui = useUiStore()

// ⌘K / Ctrl+K：全局命令面板（输入框聚焦时也响应）
useHotkeys([{ key: 'mod+k', allowInInput: true, handler: () => ui.togglePalette() }])
</script>

<template>
  <div class="app-shell">
    <SideNav />
    <main class="content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="$route.path" />
        </Transition>
      </RouterView>
    </main>
    <CommandPalette />
    <ToastHost />
    <div class="noise-layer" aria-hidden="true" />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 28px 32px 48px;
}

@media (max-width: 720px) {
  .app-shell {
    flex-direction: column;
  }

  .content {
    padding: 18px 16px 40px;
  }
}
</style>

<style>
/* 路由页面切换：只动 opacity / transform */
.page-enter-active {
  transition:
    opacity var(--dur) var(--ease-out),
    transform var(--dur) var(--ease-out);
}

.page-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
