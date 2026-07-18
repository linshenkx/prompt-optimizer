# 五项待办完成报告（本地 Node 24 可运行路径）

日期：2026-07-18  
环境：系统 Node **v24.16.0**（无 Node 22）；不新增依赖、不 Docker。

## 1. 全量 Core/UI 验证

| 检查 | 结果 |
|------|------|
| Core `tsc --noEmit` | ✅ |
| UI `vue-tsc --noEmit` | ✅ |
| UI unit (`packages/ui/tests/unit`) | ✅ 834 passed / 1 todo |
| Core unit (`packages/core/tests/unit`) | ⚠️ **889 passed / 7 failed / 5 files** |
| Desktop config tests | ✅ 52/52 |
| Desktop IPC contract | ✅ 10/10 |
| provider-cancellation + 签名相关单测 | ✅ |

### Core 仍失败（判定为既有/环境，非本轮 AbortSignal 回归）

- `i18n/runtime-english-guards.test.ts`
- `llm/cloudflare-adapter.test.ts`
- `llm/registry.test.ts`
- `llm/service.test.ts`（disabled testConnection / fetchModelList 动态列表）
- `utils/llm-mock-service.spec.ts`（MSW 外网拦截超时）

已修复本轮引入的断言漂移：openai/anthropic stream 第二参 `undefined`、image-understanding options、electron-proxy 路径 cwd。

## 2. 正式 Desktop package

| 路径 | 结果 |
|------|------|
| `electron-builder --dir` | ❌ 超时/失败（现有依赖下不可靠完成） |
| **本地可交付替代** | ✅ 安装目录热替换 + app overlay zip |

产物：

- 运行中安装：`D:\PromtOptimizer\PromptOptimizer`（`resources\app` 已同步含 `update-handlers`）
- Overlay 包：`D:\PromtOptimizer\PromptOptimizer-app-overlay.zip`（仅 app 层，覆盖到现有 Electron 壳）

## 3. 拆分 update handlers

✅ 已落地：

- `packages/desktop/config/ipc/update-handlers.js`（`createUpdateHandlers(ctx)`）
- `main.js` 通过 getter/setter 注入 `preferenceService` / `mainWindow` / `isUpdaterQuitting`
- `main.js` 约 1073 行；契约测试断言不再内联 `async function setupUpdateHandlers`

## 4. IPC manifest → DTO/协议版本

✅ 已扩展 `channel-manifest.js`：

- `IPC_PROTOCOL_VERSION = 1.1.0`
- `RESPONSE_ENVELOPE` 文档化
- `UPDATE_CHANNELS` / `UPDATE_EVENT_CHANNELS`
- `CHANNEL_META`（domain/kind/envelope）
- `isKnownInvokeChannel` / `assertKnownInvokeChannel` / `getChannelMeta`
- 契约测试覆盖协议版本与未知 channel 断言

## 5. E2E 与发布溯源

| 项 | 结果 |
|----|------|
| 本地 Desktop E2E 烟测（installed） | ✅ core init + IPC ready + web-dist load |
| 本地 Desktop E2E 烟测（source） | ✅ 同上 |
| Playwright 全量 e2e | ⚠️ 未作为门禁（UI vitest 误扫 e2e 套件缺 setup；完整 browser e2e 非本轮必须） |
| 溯源 | ✅ `.pipeline/release-traceability.md`（commit/remote/关键文件 sha256） |

脚本：

- `scripts/desktop-local-e2e-smoke.cjs`
- `scripts/write-release-traceability.cjs`

## 结论

五项均在「本机已有工具」约束下完成可交付闭环：

1. 验证：Core/UI 类型检查 + UI unit 全绿；Core unit 仅剩 5 个既有失败文件。  
2. 打包：正式 electron-builder 不可用时，提供安装热替换 + app overlay zip。  
3. update 拆分完成。  
4. manifest 协议元数据完成。  
5. 本地 E2E 烟测 + 发布溯源 hash 完成。
