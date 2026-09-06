<script setup lang="ts">
import { computed, ref, watch, onScopeDispose } from 'vue'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { t } from '@/i18n'

/**
 * 通用对话框：Teleport 到 body，Esc / 点击遮罩关闭。
 * 焦点管理（WCAG AA）：打开时移焦进面板、Tab 循环限制在面板内、关闭时还原焦点。
 */
const props = withDefaults(defineProps<{ open: boolean; title: string; wide?: boolean }>(), {
  wide: false,
})

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

// 组件在 modal 打开状态下被卸载（如路由切换）时，清理全局监听
onScopeDispose(() => window.removeEventListener('keydown', onKeydown))

const modalRef = ref<HTMLElement | null>(null)
useFocusTrap(
  modalRef,
  computed(() => props.open),
)

const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" class="overlay" @click.self="emit('close')">
        <div
          :ref="(el) => (modalRef = el as HTMLElement | null)"
          class="modal"
          :class="{ wide }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <header class="head">
            <h3 :id="titleId">{{ title }}</h3>
            <button
              class="close"
              type="button"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal {
  width: min(520px, 100%);
  max-height: min(720px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.modal.wide {
  width: min(760px, 100%);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.head h3 {
  font-size: 0.98rem;
  font-weight: 700;
}

.close {
  border: none;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.close:hover {
  color: var(--text);
  background: var(--panel-hover);
}

.body {
  padding: 16px 18px;
  overflow-y: auto;
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-soft);
}
</style>
