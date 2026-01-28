<script setup>
import {reactive} from 'vue'
import {SelectVideo, ConvertToAudio, TranscribeAPI} from '../../wailsjs/go/main/App'

const data = reactive({
  videoPath: "",
  audioPath: "",
  // 默认预填 SiliconFlow 的配置
  apiKey: "", 
  baseUrl: "https://api.siliconflow.cn/v1/audio/transcriptions",
  model: "FunAudioLLM/SenseVoiceSmall", 
  
  status: "",
  resultText: "",
  isProcessing: false,
  showSettings: true 
})

function selectFile() {
  SelectVideo().then(result => {
    if (result) {
      data.videoPath = result
      data.status = "已就绪，准备提取..."
      data.audioPath = ""
      data.resultText = ""
    }
  })
}

async function startProcess() {
  if (!data.videoPath) return
  if (!data.apiKey) {
    data.status = "⚠️ 请先在设置中配置 API Key"
    return
  }
  
  data.isProcessing = true
  data.resultText = ""

  try {
    data.status = "⏳ 正在提取音频 (FFmpeg)..."
    const audioPath = await ConvertToAudio(data.videoPath)
    data.audioPath = audioPath
    
    data.status = `🚀 正在请求 AI (${data.model})...`
    const text = await TranscribeAPI(data.apiKey, data.audioPath)
    
    data.resultText = text
    data.status = "✅ 识别完成！"
  } catch (err) {
    data.status = "dX 发生错误: " + err
  } finally {
    data.isProcessing = false
  }
}
</script>

<template>
  <main class="main-card">
    <h2 class="title">FlexViword <span class="tag">AI 字幕</span></h2>
    
    <div class="section settings-container">
      <div class="settings-header" @click="data.showSettings = !data.showSettings">
        <div class="header-left">
          <span class="icon">⚙️</span>
          <span>API 配置 (SiliconFlow)</span>
        </div>
        <span class="arrow" :class="{ rotated: data.showSettings }">▼</span>
      </div>
      
      <transition name="slide-fade">
        <div v-if="data.showSettings" class="settings-body">
          <div class="form-group">
            <label>API Key</label>
            <input v-model="data.apiKey" type="password" placeholder="sk-..." class="input-modern" />
          </div>
          <div class="form-row">
            <div class="form-group flex-2">
              <label>API URL</label>
              <input v-model="data.baseUrl" type="text" class="input-modern" />
            </div>
            <div class="form-group flex-1">
              <label>Model</label>
              <input v-model="data.model" type="text" class="input-modern" placeholder="Model Name" />
            </div>
          </div>
        </div>
      </transition>
    </div>

    <div class="section action-area">
      <div class="file-display" :class="{ 'has-file': data.videoPath }">
        <span class="file-icon">📄</span>
        <span class="file-path">{{ data.videoPath || '未选择任何视频文件' }}</span>
      </div>
      
      <div class="btn-group">
        <button class="btn secondary" @click="selectFile">
          📂 选择视频
        </button>
        <button class="btn primary" @click="startProcess" :disabled="data.isProcessing || !data.videoPath">
          <span v-if="data.isProcessing" class="loader"></span>
          {{ data.isProcessing ? '处理中...' : '开始识别' }}
        </button>
      </div>
    </div>
    
    <div class="section status-bar" v-if="data.status">
      <p :class="{ error: data.status.includes('错误') || data.status.includes('⚠️') }">
        {{ data.status }}
      </p>
    </div>

    <div class="section result-box" v-if="data.resultText">
      <div class="result-header">
        <span>识别结果</span>
        <span class="copy-hint">共 {{ data.resultText.length }} 字</span>
      </div>
      <textarea readonly :value="data.resultText" class="result-textarea"></textarea>
    </div>
  </main>
</template>

<style scoped>
/* 容器风格 */
.main-card {
  width: 90%;
  max-width: 680px;
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  color: #333;
  text-align: left;
}

.title {
  margin-top: 0;
  margin-bottom: 25px;
  font-size: 1.8rem;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag {
  font-size: 0.8rem;
  background: #e0e7ff;
  color: #6366f1;
  padding: 4px 8px;
  border-radius: 6px;
  vertical-align: middle;
}

/* 设置面板 */
.settings-container {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 25px;
  background: #f9fafb;
}

.settings-header {
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  background: #f3f4f6;
  transition: background 0.2s;
}

.settings-header:hover {
  background: #e5e7eb;
}

.header-left {
  font-weight: 600;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 8px;
}

.arrow {
  font-size: 0.8rem;
  transition: transform 0.3s;
  color: #9ca3af;
}

.arrow.rotated {
  transform: rotate(180deg);
}

.settings-body {
  padding: 20px;
  background: white;
  border-top: 1px solid #e5e7eb;
}

/* 表单元素 */
.form-group { margin-bottom: 12px; }
.form-group:last-child { margin-bottom: 0; }
.form-row { display: flex; gap: 15px; }
.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 6px;
}

.input-modern {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.2s;
  background: #f9fafb;
  box-sizing: border-box;
}

.input-modern:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  background: white;
}

/* 操作区 */
.action-area {
  margin-bottom: 25px;
}

.file-display {
  background: #f3f4f6;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 15px;
  font-family: monospace;
  font-size: 0.9rem;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px dashed #d1d5db;
}

.file-display.has-file {
  color: #374151;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.btn-group {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn.primary {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  flex: 2;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
}

.btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 10px -1px rgba(79, 70, 229, 0.3);
}

.btn.primary:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.btn.secondary {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
  flex: 1;
}

.btn.secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* 结果区 */
.status-bar {
  margin-bottom: 15px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #6366f1;
}
.status-bar .error { color: #ef4444; }

.result-box {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.result-header {
  background: #f9fafb;
  padding: 8px 15px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.85rem;
  font-weight: 600;
  color: #6b7280;
  display: flex;
  justify-content: space-between;
}

.result-textarea {
  width: 100%;
  height: 200px;
  padding: 15px;
  border: none;
  resize: vertical;
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #1f2937;
  box-sizing: border-box;
}

.result-textarea:focus {
  outline: none;
}

/* 动画效果 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>