# 测试方案重新设计 - 架构说明

## 目标

把“必须手工看控制台才能发现的 UI 错误”变成**自动化可拦截、可复现、可门禁**的测试失败。

约束：

- 门禁执行时间 < 10 分钟
- 默认离线可跑（CI 不依赖真实 API Key）
- 只在显式命令下访问真实 LLM API（避免意外费用）

## 测试分层

1) **core 单元/集成（Vitest）**

- 覆盖：VCR、LLM mock、流式处理等“可纯函数化/可模拟”的逻辑层能力
- 目标：快速、稳定、可在 CI 强制回放（`VCR_MODE=replay`）

2) **ui 单元/集成（Vitest + Vue Test Utils）**

- 覆盖：组合式逻辑（composables）、store 与 UI 之间的数据流、关键交互
- 关键门禁：任何 `console.error/warn`、`unhandledrejection`、`window error` 都应 fail 测试

3) **浏览器 E2E（Playwright）**

- 覆盖：真实浏览器下的启动、路由、关键对话框/操作流程
- 关键门禁：任何 `pageerror`、`console error/warn` 都应 fail 测试
- 运行策略：门禁只跑小集合（回归/冒烟）；全量 E2E 可放到 CI/nightly

## UI 错误拦截门禁

### Vitest（ui）

- 文件：`packages/ui/tests/utils/error-detection.ts`
- 在 `packages/ui/tests/setup.ts` 中启用：
  - 包装 `console.error` / `console.warn`：默认 fail（支持 ignore patterns）
  - 监听 `window.onerror` / `unhandledrejection`：默认 fail

### Playwright（E2E）

- 文件：`tests/e2e/fixtures.ts`
- 统一从 `./fixtures` 导出 `{ test, expect }`：
  - 监听 `page.on('pageerror')`
  - 监听 `page.on('console')` 的 error/warn
  - 默认 fail（支持 ignore patterns）

## VCR（LLM 录制/回放）

### 目标

让“依赖外部 LLM 服务”的测试在 CI 中**强制离线**（replay），并在需要时可录制更新 fixtures（record）。

### 机制

- `packages/core/tests/utils/vcr.ts`：VCR 模式与 fixtures 读写
  - `VCR_MODE=record|replay|auto|off`
  - `ENABLE_REAL_LLM=true` / `RUN_REAL_API=1` 控制是否允许真实 API
- `packages/core/tests/utils/llm-mock-service.ts`：MSW handlers（Node 侧拦截）
- `packages/core/tests/setup.js`：在 core 测试中按环境变量决定是否启用 MSW

### 推荐策略

- CI：`pnpm test:replay`（严格、不可访问网络）
- 本地日常：`pnpm test:replay` 或 `pnpm test`
- 需要更新 fixtures：`pnpm test:record`（显式启用真实 API）

## 门禁（Phase 5）

门禁脚本的目标是：

- 足够快（<10 分钟）
- 足够强（能拦截 UI 控制台错误、未捕获异常、关键回归）

推荐拆分：

- `pnpm test:gate`：pre-commit 运行的 fast gate
- `pnpm test:gate:full`：CI 或本地手动运行（含 E2E/视觉回归等更重的用例）

