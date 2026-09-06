# Changelog

本项目的显著变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [1.4.0] - 2026-09-06

### 新增：输入源扩展（四条新输入路径）

- **纯音频直转**：mp3 / wav / m4a / aac / ogg / opus / flac 直接转写——ffmpeg 对音频输入
  复用同一条提取命令，引擎层零改动；`mediaKindOf` 推断媒体种类（按 mime → 扩展名兜底），
  播放器对纯音频显示覆盖层标识
- **批量导入**：文件选择器多选 + 拖拽多文件，逐个入队（单并发队列自动排队），toast 反馈
  导入数量
- **麦克风录音 → 转写**：`useRecorder`（MediaRecorder，opus/webm 或 m4a 按浏览器能力选择），
  录音计时、停止后自动创建转写任务；卸载自动释放麦克风；实测「录音 → 停止 → 任务完成转写」
  全闭环。说明：Whisper 非流式，为录完转写而非实时字幕
- **链接导入（桌面端）**：Go 侧 `download` 包调用本机 yt-dlp（bv*+ba 合流 mp4、--no-playlist、
  `after_move:filepath` 取输出路径），下载到 用户目录/Downloads/FlexViword；未安装 yt-dlp 时
  前端给出安装指引；web 端隐藏该入口（CORS 无法直下）
- **文件夹导入（桌面端）**：Go 目录对话框 + 顶层媒体文件枚举（按扩展名白名单），批量建任务

### 结构
- `VideoAsset/TaskRecord.video` 新增 `kind: 'video' | 'audio'`
- 文件选择器重构为 `pickMediaFiles(multiple)` / `mediaFromDataTransfer`（音视频统一）
- Go 新增 `download` 包与 `ImportMediaFolder`/`DownloadMedia` 绑定，附 URL 校验与
  yt-dlp 缺失识别的单测

### 测试
- 新增媒体类型推断、批量任务、download 包等测试，总计 109 例前端 + Go 5 例全绿

## [1.4.2] - 2026-09-06

### 新增：导出时间戳策略（按格式声明 + 用户可切换）
- 各格式声明时间戳策略：SRT/VTT 为 **required**（字幕规范必需，导出界面锁定并提示），
  TXT / Markdown 为 **optional**（用户可切换，各有默认值：TXT 关、MD 开）
- 导出预览 Modal 内置「包含时间戳」开关：切换即实时重生成预览内容
  （TXT 加 `[m:ss → m:ss]` 行前缀；Markdown 在时间表格与纯列表间切换）
- `buildExport` 新增 options 透传，命令面板导出使用各格式默认值
- 修复：i18n 重复键（export 对象误插 workspace 层级）

## [1.4.1] - 2026-09-06

### 修复：链接导入的 B站适配（实测驱动的三连修复）

B站链接 → 文本完整链路（链接导入 → 下载 → 转写）实测排障记录：

- **WAF 412 之一**：B站反爬要求请求携带 buvid3 等匿名 cookie。修复：检测到 B站链接时，
  下载器自动访问 B站首页收集 Set-Cookie 并写成 Netscape 格式 jar 传给 yt-dlp
  （TTL 缓存 7 天，非 B站链接零开销）
- **WAF 412 之二**：不能用 Go cookiejar.Cookies() 的返回值写文件——host-only cookie
  的 Domain/Path 为空，yt-dlp 加载不到。修复：直接解析 Set-Cookie 原始头保留属性
- **WAF 412 之三**：Netscape 布尔字段必须大写 TRUE/FALSE 且与前导点一致
  （Python stdlib assert 校验），小写会加载失败。修复 + 格式单测
- **挑战令牌不可回放**：首页下发的 X-BILI-SEC-TOKEN 绑定采集时的 TLS 指纹/IP，
  回放给 yt-dlp 反而触发 412 —— 过滤 X- 前缀令牌后单文件即成功解析视频
- **风控错误可操作化**：B站对同 IP 高频访问会临时标记（实测连续尝试后 412），
  错误映射为「风控拦截，稍后重试或登录导出 cookie」的可操作提示
- 已验证：自动 cookie + 过滤后，yt-dlp 成功解析 B站视频标题与时长；
  高频测试触发 IP 风控为预期边界，稍后重试即可

## [1.3.4] - 2026-09-06

### 安全修复
- **本地流媒体服务未鉴权（中危）**：`GetVideoStreamURL` 起的 127.0.0.1 随机端口 HTTP 服务
  无任何校验——本机任意进程可直接读取正在播放的视频文件；DNS rebinding 下的恶意网页同样
  可以跨源读取（同源策略对 rebinding 后的"同源"请求失效）。修复：服务启动时生成 128bit
  随机令牌，流地址携带 `?t=`，处理器强校验（无令牌/错令牌 → 403）。新增 Go 安全回归测试
  （无令牌/错令牌/正确令牌三断言）防回归
