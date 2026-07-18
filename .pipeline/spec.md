# Spec: PromptOptimizer 本地可用 Desktop + Fork 可续开发

## OPEN QUESTIONS

无阻塞项。以下采用合理默认（Coder 按此执行，勿再追问）：

| 项 | 默认 |
|----|------|
| Node 版本 | 环境现为 Node **v24.16.0**；`package.json` engines 为 `^22.0.0` 且 `.npmrc` `engine-strict=true`。优先**不改 engines**；若 `pnpm` 脚本因 engines 拒绝执行，则**仅临时**用 `pnpm config set engine-strict false` 于本机或在命令前 `pnpm --config.engine-strict=false ...`，**禁止**为过 engines 联网装 Node22。 |
| 启动路径 | **优先离线生产路径**：Electron 直接加载已有 `packages/desktop/web-dist`（不设 `NODE_ENV=development`），避免依赖 Vite dev server 与额外端口。 |
| API | **不配置** `.env.local`、不调用真实模型；启动到主窗口 + 本地存储初始化即可判为可用。 |
| Git 推送 | **默认不 push / 不 commit**；仅配置 remote 与文档化推送步骤，等用户明确要求后再执行。 |
| 历史对齐 | 本地当前为 `main` + 2 个已有 commit + 大量未提交改动；fork 默认分支为 `develop`。**不 reset/rebase/clean**；用独立工作分支承载现状，push 策略见 §6。 |

---

## 1. 目标与非目标

### 目标

1. 在**现有 `node_modules` / 已装 Electron / 已有 dist** 条件下，把当前工作树做成**可本地启动的 Desktop 应用**。
2. 用户改动（IPC 领域拆分、流取消、AbortSignal 贯通、runtime/window/ipc 安全、core electron 子路径等）**全部保留**，仅修阻塞启动/测试的缺口。
3. 配置 Git remote 指向 `xvyimu/prompt-optimizer`（fork）与上游 `linshenkx/prompt-optimizer`，并写清**如何推到 fork 分支**（不自动 push）。
4. 给出可重复的验证命令（单测 + typecheck 子集 + Desktop 启动烟测）。

### 非目标

- 不 Docker、不联网 `pnpm install` / 不装新依赖。
- 不调用真实 LLM/图像 API；不做 e2e 全量、不做 release 签名/NSIS 发布必需项。
- 不 `git commit` / `push` / `merge` / `rebase` / `reset` / `clean`（除非用户后续明确要求）。
- 不改用户已改业务逻辑的意图；不为「完美对齐上游 develop」重写历史。
- 不实现新功能（仅让现有改动可运行、可验证、可挂 fork）。

---

## 2. 现状摘要（规划时已核实）

| 项 | 值 |
|----|-----|
| 工作根 | `C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop` |
| 本地分支 | `main`（2 commit；HEAD `2c1f4ba`） |
| remotes | **无**（`.git/config` 无 remote） |
| 未提交 | ~75 路径（M + ??），含 desktop IPC 拆分、core abort/signal、electron 入口等 |
| Fork | `https://github.com/xvyimu/prompt-optimizer` 已存在，`isFork: true`，parent `linshenkx/prompt-optimizer`，default branch **`develop`** |
| gh | 已登录 `xvyimu` |
| Node / pnpm | Node `v24.16.0`，pnpm `10.6.1` |
| 依赖 | 根 `node_modules`、`packages/desktop/node_modules/electron`、core workspace link **已存在** |
| dist | `packages/core/dist`、`ui/dist`、`web/dist`、`desktop/web-dist` **均存在** |
| 过期风险 | `packages/core/src/**` 时间戳（2026-07-18）**新于** `packages/core/dist`（2026-07-17 19:59）→ **必须先 rebuild core** 再跑 Desktop，否则 main 加载的 CJS 不含 abort 等改动 |
| 启动逻辑 | `packages/desktop/main.js`：`NODE_ENV=development` → `http://localhost:18181`；否则 → `web-dist/index.html` |
| 环境变量 | 无 `.env.local` / 无 `packages/desktop/.env`（符合「不调真实 API」） |

