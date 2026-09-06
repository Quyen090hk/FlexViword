<script setup lang="ts">
withDefaults(defineProps<{ value: number; showLabel?: boolean }>(), { showLabel: false })
</script>

<template>
  <div
    class="progress"
    role="progressbar"
    :aria-valuenow="Math.round(value)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="track">
      <div class="fill" :style="{ width: `${Math.min(100, Math.max(0, value))}%` }" />
    </div>
    <span v-if="showLabel" class="label">{{ Math.round(value) }}%</span>
  </div>
</template>

<style scoped>
.progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.track {
  flex: 1;
  height: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--border-strong);
  overflow: hidden;
  transform: skewX(var(--skew));
}

.fill {
  height: 100%;
  /* 分段能量条：硬分隔的红色段（Persona 菜单语言） */
  background: repeating-linear-gradient(90deg, var(--accent) 0 14px, var(--accent-deep) 14px 16px);
  transition: width 0.25s var(--ease-out);
}

.label {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text);
  min-width: 40px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
