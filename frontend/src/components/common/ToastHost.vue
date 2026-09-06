<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import Icon from './Icon.vue'

const ui = useUiStore()
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="item in ui.toasts" :key="item.id" class="toast" :class="item.type" role="status">
        <Icon
          :name="item.type === 'success' ? 'check' : item.type === 'error' ? 'x' : 'info'"
          :size="16"
        />
        <span class="message">{{ item.message }}</span>
        <button class="close" :aria-label="'close'" @click="ui.dismiss(item.id)">
          <Icon name="x" :size="13" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(420px, calc(100vw - 32px));
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-left: 4px solid var(--accent);
  box-shadow: var(--shadow-sm);
  font-size: 0.88rem;
}

.toast.success {
  color: var(--success);
}

.toast.error {
  color: var(--danger);
}

.toast.info {
  color: var(--accent-strong);
}

.message {
  color: var(--text);
  flex: 1;
}

.close {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 2px;
  display: grid;
  place-items: center;
}

.close:hover {
  color: var(--text);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
