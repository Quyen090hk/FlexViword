import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面壳（wails 平台）下的引擎兼容性测试。
 * vi.mock 平台适配层模拟 window.go 注入，验证：
 * 1. wails 引擎把设置里的 model 透传给 Go（与 web 端 siliconflow 引擎参数来源一致）；
 * 2. 取消语义：AbortSignal 已中止时不发起任何 Go 调用；
 * 3. siliconflow 引擎在桌面被标记 web-only（该服务由 wails 引擎覆盖）。
 */
const transcribeSpy = vi.fn(
  async (_apiKey: string, model: string, _audioPath: string) => `text:${model}`,
)
const convertSpy = vi.fn(async (_path: string) => 'C:/audio.wav')

vi.mock('@/services/bridge/platform', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return {
    ...actual,
    isDesktop: () => true,
    getWailsApp: () => ({
      SelectVideo: async () => 'C:/video.mp4',
      ConvertToAudio: convertSpy,
      TranscribeAPI: transcribeSpy,
      GetVideoStreamURL: async () => 'http://127.0.0.1:0/media',
    }),
    detectPlatform: () => 'wails',
  }
})

import { DEFAULT_SETTINGS, type TranscriptionSettings } from '@/types/settings'
import type { EngineContext, TaskRecord } from '@/types/domain'
import { wailsEngine } from '../wails'
import { engineAvailability, resolveEngine } from '../index'

function settings(patch: Partial<TranscriptionSettings> = {}): TranscriptionSettings {
  return { ...DEFAULT_SETTINGS, ...patch }
}

function makeTask(path: string): TaskRecord {
  return {
    id: 'task_w',
    name: 'desktop.mp4',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stage: 'queued',
    progress: 0,
    video: { name: 'desktop.mp4', size: 0, mime: 'video/mp4', path },
  }
}

function makeCtx(signal: AbortSignal = new AbortController().signal): EngineContext {
  return { signal, report: () => {} }
}

describe('wails engine (desktop compatibility)', () => {
  beforeEach(() => {
    transcribeSpy.mockClear()
    convertSpy.mockClear()
  })

  it('passes settings.model through to the Go binding', async () => {
    const output = await wailsEngine.run(
      {
        task: makeTask('C:/video.mp4'),
        settings: settings({ apiKey: 'sk-x', model: 'FunAudioLLM/SenseVoiceSmall' }),
        durationSec: 10,
      },
      makeCtx(),
    )
    expect(convertSpy).toHaveBeenCalledWith('C:/video.mp4')
    expect(transcribeSpy).toHaveBeenCalledWith(
      'sk-x',
      'FunAudioLLM/SenseVoiceSmall',
      'C:/audio.wav',
    )
    expect(output.segments.length).toBeGreaterThan(0)
    expect(output.meta.engine).toBe('wails')
  })

  it('aborts before any Go call when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      wailsEngine.run(
        { task: makeTask('C:/video.mp4'), settings: settings({ apiKey: 'sk-x' }) },
        makeCtx(controller.signal),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(convertSpy).not.toHaveBeenCalled()
    expect(transcribeSpy).not.toHaveBeenCalled()
  })

  it('rejects with AbortError when cancellation lands mid-run', async () => {
    const controller = new AbortController()
    // Go 调用挂起期间取消
    transcribeSpy.mockImplementationOnce(() => new Promise(() => {}))
    const pending = wailsEngine.run(
      { task: makeTask('C:/video.mp4'), settings: settings({ apiKey: 'sk-x' }) },
      makeCtx(controller.signal),
    )
    const expectation = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await expectation
    // 引擎 Promise 已解除占用：队列不被阻塞（runningId 可被 pump 释放）
  })
})

describe('siliconflow on desktop is web-only (covered by wails engine)', () => {
  it('marks siliconflow unsupported on the desktop platform', () => {
    const list = engineAvailability('wails', settings({ apiKey: 'sk-x' }))
    expect(list.find((e) => e.id === 'siliconflow')).toMatchObject({
      supported: false,
      reason: 'web-only',
    })
  })

  it('falls back instead of failing when desktop users explicitly pick siliconflow', () => {
    const resolved = resolveEngine('wails', settings({ engine: 'siliconflow', apiKey: 'sk-x' }))
    // 显式选择的引擎不受支持 → 回退（桌面端 auto 本就优先 wails，同服务无损）
    expect(resolved.fallbackReason).not.toBe('')
    expect(resolved.id).not.toBe('siliconflow')
  })
})