### 用户改动主轴（Coder 不得回退）

- Desktop：`main.js` 作 composition root；`config/ipc/*` 领域 handler；`stream-registry` + `owned-stream-runner`；`ipc-security` / `window-security` / `runtime-security`。
- Core：provider `AbortSignal`；`src/electron.ts` + package exports `./electron`；SDK lazy load 相关。
- 契约测试：`scripts/desktop-ipc-handlers.test.mjs`、`packages/desktop/config/*.test.js`、core `provider-cancellation` / `sdk-loaders` 单测。

---

## 3. 文件创建 / 修改

### 3.1 必须创建

| 路径 | 说明 |
|------|------|
| `.pipeline/spec.md` | 本文件（Planner 已写；Coder 可读更新「验证结果」附注，勿删 OPEN QUESTIONS 表） |
| `.pipeline/verify-notes.md` | **Coder 执行后**写：实际跑通的命令、失败项、Desktop 是否弹出主窗口。禁止写实现代码。 |

### 3.2 允许修改（仅当验证失败时最小修复）

| 路径 | 何时改 | 约束 |
|------|--------|------|
| `packages/core/**`（已改源） | rebuild 后单测/typecheck 失败 | 只修编译/类型/abort 契约缺口；不扩 scope |
| `packages/desktop/main.js` | 离线启动崩溃 | 保持 domain register 模式；参考现有 `register*IpcHandlers` 装配 |
| `packages/desktop/config/**` | 契约测试失败 | 与 `preload.js` channel 对齐；更新 `channel-manifest.js` 若增 channel |
| `packages/desktop/preload.js` | channel 与 main 不一致 | 与 `scripts/desktop-ipc-handlers.test.mjs` 契约一致 |
| `packages/core/package.json` exports / build scripts | electron 子路径缺失导致 UI/Desktop 解析失败 | 保持 `"."` + `"./electron"` 双入口 |
| `packages/ui/src/composables/system/useAppInitializer.ts` | Electron 动态 import `@prompt-optimizer/core/electron` 失败 | 跟现有 isRunningInElectron 分支，不改 Web 路径 |
| 根 `package.json` scripts | **仅**可增加可选本地脚本别名（如 `desktop:offline`），**禁止**删改既有 script 语义 | 新脚本必须用已有依赖 |

### 3.3 禁止修改 / 禁止操作

- **禁止** `git reset` / `clean -fd` / 覆盖或丢弃未提交文件。
- **禁止** `pnpm install`、改 `pnpm-lock.yaml`、新增 dependency。
- **禁止** 改 `docker/**` 作为交付路径（即使用户 tree 里有 docker 改动，也不作为本任务验证入口）。
- **禁止** 提交含密钥的 `.env.local`。
- **禁止** 在未获用户确认时 `git push`。

### 3.4 不要求改、仅参考

- `docs/architecture/electron-adapter-entrypoint.md`
- `docs/architecture/llm-sdk-lazy-loading.md`
- `env.local.example`（用户要真 API 时自拷；本任务不建 `.env.local`）

---

## 4. 接口 / 脚本 / 命令

### 4.1 本地可用：推荐顺序（Coder 默认）

在仓库根目录执行。全程 **cwd = 工作根**。不联网。

```text
# 0) 可选：若 pnpm 报 engines 不兼容
pnpm --config.engine-strict=false -F @prompt-optimizer/core build

# 1) 必做：core 源新于 dist，重建 CJS/ESM（electron 子路径一并产出）
pnpm -F @prompt-optimizer/core build
# 等价：pnpm run build:core

# 2) 契约 + 桌面配置单测（不启 GUI）
node --test scripts/desktop-ipc-handlers.test.mjs
pnpm -F @prompt-optimizer/desktop test

# 3) core 取消/加载相关单测（已有 fixture，不打外网）
pnpm -F @prompt-optimizer/core exec vitest run tests/unit/llm/provider-cancellation.test.ts tests/unit/llm/sdk-loaders.test.ts

# 4) typecheck core（源已改）
pnpm run typecheck:core

# 5) Desktop 离线启动（不设 NODE_ENV=development → loadFile web-dist）
pnpm -F @prompt-optimizer/desktop exec electron .
```

