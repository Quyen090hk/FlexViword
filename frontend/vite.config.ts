/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 生产环境中转写 API 建议通过自建轻量代理(BFF)转发，避免 CORS 与密钥暴露，
    // 这里提供开发态代理示例；浏览器端默认 baseUrl 走 /api/siliconflow。
    proxy: {
      '/api/siliconflow': {
        target: 'https://api.siliconflow.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/siliconflow/, ''),
      },
    },
  },
  worker: {
    // Whisper worker 内部使用动态 import(@huggingface/transformers)，必须是 ESM 格式
    format: 'es',
  },
  optimizeDeps: {
    // 预打包 transformers，避免 dev 首次使用时触发 re-optimize 导致整页 reload 打断任务
    include: ['@huggingface/transformers'],
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          ffmpeg: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    css: false,
  },
})
