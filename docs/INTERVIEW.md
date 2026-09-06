# 面试亮点讲解（Interview Guide）

这份文档回答一个问题：**如何在面试里把这个项目讲出深度**。包含三分钟介绍、亮点清单（问题 → 方案 → 深挖点）、以及高频追问的参考答案。

## 三分钟介绍（话术模板）

> FlexViword 是一个视频转文字工作台：拖入视频，本地提取音频，AI 生成带时间轴的字幕，并且和播放器逐句同步。
>
> 我做它有两个目的。一是产品本身完整：从任务队列、两阶段进度、取消重试，到字幕编辑（带撤销重做）、语音统计和 SRT/VTT 导出，是一条真实可用的流水线；二是它同时运行在浏览器和 Wails 桌面壳里——三种转写引擎（离线演示、浏览器直连 SiliconFlow + ffmpeg.wasm、桌面 Go 侧）藏在同一个 `TranscriptionEngine` 接口后面，宿主差异全部收敛在平台适配层。
>
> 工程上它是 TypeScript strict + Pinia + Vite，72 个单元测试覆盖 stores/services/纯函数，ESLint 9 flat config，GitHub Actions 跑 lint → typecheck → test → build。有几个我比较得意的细节：⌘K 命令面板的模糊搜索是自实现的子序列打分（连续/词首/跨度惩罚，命中位置还能高亮回填）；播放器同步用二分查找定位当前句、跳转请求带 token 防止同刻重复 seek；字幕编辑是整表快照的命令栈撤销；长字幕用固定行高虚拟列表；IndexedDB 写放大控制；隐私模式自动降级到内存存储且功能不中断。视觉系统也是按规范重做的：单一 emerald 主色、zink 中性阶、自托管 Space Grotesk、动效令牌化并尊重 prefers-reduced-motion。

## 亮点清单

