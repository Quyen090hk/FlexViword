<script setup lang="ts">
import Icon from './Icon.vue'
import type { IconName } from './icon-names'

withDefaults(defineProps<{ icon?: IconName; title: string; description?: string }>(), {
  icon: 'film',
  description: '',
})
</script>

<template>
  <div class="empty" role="status">
    <div class="icon-wrap starburst">
      <Icon :name="icon" :size="24" />
    </div>
    <p class="title">{{ title }}</p>
    <p v-if="description" class="desc">{{ description }}</p>
    <div class="actions"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
}

/* 红色星形爆点 + 白色图标：Persona 的漫厕感符号 */
.icon-wrap {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-contrast);
  margin-bottom: 6px;
  animation: star-pop var(--dur-slow) var(--ease-spring) backwards;
}

@keyframes star-pop {
  from {
    opacity: 0;
    transform: scale(0.6) rotate(-12deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}

.title {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 750;
  font-size: 1.02rem;
  color: var(--text);
}

.desc {
  font-size: 0.88rem;
  color: var(--text-muted);
  max-width: 320px;
}

.actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}
</style>
