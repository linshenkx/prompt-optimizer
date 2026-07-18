# Test Results（2026-07-18 Ship Phase 3）

工作根：`C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop`

## 结论

**PASS** — 本阶段约定范围内全部复测通过；无产品代码修改。

## 环境核对

| 检查 | 结果 |
|------|------|
| 分支 | `work/desktop-hardening` |
| origin | `https://github.com/xvyimu/prompt-optimizer.git` |
| upstream | `https://github.com/linshenkx/prompt-optimizer.git` |
| `packages/core/dist/index.cjs` | 存在 |
| `packages/core/dist/electron.cjs` | 存在 |
| `packages/desktop/web-dist/index.html` | 存在 |
| Electron binary | 存在（41.1.0） |

## 复跑命令

### 1. Desktop IPC 契约

```text
node --test scripts/desktop-ipc-handlers.test.mjs
```

| 结果 | 10 pass / 0 fail |
|------|------------------|
| 时长 | ~382ms |

### 2. Desktop config 单测

```text
node --test packages/desktop/config/*.test.js
```

| 结果 | 52 pass / 0 fail |
|------|------------------|
| 时长 | ~400ms |

覆盖：IPC domain handlers、stream 取消/所有权、preload AbortSignal、sender 信任、runtime 配置白名单、WebDAV 路径、导航守卫等。

### 3. Core 相关单测

```text
node ./packages/core/node_modules/vitest/vitest.mjs run \
  packages/core/tests/unit/llm/provider-cancellation.test.ts \
  packages/core/tests/unit/llm/sdk-loaders.test.ts \
  packages/core/tests/unit/prompt-service-enhanced.test.ts
```

| 结果 | 3 files / 28 tests pass |
|------|-------------------------|
| 时长 | ~574ms |

### 4. Core typecheck

```text
node ./packages/core/node_modules/typescript/bin/tsc -p packages/core/tsconfig.json --noEmit
```

| 结果 | exit 0 |
|------|--------|

### 5. Desktop 烟测（来自 verify-notes，本阶段复核记录）

- `NODE_ENV=production` + electron 加载 `web-dist`
- 进程运行 ≥6s 未秒崩；stderr 空
- 未测真实模型 API（spec 非目标）

## 未覆盖（明确范围外）

- 全量 Core/UI vitest
- `vue-tsc`
- Desktop package / NSIS
- 真实供应商流式请求
- git commit/push

## 失败项

无。