| # | 亮点 | 问题 → 方案 | 面试官可能追问 |
| --- | --- | --- | --- |
| 1 | 引擎抽象（依赖倒置） | 三种转写路径（mock/浏览器/桌面）→ 统一接口 + 注册表 + 解析器（显式 > auto > 降级并提示原因） | 为什么不是简单 if/else；降级策略的用户感知；如何新增一个引擎（只需实现接口 + 注册） |
| 2 | 平台适配层 | 同一份代码跑浏览器和 Wails → 宿主差异（选文件/播放/提取/CORS）收敛到 bridge；Wails 绑定运行时从 `window.go` 取，不进浏览器包 | 检测方式；动态 import 与 tree-shaking 的权衡 |
| 3 | ⌘K 命令面板 | 自实现模糊搜索：子序列 + 打分（连续 +16 / 词首 +14 / 间隙跨度惩罚），命中下标回填 `<mark>` 高亮；命令注册表是响应式 computed，随语言/任务状态自动增删命令 | 打分函数为什么这么设计（对比 fzf/sublime）；为什么不用 cmdk 现成库；大数据量命令怎么优化（分词/Worker） |
| 4 | 撤销/重做 | 字幕编辑用命令栈：编辑前压整表快照（浅拷贝），undo/redo 交换栈顶，上限 50；`reactive(new Map())` 驱动按钮态；新编辑落栈清空 redo 分支 | 整表快照 vs 增量 inverse patch 的取舍（内存/复杂度/边界）；撤销后组件旧引用过期的问题；协同编辑下怎么办（OT/CRDT） |
| 5 | 播放器-字幕同步 | timeupdate 驱动 + 二分查找 O(log n) 定位当前句；句间空隙保留高亮；seek 用 `{at, token}` 让同刻重复跳转也能触发 watch；当前句大字幕条复用同一数据源 | 为什么不用遍历/IntersectionObserver；timeupdate 精度（~250ms）够不够、何时需要 rAF |
| 6 | 虚拟列表 | 万级字幕零卡顿：固定行高 O(1) 起点计算 + overscan；编辑走底部编辑条，不破坏行高恒定假设 | 可变行高方案（前缀和+二分）；为什么不用现成库；keying 策略 |
| 7 | 任务编排 | 单并发队列 + AbortController 全链路取消（sleep/fetch/ffmpeg.terminate 共享 signal）；AbortError 与失败分开建模 | 为什么限制并发；取消的竞态（完成瞬间取消）；重试语义 |
| 8 | 持久化 | IndexedDB 双 store（元数据/大文件分离）；写放大控制：进度不落库、阶段才落库、编辑 600ms 防抖；超配额与隐私模式降级为内存 | 为什么不用 localStorage；IndexedDB 事务语义 |
| 9 | 语音统计 | 纯函数统计（字数/语速/覆盖率/24 桶密度直方图），覆盖率只计有内容句段；手写 SVG 分布图零图表库，入场动画只动 scaleY | 为什么要自己算而不引 chart 库（bundle/可控性）；分桶策略；长句摊到多桶的原因 |
| 10 | 无时间戳 → 时间轴 | SenseVoice 只返回纯文本 → 中英标点断句（lookbehind 正则，非捕获组坑）→ 按字数占比加权分配时长，诚实标记 estimated；本地 Whisper 则用 return_timestamps 拿真实时间轴（timingEstimated=false） | 正则捕获组会让 `String.split` 插入 undefined；误差来源 |
| 11 | 本地 Whisper 引擎 | Transformers.js + ONNX 浏览器内推理：Web Worker 常驻 pipeline、权重浏览器缓存、HF→hf-mirror 自动回退、取消=terminate worker、文件检查前置避免演示任务白下权重；计算后端 auto——WebGPU（fp32 编码 + q4 解码的官方配方）优先、失败回退 WASM q8，实测 WebGPU 路径转写质量反而更好（q8 全量化在 WebGPU 产出乱码是已知坑） | 为什么 auto 不自动选本地（40MB 首次成本须显式）；WebGPU 量化配方的取舍；tiny/base/small 档位权衡 |
| 12 | ffmpeg.wasm 落地 | 单线程核心免 COOP/COEP；核心 ~32MB 懒加载 + CDN 双源回退 + 180s 超时。E2E 实调出三个真实坑：①Vite dev 类 Worker 404 → classWorkerURL 修复；②toBlobURL 压缩传输下 content-length 对账失配 → 自写流式下载器；③UMD 核心在 module worker 导入失败 → 换 /esm/ 变体核心 | SAB/COEP 是什么；为什么直读 16kHz PCM 绕过 decodeAudioData；如何定位"无声挂起"类问题（错误透传 + console 留痕 + CDN 分速度测试） |
| 13 | CORS/BFF | api.siliconflow.cn 不开 CORS → dev 用 Vite proxy，生产建议轻量 BFF；密钥始终在用户手里不落 BFF | 浏览器直连第三方 API 的通用解法；BFF 的边界 |
| 14 | 设计系统 | 双 skill 融合：taste-skill 反俗套 + anthropics/frontend-design「把大胆花在一个地方」。最终方向「Punk Red」——从女神异闻录题材提取完整形状语言：红黑白三色、平行四边形=可交互、斜切粗黑标题=层级、半调网点=装饰、星形爆点=空态、硬位移投影=主动作、分段能量条=进度；punk 只花在 chrome 层，内容区安静；对比度/reduced-motion/键盘焦点底线保持 | 为什么完整形状语言而不是换 accent 色（避免"近黑底+朱红单色"AI 俗套）；形状编码信息的含义；双主题如何共享一套形状令牌 |
| 15 | 工程化 | TS strict 全绿、ESLint9 flat + Prettier、84 例 Vitest（含 fake timers + fake-indexeddb 组合坑）、GH Actions 四段流水线、路由级代码分割 | 测试金字塔；为什么组件测试放后期 |
| 16 | 微型 i18n | ~40 行实现 dot-path + 插值 + 双层回退；`enUS: typeof zhCN` 让漏译编译期报错 | 什么时候该直接上 vue-i18n（复数/日期/懒加载语言包） |