- **降级路径可观测性补齐**：`saveVideoFile` 的配额降级此前静默吞错，补 console.warn
  （与 saveTask 的降级留痕对齐——凡是静默降级必须有可观测出口）
- 安全扫描：确认无 v-html / innerHTML / eval / new Function / 裸 target=_blank /
  console.log 泄漏面；API Key 不出现在任何日志与 URL

## [1.3.3] - 2026-09-06

### 修复：逻辑排查（生命周期 / 队列 / 命令面板 / 虚拟列表）
- **历史页「打开」无反馈**：只改内部选中态不跳转，用户停留在原页面。修复：选中并回到工作台
- **命令面板哑命令**：无字幕时导出命令仍显示、按 Enter 静默无效果。修复：无字幕不注册导出
  命令（命令注册表本就响应式，随任务状态自动增删）
- **虚拟列表视口测量过期**：只在挂载/滚动时测量，窗口 resize 后可视行数计算错误。修复：
  ResizeObserver 跟踪容器尺寸（无该 API 的测试环境自动跳过）
- **阶段指示器闪烁**：pump 在引擎启动前预写 extracting，whisper 引擎随即改报 downloading，
  开头出现假跳变。修复：移除预写，起始阶段由各引擎自行上报
- 全量验证 105 例测试 / lint / tsc / 构建 / Go 编译全绿，浏览器行为验收通过

## [1.3.2] - 2026-09-06

### 修复：本地模型与 API 引擎的跨端兼容性（系统审计）

四条引擎路径（mock / whisper-local / siliconflow / wails）的兼容性矩阵审计结论与修复：

- **模型参数透传断裂（桌面端）**：Go 侧 `TranscribeWithAPI` 硬编码模型名与 URL，桌面壳里
  前端设置的"模型"完全不生效。修复：Go 签名改为 `TranscribeWithAPI(apiKey, model, audioPath)`
  并由 wails 引擎透传 `settings.model`（与 web 端 siliconflow 引擎同一参数来源）；
  `wailsjs` 绑定声明同步更新
- **桌面端 SiliconFlow 选项必挂**：桌面壳内没有 `File` 对象，siliconflow 引擎（浏览器路径）
  在桌面必然 NO_FILE。该服务在桌面由 wails 引擎经 Go 直连覆盖（无 CORS），故 siliconflow
  标记为 web-only：桌面下拉禁用并显示 "· Web" 后缀，误选时回退而非报错
- **桌面端取消无效**：wails 引擎完全忽略 AbortSignal——取消按钮点了没反应，且引擎 Promise
  挂在 Go 调用上会阻塞任务队列。修复：`Promise.race` 让取消立即生效（Go 调用后台自然结束、
  结果丢弃），阶段边界再做 AbortSignal 检查
- 新增 5 个桌面平台 mock 测试（模型透传 / 预中止零调用 / 运行中取消 / siliconflow web-only
  标记 / 显式选择回退），总计 105 例全绿

## [1.3.1] - 2026-09-06

### 新增：任务标签页 + 本地模型方案补全
- **任务标签页**：工作台顶部任务切换条（浏览器标签隐喻）——平行四边形 Persona 样式、
  状态圆点（运行中脉冲/完成绿/失败红）、关闭即删除（有字幕先确认）、与 `?task=` URL 双向同步；
  附 4 个组件测试（渲染/切换/关闭确认分支）
- **WebGPU 推理**：计算后端 auto——WebGPU 可用时优先（官方可靠配方：fp32 编码器 + q4 解码器），
  失败逐级回退 WASM q8；实际使用的后端回显到任务状态行与设置页说明
- 实测：同一段音频在 WebGPU 路径转写质量优于 WASM q8（大小写/标点更准），真实时间戳保持
- 修复：引擎 report 回调在 message 为 undefined 时也会抹掉早前上报的信息（后端标签消失）

### 测试
- 新增 TaskTabs 4 例 + 后端回显浏览器验收，总计 100 例全绿

## [1.3.0] - 2026-09-06

### 变更：视觉语言整体置换为「Punk Red」（女神异闻录风格）
- 应用户要求参考 anthropics/frontend-design SKILL 重新设计：从题材（P5 的红黑漫画 UI）提取完整形状语言，而非仅更换主色
- **红黑白三色**：主色 #e60012（浅色 #d90429），近黑中性阶；黄色 #ffd600 仅作装饰星点
- **形状语言**：按钮/导航/徽章平行四边形（skew + 内容反斜切）、激活态红底白字硬投影、页面标题斜切粗黑 + 红色斜杠下划线、进度条改分段能量条、阶段标记改菱形、空态改 clip-path 星形爆点、DropZone/About hero 加半调网点、播放器字幕条红色左缘 + 斜体
- 锐利半径体系（3/5/8/12px）替代大圆角；硬位移投影替代柔影
- 双主题（深/浅）完整适配；对比度、reduced-motion、键盘焦点底线保持
- favicon 同步重绘（红黑斜切 + 黄色星点）

