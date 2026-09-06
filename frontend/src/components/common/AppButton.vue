<script setup lang="ts">
/**
 * 统一按钮。Punk Red 语言：主按钮 = 红色平行四边形（skew 外层、内容反斜切），
 * 硬投影表达可按下的"贴纸"感；:active 时压平投影。
 */
withDefaults(
  defineProps<{ variant?: 'primary' | 'ghost' | 'subtle' | 'danger'; disabled?: boolean }>(),
  {
    variant: 'ghost',
    disabled: false,
  },
)
</script>

<template>
  <button class="btn" :class="variant" :disabled="disabled" type="button">
    <span class="btn-content"><slot /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    transform var(--dur-fast) var(--ease-spring),
    background var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
  white-space: nowrap;
  background: transparent;
}

.btn-content {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transform: skewX(var(--unskew));
}

.btn:active:not(:disabled) {
  transform: skewX(var(--skew)) translateY(2px);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.primary {
  background: var(--accent);
  color: var(--accent-contrast);
  transform: skewX(var(--skew));
  box-shadow: 4px 4px 0 var(--shadow-sm-color, rgba(0, 0, 0, 0.8));
}

.primary:hover:not(:disabled) {
  background: var(--accent-strong);
  transform: skewX(var(--skew)) translateY(-2px);
  box-shadow: 4px 6px 0 var(--shadow-sm-color, rgba(0, 0, 0, 0.8));
}

.primary:active:not(:disabled) {
  box-shadow: 1px 1px 0 var(--shadow-sm-color, rgba(0, 0, 0, 0.8));
}

[data-theme='light'] .primary {
  box-shadow: 4px 4px 0 rgba(20, 20, 22, 0.85);
}

.ghost {
  border: 2px solid var(--border-strong);
  color: var(--text);
  background: var(--panel);
  transform: skewX(var(--skew));
}

.ghost:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.subtle {
  color: var(--text-muted);
  transform: skewX(var(--skew));
}

.subtle:hover:not(:disabled) {
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.danger {
  color: var(--danger);
  border: 2px solid color-mix(in srgb, var(--danger) 40%, transparent);
  transform: skewX(var(--skew));
}

.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
</style>