## 高频追问 Q&A

**Q: 为什么任务队列只允许单并发？**
转写 = 本地 CPU（提取）+ 大文件上传 + 远程推理，三者任一都是瓶颈，并发只会让进度互相拖慢、取消语义复杂化。产品上"排队 → 可取消"也比"同时跑三个"更可预期。代价是吞吐，如果要做批处理场景，我会把队列改成可配置并发数 + 每任务独立 AbortController（结构已经支持）。

**Q: 虚拟列表为什么自己写？**
核心逻辑 60 行：起点 = floor(scrollTop / itemHeight)，窗口 = 可视行数 + 2×overscan。自己写的好处是把"固定行高"这个假设显式化，并且可以为了不破坏虚拟化而调整交互设计（编辑放底部编辑条）。可变行高的正确姿势是布局缓存 + 前缀和 + 二分，接口不用变。

**Q: 跳转为什么是 `{at, token}` 而不是直接设 `video.currentTime`？**
字幕列表和播放器是两个组件，跳转请求要跨组件传递。若只存时间值，连续两次跳到同一秒（比如点同一句）第二次不会触发 watch。token 单调递增，把"值变化"变成"事件变化"。

**Q: IndexedDB 写放大怎么控制？**
转写中 progress 每 200ms 变一次，若每次都 put 会造成无意义的事务开销。策略：进行中的进度只改内存（响应式够用），**阶段跃迁才落库**；字幕编辑 600ms 防抖合并；大视频文件放独立 store 且 put 失败静默降级（保内存引用）。持久化和响应式是两条通道，各有节流策略。

**Q: API Key 存 localStorage 不是不安全吗？**
权衡：这是本地优先（local-first）工具，密钥属于用户自己，BFF 不存储任何密钥；localStorage 的威胁模型是 XSS，本项目无第三方运行时代码、CSP 可再加固。桌面端可以升级到 OS keychain（Wails 提供能力），web 端更严格的做法是 BFF 签发短期 token。能讲清楚威胁模型比背"localStorage 不安全"重要。

**Q: ffmpeg.wasm 踩过什么坑？**
三个：①多线程核心需要 SharedArrayBuffer → 服务端必须带 COOP/COEP 头，静态托管成本高，所以选单线程核心；②核心 wasm ~30MB，必须懒加载且对失败重试做状态重置；③`terminate()` 之后实例不可复用，要把单例和加载中的 promise 一起清空，否则下次拿到的是僵尸实例。

**Q: 测试里 fake timers 有什么坑？**
fake-indexeddb 依赖 `queueMicrotask` 调度事务回调，而 fake timers 默认连 `queueMicrotask` 一起劫持，IDB 的回调永远不被执行，测试死锁。解法是精确指定 `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`——只劫持 mock 引擎真正用到的定时器。这个坑的本质是：劫持全局时间时要想清楚所有被测代码的调度依赖。

**Q: 无时间戳的识别结果怎么做到逐句同步？**
两步：断句（中英标点 lookbehind 正则，注意捕获组会让 split 往结果数组塞 undefined，必须用非捕获组）+ 按字数占比加权分配总时长。这是估算，meta 里 `timingEstimated: true` 如实标记，UI 不假装它是精确的。要精确就换带词级时间戳的模型，引擎接口不用动。

**Q: 命令面板的模糊搜索为什么自己写，打分规则是什么？**
核心是"有序子序列 + 启发式打分"，~80 行纯函数：连续命中 +16、词首/驼峰边界命中 +14、普通命中 +6、段间空隙最多 -8、命中总跨度按超出部分 ×0.4 惩罚。这样 "wrk" 会优先命中"工作台"而不是把 w/r/k 撒得很远的词条。label 直接命中比 keywords 命中优先（-4 分偏置）。自己写的原因：命令面板场景只需要子序列匹配，引 fuzzysort/cmdk 属于超配；而且打分函数可单测、命中下标能直接回填 `<mark>` 高亮。命令量到几千条时再考虑分词索引或移入 Worker。