## [1.2.1] - 2026-09-06

### 修复（对照 agent-skills/frontend-ui-engineering 审计 + 深度排雷）
- **IndexedDB 静默数据丢失（严重）**：`saveTask` 把含 Vue 响应式 Proxy 的记录直接交给
  `indexedDB.put`，结构化克隆抛 `DataCloneError` 且被降级逻辑吞掉 —— 创建之后的任何更新
  （阶段流转、识别结果、字幕编辑）从未真正落库。修复：入库前深转纯对象；新增直读 IndexedDB
  的回归测试（绕过内存兜底，验证真实落库内容）
- **启动竞态**：`init()` 尾部无条件覆盖 `currentId`，会踩掉装载期间用户做出的选择（快速点击
  视频 / `?task=` 恢复）；`initialized` 标志在记录装载完成前置位，导致依赖它的恢复逻辑读到空
  数组。修复：`init()` 改为共享 Promise（并发调用等待同一次装载）+ 仅在未选择时兜底
- **命令面板 Esc 只在输入框生效**：焦点移到结果列表后 Esc 失效。修复：面板级 window 监听 +
  卸载清理
- **字幕编辑按钮 aria-label 错用「确认」**；撤销/重做纯图标按钮补齐 aria-label

### 无障碍（WCAG 2.1 AA）
- 对话框焦点管理：`AppModal` / 命令面板打开时移焦进入、Tab 循环限制在面板内（`useFocusTrap`，
  核心逻辑纯函数可测）、关闭时焦点还原到触发元素
- 识别中的字幕区改用**骨架屏**（`aria-busy` + `role="status"`）替代静态空态文案；空态标记
  `role="status"`
- 提升浅色/深色主题 `text-faint` 对比度至 WCAG AA 正文要求（≥4.5:1）

### 新增
- **URL 状态**：当前任务写入 `?task=` 查询参数（状态管理阶梯第 4 级）—— 刷新可恢复、链接可
  分享，双向同步含非法值容错；附 4 个组件级路由测试

## [1.2.0] - 2026-09-06

### 新增：本地 Whisper 引擎（无需 API Key，数据不出设备）
- 新引擎 `whisper-local`：Transformers.js v3 + ONNX Runtime WASM 在**浏览器内**推理 Whisper（tiny/base/small 三档，40–250MB），权重下载一次经浏览器缓存复用；HF 主源失败自动切换 hf-mirror 镜像重试
- 推理运行在独立 Web Worker（`@huggingface/transformers` 打成 ~874KB 独立懒加载 chunk，主包零增量）；取消任务 = terminate Worker；模型加载阶段（downloading）加入五阶段流水线与加权进度
- Whisper `return_timestamps` 提供真实时间轴（`meta.timingEstimated = false`），字幕同步不再依赖估算
- 音频解码绕过 `AudioContext` 的硬件重采样：新增手写 16-bit PCM WAV 解析/编码器（`utils/wav.ts`，含往返/下混/格式校验测试）
- 设置页新增 本地模型档位 与 识别语言（自动/中文/英语）配置；工作台引擎下拉显示"本地 Whisper"
- 仓库附带 `frontend/public/e2e-test.mp4`（TTS 合成的 8 秒英文语音），供无视频时一键体验本地引擎

### 修复（真实 E2E 调出的漏洞）
- ffmpeg 类 Worker 在 Vite dev 下 404 导致 `load()` 无声挂起：改用 `?worker&url` 显式提供 `classWorkerURL`，并配置 `worker.format: 'es'`
- `@ffmpeg/util` toBlobURL 在 gzip/br 压缩传输下 content-length 对账失配、回退路径对已消费流二次读取：自实现流式下载器（只信实际字节数），并为核心加载增加 CDN 双源回退与 180s 超时
- ffmpeg 核心从 UMD 切换为 `/dist/esm/` 变体（module worker 中 UMD 无 default 导出）
- 本地引擎文件检查前置：演示任务/缺文件时不再白下载模型权重
- `@huggingface/transformers` 加入 `optimizeDeps.include`，消除 dev 首次使用时 re-optimize 引发的整页 reload 打断任务
- 引擎底层错误信息透传到任务记录与 toast（不再被 i18n 文案吞掉）；AppModal 卸载时清理全局 Esc 监听