**成功标准（§5）**：步骤 2–4 退出码 0；步骤 5 进程存活且主窗口加载 `web-dist/index.html`（日志含 `Loading web app from:`，无 `Web dist not found`）。

### 4.2 可选：开发双进程（需要本地已有 web dev 能力）

仅当用户要热更新 UI 时：

```text
pnpm run dev:desktop
```

依赖：`packages/web` Vite 在 `18181`；`packages/desktop` `NODE_ENV=development`。若端口/构建失败，**回退 4.1**，不阻塞交付。

### 4.3 可选：打包可行性（不强制成功）

```text
# 仅检查 electron-builder 配置与文件清单是否指向现有路径；可 --dir 避免完整安装包
pnpm -F @prompt-optimizer/desktop exec electron-builder --dir --publish never
```

- 若缺 icon/签名/耗时长 → 记入 `verify-notes.md` 为「打包未验证」，**不**阻塞「可启动」交付。
- **不要** `build:desktop` 全链路除非 4.1 已绿且时间允许（会 rebuild web）。

### 4.4 若 web-dist 与 UI 改动严重不一致

仅当离线启动后**空白页/明显缺 UI 改动**且改动在 `packages/ui` 或 `packages/web`：

```text
pnpm run build:ui
pnpm -F @prompt-optimizer/desktop run build:web
```

使用已有 vite/依赖；失败则记录，仍以 core+desktop main 进程可起为准。

### 4.5 建议可选 script（非必须）

若 Coder 加根 `package.json` 脚本，仅允许：

```json
"desktop:offline": "pnpm -F @prompt-optimizer/desktop exec electron ."
```

### 4.6 关键运行时接口（已实现，Coder 保持契约）

**Stream 取消**

- Preload：`cancelStream(streamId)` → `ipcRenderer.invoke('stream-cancel', streamId)`
- Main：`stream-cancel` 经 secure IPC + `streamRegistry.cancel(sender, streamId)`
- Domain：`runOwnedStream(..., operation(handlers, signal))` 将同一 `AbortSignal` 传入 core service

**Core**

- LLM 请求选项含 `signal?: AbortSignal`（`packages/core/src/services/llm/types.ts`）
- 各 adapter 应在 abort 时停止/抛取消类错误（单测：`provider-cancellation.test.ts`）

**Electron 入口**

- `@prompt-optimizer/core`：浏览器域
- `@prompt-optimizer/core/electron`：renderer proxies（`packages/core/src/electron.ts`）
- UI：`useAppInitializer` 在 Electron 下动态 import 子路径

**IPC 装配模式（跟随）**

```js
// packages/desktop/main.js
registerLlmIpcHandlers({ ...deps });
registerPromptStreamIpcHandlers({ ...deps });
// ... 其余 register*IpcHandlers
```

新 handler 放 `packages/desktop/config/ipc/<domain>-handlers.js`，导出 `registerXxxIpcHandlers`，**不要**把大块逻辑塞回 `main.js`。

---

## 5. 边缘情况