**Q: 撤销/重做为什么用整表快照而不是增量补丁？**
增量 inverse patch 省内存但要为每种编辑写逆运算、处理边界（连续编辑合并、重做分支丢弃）；整表快照 20 行代码、零边界情况，字幕量级（几千条浅拷贝对象）内存完全可控（上限 50 步）。一旦撤销替换了整个 segments 数组，组件层缓存的旧元素引用就会过期——这是快照方案的隐性代价，我在测试里专门覆盖了"撤销后必须从 store 重读"。真要做协同编辑，快照方案就得换成 OT/CRDT，那是对接 Yjs 的接口问题。

**Q: 本地模型和云 API 怎么选？为什么 auto 不自动选本地？**
产品答案：本地 Whisper 的价值是隐私（数据不出设备）+ 零 API 成本 + 真实时间戳；代价是首次 40–250MB 权重下载和较慢的 WASM 推理（WebGPU 可缓解）。auto 策略永远不会自动选本地——首次使用的大体积下载必须由用户显式决定，否则"我只是想试试"的用户会莫名进入 40MB 等待。工程上它藏在同一个 `TranscriptionEngine` 接口后，加引擎不动 UI；推理放 Worker 保证 UI 不冻结；取消用 terminate（wasm 无法中断），权重在 HTTP 缓存里所以重载很快。

**Q: ffmpeg.wasm 在 Vite 里有哪些坑？（真实 E2E 调试实录）**
三个连环坑，每个都有一段"无声挂起"的故事：①`@ffmpeg/ffmpeg` 默认 `new Worker(new URL('./worker.js', import.meta.url))`，Vite dev 预打包后该路径 404，`load()` 永久挂起——用 `?worker&url` 显式提供 `classWorkerURL`；②官方 `toBlobURL` 在 gzip/br 传输下用压缩后 content-length 对账解压后字节，必然误判下载不完整，回退路径还对已消费的流二次 arrayBuffer——自写流式下载器，只信实际字节数；③module worker 里 `importScripts` 不存在，回退 `import(umd核)` 无 default 导出——改用 CDN 上的 `/dist/esm/` 变体核心。方法论：把底层错误透传到 UI 和 store（而不是被 i18n 文案吞掉）、console 留痕、再用分 CDN 速度测试区分"网络慢"和"代码挂"。

**Q: 如果重做一次，你会改什么？**
① 首屏再加一步预算控制（目前 ffmpeg chunk 已独立分包，可再加 preload 提示）；② 组件级测试和一条 Playwright E2E 主链路；③ 模糊检索加拼音支持（中文命令的首次输入体验）；④ WebGPU 推理 + 模型进度更细粒度（per-file → 单文件流式）；⑤ 大视频提取移到独立 Worker 并支持系统休眠恢复。

## 演示动线（现场 demo 建议）

1. 打开首页 → 按 **⌘K / Ctrl+K** 打开命令面板：输入 "srt" 看模糊命中与高亮，Esc 关闭
2. 引擎下拉切到 **本地 Whisper** → 用仓库自带的 `frontend/public/e2e-test.mp4`（TTS 合成的 8 秒英文语音）拖入：看 下载模型 → 提取音频 → AI 识别 五阶段进度，全程无 API Key、数据不出浏览器
3. 完成后看三处联动：播放器下方当前句字幕条、字幕列表高亮、语音统计面板（字数/语速/密度分布图）
4. 点任意字幕跳转、播放（或空格键）、调倍速；编辑一句字幕 → 撤销/重做
5. 导出 → 预览 SRT 内容 → 下载（真实时间码，非估算）
6. 刷新页面 → 历史任务还在（IndexedDB）；设置页切英文 + 浅色主题（即时生效）
7. 打开 DevTools → Network 看 chunk 分包（transformers ~874KB 独立 chunk 懒加载）；Application → IndexedDB 看双 store 结构
