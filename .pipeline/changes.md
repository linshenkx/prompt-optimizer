# Changes: PromptOptimizer 本地可用 Desktop + Fork 可续开发

## 范围说明

本阶段以 **验证与交付装配** 为主：用户既有大量未提交改动（IPC 领域拆分、AbortSignal 贯通、安全边界等）全部保留；Coder 只补齐 spec 要求的 build / remote / 验证交接，未做超 scope 重构。

## 本阶段执行动作

| 动作 | 结果 |
|------|------|
| rebuild `@prompt-optimizer/core` | 用根目录 `node_modules/tsup` 直接构建 `src/index.ts` + `src/electron.ts`（CJS/ESM/DTS 成功） |
| Git remote | `origin` → `https://github.com/xvyimu/prompt-optimizer.git`；`upstream` → `https://github.com/linshenkx/prompt-optimizer.git` |
| 工作分支 | 检出/使用 `work/desktop-hardening`（未 commit、未 push） |
| 契约测试 | desktop IPC 10/10；desktop config 52/52 |
| Core 单测 | provider-cancellation + sdk-loaders + prompt-service-enhanced：**28/28** |
| Core typecheck | `tsc --noEmit` 通过 |
| Desktop 烟测 | `NODE_ENV=production` 下 electron 进程 6s 保持 RUNNING，日志完成 console logger + dotenv 注入，无 stderr 崩溃；主动 Stop-Process |

## 用户既有改动（保留，本阶段未回退）

### Core
- `packages/core/src/services/llm/**`：AbortSignal / StreamRequestOptions 贯通 service、abstract adapter、OpenAI/Anthropic/Gemini/Chrome/Deepseek
- `packages/core/src/services/prompt/**`、`image-understanding/**`：流式 options 透传
- `packages/core/src/electron.ts` + package exports `./electron`
- 单测：`provider-cancellation.test.ts`、`sdk-loaders.test.ts` 等

### Desktop
- `main.js` composition root；`config/ipc/*-handlers.js` 领域拆分
- `stream-registry` / `owned-stream-runner` / `ipc-security` / `window-security` / `runtime-security`
- `preload.js` Prompt 流式 AbortSignal 竞速
- 契约：`scripts/desktop-ipc-handlers.test.mjs`、`config/*.test.js`、`channel-manifest.js`

## 未改动 / 明确不做

- 无 `pnpm install`、无 lock 变更、无 Docker
- 无 git commit / push / reset / clean
- 无真实模型 API / 无 `.env.local` 密钥
- 未拆 `setupUpdateHandlers`（与 autoUpdater 强耦合，spec 非目标）

## Tester 关注点

1. 复跑：`node --test scripts/desktop-ipc-handlers.test.mjs` 与 `packages/desktop/config/*.test.js`
2. 复跑 core：`provider-cancellation`、`sdk-loaders`、typecheck
3. 确认 `packages/core/dist/index.cjs` 与 `electron.cjs` 时间戳/存在性（rebuild 后）
4. 确认 git remote 指向 xvyimu fork + linshenkx upstream；分支 `work/desktop-hardening`
5. Desktop 启动：生产模式加载 `web-dist`，进程不应秒崩
6. 不要求真实 LLM 调用成功

## 推送到 fork 的文档步骤（默认不执行）

```text
# 在工作根，确认分支与 remote
git status -sb
git remote -v
# 用户确认后再：
# git add -A && git commit -m "..."
# git push -u origin work/desktop-hardening
```
