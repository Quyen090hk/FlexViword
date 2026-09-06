<script setup lang="ts">
import type { IconName } from './icon-names'

/**
 * 极简图标组件：内置 path 集，stroke 风格，随 currentColor 变色。
 * 统一 24 viewBox / 1.8 描边，杜绝 emoji 与混用多套图标库。
 */
withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

const PATHS: Record<IconName, string[]> = {
  film: ['M4 4h16v16H4z', 'M4 9h16', 'M4 15h16', 'M9 4v16', 'M15 4v16'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  sliders: [
    'M4 6h16',
    'M4 12h16',
    'M4 18h16',
    'M9 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M15 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8h.01', 'M12 11v5'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M21 21l-4.3-4.3'],
  pencil: ['M4 20l4-1L19.5 7.5a2.1 2.1 0 0 0-3-3L5 16z'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13'],
  plus: ['M12 5v14', 'M5 12h14'],
  'chevron-down': ['M6 9l6 6 6-6'],
  copy: ['M9 9h11v11H9z', 'M5 15V5a1 1 0 0 1 1-1h10'],
  play: ['M8 5v14l11-7z'],
  pause: ['M7 5h4v14H7z', 'M13 5h4v14h-4z'],
  check: ['M4 12l5 5L20 7'],
  moon: ['M20.4 13.2A8.5 8.5 0 1 1 10.8 3.6a7 7 0 0 0 9.6 9.6z'],
  sun: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': [
    'M3 3l18 18',
    'M10.6 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a16.8 16.8 0 0 1-3.2 4',
    'M6.1 6.5C3.3 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4-.8',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-15.5-6.4L3 13'],
  redo: ['M21 7v6h-6', 'M3 17a9 9 0 0 1 15.5-6.4L21 13'],
  gauge: ['M12 13l3.5-3.5', 'M5.5 19a9 9 0 1 1 13 0'],
  activity: ['M22 12h-4l-3 8L9 4l-3 8H2'],
  captions: [
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M6.5 12h4',
    'M6.5 15.5h7',
    'M14 12h3.5',
  ],
  command: [
    'M9 9V6a3 3 0 1 0-3 3h3zm0 0v6m0-6h6m-6 6H6a3 3 0 1 0 3 3v-3zm6-6V6a3 3 0 1 1 3 3h-3zm0 0v6m0 0h3a3 3 0 1 1-3 3v-3z',
  ],
  globe: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    'M3 12h18',
    'M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z',
  ],
  mic: [
    'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z',
    'M19 10v1a7 7 0 0 1-14 0v-1',
    'M12 18v3',
  ],
  folder: ['M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z'],
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in PATHS[name]" :key="i" :d="d" />
  </svg>
</template>