### 测试
- 新增 12 例（WAV 编解码往返/立体声下混/非法格式、Whisper 时间戳映射、引擎可用性与解析、本地模型设置校验），总计 84 例全绿

## [1.1.0] - 2026-09-05

### 新增
- **⌘K 命令面板**：自实现子序列模糊搜索（连续/词首/跨度打分 + 命中高亮回填），响应式命令注册表（导航/任务/导出/外观），完整键盘导航；快捷键系统升级为支持 `mod+k`、`mod+shift+z` 组合语法与 `allowInInput` 豁免
- **字幕编辑撤销/重做**：每任务命令栈（整表快照，上限 50 步），新编辑落栈清空 redo 分支，任务删除时清理历史
- **语音统计面板**：字数/句段/语速/时间覆盖率 + 24 桶字符密度 SVG 分布图（零图表库，纯函数统计 `utils/stats.ts`）
- **播放器增强**：底部当前句大字幕条（与播放位置联动、渐入过渡）、0.5–2× 倍速控制
- **导出预览**：SRT/VTT/TXT/Markdown 生成内容先在对话框预览再下载；新增通用 `AppModal`
- **关于页 Bento 重设计**：非等距网格 + 实时数据（任务数/字幕数/总字数/总时长/当前引擎）

### 变更（视觉系统重构，参考 taste-skill 反模式清单）
- 主色从 indigo（典型"AI 紫"）切换为单一 emerald 强调色；中性色统一 zinc 阶，去除纯黑
- 自托管 Space Grotesk Variable 作为 display 字体（品牌/标题/数字），正文保留 CJK 系统栈
- 全部 emoji 替换为统一 24 viewBox / 1.8 描边的内置图标组件（新增 moon/sun/eye/undo/redo/gauge 等 10 枚）
- 动效令牌化：spring/out 两族缓动 × 三档时长，过渡只动 transform/opacity；新增路由切换、卡片交错入场、按钮 `:active` 触觉反馈、字幕条渐入、柱状图 scaleY 生长动画
- 全局 3.2% 细颗粒噪点纹理层（fixed + pointer-events:none）
- 整站响应 `prefers-reduced-motion`

### 测试
- 新增 20 例：模糊搜索（打分/排序/高亮切分）、语音统计（覆盖率/直方图/边界）、撤销重做（快照语义/redo 分支丢弃）；总计 72 例全绿

## [1.0.0] - 2026-09-05

### 前端（重大重构：从 Wails 模板页到独立可运行的完整工程）

#### 新增
- 平台适配层：同一套代码运行于浏览器与 Wails 桌面壳（选文件 / 播放 / 提取 / 网络差异全部收敛）
- 转写引擎抽象 `TranscriptionEngine`：离线演示（mock）、浏览器直连 SiliconFlow（ffmpeg.wasm 本地提取）、桌面壳（Go）三实现 + 策略解析器与自动降级
- 任务编排 store：单并发队列、两阶段加权进度（提取 0-40 / 识别 40-95）、AbortController 全链路取消、失败重试
- 播放器逐句同步：二分查找定位当前句、点击字幕跳转（token 化 seek）、跟随滚动、空格/方向键快捷键
- 字幕面板：固定行高虚拟列表、内容筛选、逐句编辑（防抖落库）、导出 SRT / VTT / TXT / Markdown、全文复制
- 持久化：IndexedDB 双 store（任务元数据 / 视频文件），隐私模式与超配额自动降级内存
- 视图：工作台 / 历史任务 / 设置 / 关于（路由懒加载 + 代码分割）
- 中英双语 i18n（`typeof` 同构约束防漏译）、深浅主题（CSS 变量 + data-theme）
- 手写图标组件、Toast、阶段指示器等通用组件
- 演示任务：零配置一键体验完整流水线
- 测试：Vitest 52 例（utils / composables / stores / 引擎解析 / i18n）
- 工程化：TypeScript strict、ESLint 9 flat config + Prettier、GitHub Actions CI
- 文档：ARCHITECTURE（分层与取舍）、INTERVIEW（面试亮点与 Q&A）、截图

#### 变更
- 前端从 JavaScript 迁移到 TypeScript strict；Vue 3.2 → 3.5，Vite 3 → 6
- 原单文件 HelloWorld.vue（366 行）拆分为 types/services/stores/composables/components 分层结构

### 桌面端（Go / Wails）
#### 新增
- `GetVideoStreamURL` 绑定：本地回环 HTTP 流服务播放本地视频，`http.ServeContent` 支持 Range 拖动进度条

#### 保留
- 原有 `SelectVideo` / `ConvertToAudio`（本地 FFmpeg 提取）/ `TranscribeAPI`（SiliconFlow SenseVoiceSmall）绑定与使用方式不变