| 场景 | 处理 |
|------|------|
| Node 24 vs engines `^22` | 用 `pnpm --config.engine-strict=false`；不改 lock、不装 Node |
| core dist 过期 | **先** `build:core`；Desktop `require('@prompt-optimizer/core')` 走 `dist/index.cjs` |
| 无 API key | 允许；设置页可显示未配置；连接测试失败不视为启动失败 |
| `web-dist` 缺失 | 错误日志已有；用 `desktop run build:web` 或复制 web dist；禁止 Docker |
| `NODE_ENV=development` 但 18181 未起 | 白屏；离线路径**不要**设 development |
| 流 cancel 非 owner / 重复 streamId | `stream-registry` 抛 `IPC_STREAM_*`；测试覆盖 |
| sender 销毁 | registry 观察 sender，清理 active streams |
| Windows 路径 | 全部命令在 PowerShell/Git Bash 均可；路径含空格时用引号；本仓库路径无空格 |
| 杀软/GPU | Electron 起不来时记日志路径：`%APPDATA%\PromptOptimizer\logs`（见 desktop package scripts `logs:view`） |
| 与上游历史 divergent | 不 force-push main 到 fork develop；用独立分支（§6） |
| 用户已有 dirty tree | 任何 git 操作前 `git status`；只 `remote add`/`fetch`/`branch` 不碰工作区文件 |

---

## 6. Git：Fork 远程与分支策略

### 6.1 一次性挂载 remote（允许执行）

```bash
cd "C:/Users/yuanjia/Documents/Codex/2026-07-17/dui/work/source-extract/prompt-optimizer-develop"

# 若已存在同名 remote 则跳过 add，改为 set-url
git remote add origin https://github.com/xvyimu/prompt-optimizer.git
git remote add upstream https://github.com/linshenkx/prompt-optimizer.git

git remote -v
git fetch origin
git fetch upstream
```

- `origin` → 用户 fork（推送目标）
- `upstream` → 只读跟踪上游（后续同步用；本任务不 merge）

### 6.2 分支命名（默认）

| 分支 | 用途 |
|------|------|
| 本地 `main` | 保持不动（含既有 2 commit + dirty） |
| 建议工作分支 `work/desktop-hardening` | **用户确认 commit 后**从当前 HEAD 创建：`git switch -c work/desktop-hardening` |
| fork `develop` | 上游默认线；**不要**用 force 覆盖 |
| 推送目标 | `origin work/desktop-hardening`（用户确认后） |

### 6.3 推送步骤（文档 only；Coder 默认不执行 push/commit）

用户确认后建议：

```bash
# 1. 用户或经确认的会话：暂存并提交（勿用 --no-verify 除非用户要求）
git status
git add -A   # 再检查无 .env.local / 密钥
git commit -m "feat(desktop): ipc domain split, stream cancel, provider abort signal"

# 2. 建分支（若还在 main）
git switch -c work/desktop-hardening

# 3. 推送到 fork（需用户明确说 push）
git push -u origin work/desktop-hardening
```

若 `git push` 被拒（non-fast-forward）：

- **禁止** `--force` 到 `develop` / `main`
- 可对**个人工作分支**在用户确认后 `git push --force-with-lease origin work/desktop-hardening`
- 或开 PR：`gh pr create --repo xvyimu/prompt-optimizer --base develop --head work/desktop-hardening`

### 6.4 与上游对齐（本任务不做，仅记录）

```bash
git fetch upstream
# 以后：git merge upstream/develop 或 rebase（用户决定）
```

当前本地历史可能**不等于** fork/upstream 的 `develop` tip；首次 push 用独立分支最安全。

---

## 7. 跟随的现有模式（复制源）

| 模式 | 参考文件 |
|------|----------|
| Desktop composition root + 领域 IPC 注册 | `packages/desktop/main.js`（`registerLlmIpcHandlers` 等） |
| Secure IPC 包装 | `packages/desktop/config/ipc-security.js` |
| 流注册表 / 所有权取消 | `packages/desktop/config/stream-registry.js` |
| 流执行器（signal 贯通） | `packages/desktop/config/ipc/owned-stream-runner.js` |
| LLM 领域 handler | `packages/desktop/config/ipc/llm-handlers.js` |
| Channel 清单 | `packages/desktop/config/ipc/channel-manifest.js` |
| Preload ↔ Main 契约测试 | `scripts/desktop-ipc-handlers.test.mjs` |
| Desktop 配置单测风格 | `packages/desktop/config/stream-registry.test.js`、`ipc-security.test.js` |
| Core electron 子路径 | `packages/core/src/electron.ts` + `packages/core/package.json` `exports["./electron"]` |
| UI Electron 初始化 | `packages/ui/src/composables/system/useAppInitializer.ts` |
| Abort 类型与 adapter | `packages/core/src/services/llm/types.ts`、各 `adapters/*-adapter.ts` |
| 架构说明 | `docs/architecture/electron-adapter-entrypoint.md` |
| monorepo 脚本编排 | 根 `package.json` `scripts` + `scripts/run-many.js` |
| 环境变量加载顺序 | `packages/desktop/README.md` / `README-env-config.md` |

