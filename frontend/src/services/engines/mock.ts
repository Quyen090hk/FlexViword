import type { EngineContext, EngineInput, EngineOutput, TranscriptionEngine } from '@/types/domain'
import { sleep, throwIfAborted } from '@/utils/abort'
import { uid } from '@/utils/id'
import { EngineError } from './error'

/**
 * 离线演示引擎：不依赖网络与 API Key。
 * 按真实流水线的节奏（提取音频 → 调用识别）模拟进度，
 * 并基于视频时长生成一份与播放器可同步高亮的字幕 —— 面试演示的“零配置入口”。
 */

const DEMO_SENTENCES = [
  '欢迎体验 FlexViword，这是一个把视频一键转成文字的工作台。',
  '选择视频后，音频会在本地提取，再把识别请求发送到语音模型。',
  '识别完成的字幕会与播放器逐句同步，点击任意一句即可跳转播放。',
  '你可以直接编辑每句字幕，修正专有名词或标点。',
  '导出支持 SRT、VTT、纯文本与 Markdown 四种格式。',
  '所有任务都会保存在浏览器的 IndexedDB 中，刷新页面也不会丢失。',
  '整套前端运行在浏览器里，也可以嵌入 Wails 桌面壳复用同一份代码。',
  '感谢观看，祝你的下一个视频创作顺利。',
]

function buildDemoSegments(durationSec: number): EngineOutput['segments'] {
  const totalChars = DEMO_SENTENCES.reduce((sum, s) => sum + s.length, 0)
  let cursor = 0
  return DEMO_SENTENCES.map((sentence, i) => {
    const isLast = i === DEMO_SENTENCES.length - 1
    const span = (sentence.length / totalChars) * durationSec
    const start = cursor
    const end = isLast ? durationSec : start + span
    cursor = end
    return { id: uid('seg'), start, end, text: sentence }
  })
}

export const mockEngine: TranscriptionEngine = {
  id: 'mock',
  isReady: () => true,
  async run(input: EngineInput, ctx: EngineContext): Promise<EngineOutput> {
    const duration = input.durationSec && input.durationSec > 1 ? input.durationSec : 60
    const steps = 8
    // 模拟阶段一：提取音频
    ctx.report('extracting', 0)
    for (let i = 1; i <= steps; i++) {
      await sleep(160, ctx.signal)
      throwIfAborted(ctx.signal)
      ctx.report('extracting', (i / steps) * 40)
    }
    // 模拟阶段二：调用识别
    for (let i = 1; i <= 10; i++) {
      await sleep(220, ctx.signal)
      throwIfAborted(ctx.signal)
      ctx.report('transcribing', 40 + (i / 10) * 55)
    }
    if (DEMO_SENTENCES.length === 0) throw new EngineError('EMPTY_RESULT')
    const segments = buildDemoSegments(duration)
    return {
      segments,
      meta: {
        engine: 'mock',
        model: 'demo/simulated-transcript',
        durationSec: duration,
        createdAt: Date.now(),
        timingEstimated: true,
      },
    }
  },
}
