<script setup>
import {reactive} from 'vue'
import {SelectVideo, ConvertToAudio, TranscribeAPI} from '../../wailsjs/go/main/App'

const data = reactive({
  videoPath: "",
  audioPath: "",
  // 默认预填 SiliconFlow 的配置
  apiKey: "", 
  baseUrl: "https://api.siliconflow.cn/v1/audio/transcriptions",
  model: "FunAudioLLM/SenseVoiceSmall", // 推荐模型，速度极快
  
  status: "",
  resultText: "",
  isProcessing: false,
  showSettings: true // 控制设置折叠
})

function selectFile() {
  SelectVideo().then(result => {
    if (result) {
      data.videoPath = result
      data.status = "已选择视频"
      data.audioPath = ""
      data.resultText = ""
    }
  })
}

async function startProcess() {
  if (!data.videoPath) return
  if (!data.apiKey) {
    data.status = "错误: 请输入 API Key"
    return
  }
  
  data.isProcessing = true
  data.resultText = ""

  try {
    data.status = "正在提取音频 (FFmpeg)..."
    const audioPath = await ConvertToAudio(data.videoPath)
    data.audioPath = audioPath
    
    data.status = `正在调用 API (${data.model})...`
    const text = await TranscribeAPI(data.apiKey, data.audioPath)
    
    data.resultText = text
    data.status = "识别完成！"
  } catch (err) {
    data.status = "出错: " + err
  } finally {
    data.isProcessing = false
  }
}
</script>

<template>
  <main>
    <div class="box">
      <h2>MP4 语音转文字 (SiliconFlow版)</h2>
      
      <div class="section settings">
        <div class="settings-header" @click="data.showSettings = !data.showSettings">
          <span>⚙️ API 设置 (SiliconFlow)</span>
          <span>{{ data.showSettings ? '▼' : '▶' }}</span>
        </div>
        
        <div v-if="data.showSettings" class="settings-body">
          <label>API Key:</label>
          <input v-model="data.apiKey" type="password" placeholder="sk-..." class="input-text" />
          
          <label>API URL:</label>
          <input v-model="data.baseUrl" type="text" class="input-text" />
          
          <label>Model Name:</label>
          <input v-model="data.model" type="text" class="input-text" placeholder="FunAudioLLM/SenseVoiceSmall" />
        </div>
      </div>

      <div class="section">
        <button class="btn" @click="selectFile">📂 选择视频文件</button>
        <p v-if="data.videoPath" class="path">{{ data.videoPath }}</p>
      </div>

      <div class="section" v-if="data.videoPath">
        <button class="btn primary" @click="startProcess" :disabled="data.isProcessing">
          {{ data.isProcessing ? '处理中...' : '🚀 开始识别' }}
        </button>
      </div>
      
      <div class="section" v-if="data.status">
        <p :class="{ error: data.status.includes('出错') || data.status.includes('错误') }">{{ data.status }}</p>
      </div>

      <div class="section result-box" v-if="data.resultText">
        <h3>识别结果:</h3>
        <textarea readonly :value="data.resultText" rows="10"></textarea>
      </div>
    </div>
  </main>
</template>

<style scoped>
.box { max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
.section { margin-bottom: 20px; }
.settings { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
.settings-header { background: #f5f5f5; padding: 10px; cursor: pointer; display: flex; justify-content: space-between; user-select: none; }
.settings-body { padding: 15px; background: #fff; }
.btn { padding: 10px 20px; cursor: pointer; margin-right: 10px; }
.btn.primary { background-color: #6366f1; color: white; border: none; } /* SiliconFlow 紫色风格 */
.input-text { width: 100%; padding: 8px; margin: 5px 0 15px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;}
label { font-size: 0.9em; font-weight: bold; color: #555; }
textarea { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 4px; border: 1px solid #ccc; }
.error { color: red; font-weight: bold; }
</style>