---

## 8. 验证方式（Coder / Tester 共用）

### 8.1 必过

1. `pnpm -F @prompt-optimizer/core build` 成功，且存在：
   - `packages/core/dist/index.cjs`
   - `packages/core/dist/electron.cjs`（或 package exports 指向的 electron 产物）
2. `node --test scripts/desktop-ipc-handlers.test.mjs` 退出 0  
   - 覆盖：preload channel 均有 main handler；`stream-cancel`；main 委托 domain modules
3. `pnpm -F @prompt-optimizer/desktop test` 退出 0
4. `pnpm -F @prompt-optimizer/core exec vitest run tests/unit/llm/provider-cancellation.test.ts tests/unit/llm/sdk-loaders.test.ts` 退出 0
5. `pnpm run typecheck:core` 退出 0
6. Desktop 离线启动：
   - 命令：`pnpm -F @prompt-optimizer/desktop exec electron .`
   - 预期：无 `Web dist not found`；窗口打开；主进程日志可见服务初始化（无 uncaughtException 闪退）
   - 验证后可正常退出进程

### 8.2 建议（失败不阻塞「可启动」）

- `pnpm run typecheck:ui`（若 UI 改动导致类型错再修）
- `pnpm run test:repo` 中与 desktop IPC 相关子集（已含在 8.1.2）
- `electron-builder --dir` 可行性

### 8.3 明确不做

- Playwright e2e / 真实 API 优化请求
- Docker compose
- 全量 `pnpm test`（过慢且可能触网）

---

## 9. Coder 执行清单（有序）

1. 确认 cwd 为工作根；`git status` 备份认知（不 clean）。
2. `git remote -v`；缺失则按 §6.1 添加 `origin`/`upstream` 并 `fetch`（fetch 需网络；**仅 git 元数据**，非 pnpm install）。若用户环境禁网导致 fetch 失败：仍可 `remote add`，记入 notes，不阻塞本地启动。
3. Rebuild core（§4.1 步骤 1）。
4. 跑 §8.1 测试；失败则**最小修复**后重跑，禁止大范围重构。
5. 离线启动 Desktop；记录结果到 `.pipeline/verify-notes.md`。
6. **停止**：不 commit、不 push。在 notes 写上用户一键 push 命令（§6.3）。

---

## 10. 交付定义（DoD）

- [ ] Desktop 可在无新依赖、无 Docker、无真实 API 下本地启动并显示主界面  
- [ ] core dist 与当前 src 同步（含 abort / electron 入口）  
- [ ] IPC 契约测试 + desktop config 测试 + provider-cancellation 通过  
- [ ] `typecheck:core` 通过  
- [ ] 用户改动文件均保留  
- [ ] `origin`/`upstream` 已配置（或 notes 说明 fetch 因网络未完成）  
- [ ] `.pipeline/verify-notes.md` 含实跑命令与结果  
- [ ] 无擅自 commit/push  

---

## 11. 关键绝对路径

- 仓库根：`C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop`
- Spec：`...\prompt-optimizer-develop\.pipeline\spec.md`
- Desktop 入口：`...\packages\desktop\main.js`
- 离线 UI：`...\packages\desktop\web-dist\index.html`
- Core 入口产物：`...\packages\core\dist\index.cjs`
- Fork：`https://github.com/xvyimu/prompt-optimizer`
- Upstream：`https://github.com/linshenkx/prompt-optimizer`
