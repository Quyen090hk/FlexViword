# FlexViword 前端

视频转文字工作台的前端部分。可完全独立运行于浏览器（`npm run dev`，零配置演示模式），也可作为 Wails 桌面壳的 UI 层（`wails dev`，在仓库根目录执行）。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173
```

浏览器模式下识别请求默认走 `/api/siliconflow` 开发代理（见 `vite.config.ts` 的 `server.proxy`，转发到 `api.siliconflow.cn`），规避 CORS。

## 命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run build:only` | 仅构建（CI 中 type-check 已单独跑） |
| `npm test` / `npm run test:watch` | Vitest 单元测试 |
| `npm run type-check` | vue-tsc 严格类型检查 |
| `npm run lint:check` / `npm run lint` | ESLint 检查 / 自动修复 |
| `npm run format` | Prettier 格式化 |

## 结构速览

```
src/
├── types/        领域模型与设置类型
├── utils/        纯函数（时间码/断句/导出/取消）
├── services/     bridge（平台适配）· engines（三种转写引擎）· audio（ffmpeg.wasm）· db（IndexedDB）
├── stores/       Pinia：tasks（编排）/ settings / player / ui
├── composables/  useVirtualList / useActiveSegment / useVideoSource / useHotkeys
├── components/   common / layout / workspace
├── views/        路由视图（懒加载）
└── i18n/         微型 i18n（zh-CN / en-US）
```

详细架构与设计取舍见仓库根目录 `docs/ARCHITECTURE.md`；面试视角讲解见 `docs/INTERVIEW.md`。

## 与桌面壳的关系

- `wailsjs/` 是 Wails 生成的绑定目录（已从 lint/构建中排除），运行时从 `window.go` 读取，纯浏览器构建不携带桌面代码
- 浏览器中检测 `window.go && window.runtime` 判定宿主；差异只存在于 `services/bridge` 之下
