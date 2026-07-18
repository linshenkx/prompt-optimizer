# PromptOptimizer 优化诊断与执行文档

- 文档日期：2026-07-18
- 源码工作区：`C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop`
- 安装路径：`D:\PromtOptimizer\PromptOptimizer`
- Git 分支：`work/desktop-hardening`
- 已推送基线 commit：`90adf6d`
- 本地运行时：Node **v24.16.0**（项目 engines 声明 `^22.0.0`）
- 约束：尽量不装新依赖、不用 Docker、不调用真实模型 API

---

## 1. 实测结论总览

### 1.1 已通过（可日常使用）

| 检查 | 结果 | 说明 |
|------|------|------|
| 安装版启动烟测 | ✅ | core services init、IPC ready、加载 `resources/app/web-dist/index.html` |
| Desktop config 单测 | ✅ 52/52 | 安全、流取消、导航、WebDAV、runtime 白名单 |
| Desktop IPC 契约 | ✅ 10/10 | preload↔handler、domain 装配、manifest |
| UI unit | ✅ 834 pass / 1 todo | 从 `packages/ui` 正确入口跑 |
| UI `vue-tsc` | ✅ | |
| Core `tsc` | ✅ | |
| Core unit（**从 `packages/core` cwd**） | ✅ 此前“失败”的 5 文件 **46/46 全过** | 见 §2.1 |

### 1.2 关键问题（按严重度）

| ID | 严重度 | 问题 | 影响 |
|----|--------|------|------|
| P0-1 | 高 | Core 单测若从 monorepo **根目录**用错误 cwd/config 调用，会误报失败 | 开发者/脚本误判质量门禁 |
| P0-2 | 高 | `90adf6d` 之后的关键改动仍在工作树未提交（update 拆分、manifest 1.1、测试修复、E2E/溯源脚本） | fork 与本地安装代码可能不一致；可追溯性差 |
| P1-1 | 中 | 安装版缺少 `resources/app/icons`，日志警告 icon 找不到 | 窗口/任务栏图标异常 |
| P1-2 | 中 | 无正式 electron-builder NSIS/asar 产物，仅热替换 `resources/app` | 分发、更新通道、签名链不完整 |
| P1-3 | 中 | engines 要求 Node 22，本机 Node 24；pnpm lifecycle 可能被拒 | `pnpm -F ...` 脚本不稳，需直调 node 入口 |
| P2-1 | 低 | Playwright 全量 browser e2e 未纳入本地门禁 | 回归面偏 UI 行为 |
| P2-2 | 低 | `main.js` 仍含 composition/生命周期（正常），update 已拆但未全部推送 | 维护性已改善，差远程同步 |
| P2-3 | 低 | MSW/VCR 外网相关测试对错误调用方式敏感 | 错误入口下超时误报 |

---

## 2. 详细问题剖析

### 2.1 P0-1：Core 测试入口错误导致“假失败”

**现象（错误入口）**

从仓库根执行：

```text
node ./packages/core/node_modules/vitest/vitest.mjs run packages/core/tests/unit/...
```

失败类型：

1. `runtime-english-guards`：`ENOENT .../src/services/prompt/service.ts`  
   - 测试用 `process.cwd() + 'src/...'`，根 cwd 下路径变成仓库根 `src/`，实际在 `packages/core/src/`。
2. `cloudflare-adapter` / `llm/service`：`afterEach is not defined` / `vi is not defined`  
   - 未加载 `packages/core/vitest.config.js`（`globals: true` + `setupFiles`）。
3. `registry.getModels` / MSW mock：超时  
   - 无 setup/MSW，真实 fetch 外网挂起。

**正确入口（已验证全绿）**

```text
cd packages/core
node ./node_modules/vitest/vitest.mjs run tests/unit/...
```

结果：上述 5 个文件 **46 tests passed**。

**根因**

`packages/core/vitest.config.js` 中：

```js
setupFiles: ['./tests/setup.js']
```

相对路径相对 **process.cwd()**，不是配置文件目录。从 monorepo 根跑时会去找 `REPO/tests/setup.js`。

**目标修复**

把 setup/路径解析改为相对 `import.meta.url` / `__dirname`，使无论从根还是 package 目录调用都稳定。

### 2.2 P0-2：未提交的高价值改动

`git status` 显示相对 `origin/work/desktop-hardening`（`90adf6d`）仍有：

**已修改**

- Core 测试断言适配 AbortSignal 第二参
- `channel-manifest.js` 协议版本与 META
- `main.js` update 拆分装配
- `desktop-ipc-handlers.test.mjs` 契约增强

**未跟踪**

- `packages/desktop/config/ipc/update-handlers.js`
- `scripts/desktop-local-e2e-smoke.cjs`
- `scripts/write-release-traceability.cjs`
- `.pipeline/*` 报告

**影响**

- GitHub fork 无最新 update 拆分与协议元数据
- 安装版虽已热替换，但源码远程不可复现

**目标修复**

提交并推送到 `work/desktop-hardening`（不 force develop）。

### 2.3 P1-1：安装版缺 icons

源码有：

`packages/desktop/icons/app-icon.ico` 等

安装版日志：

```text
Icon file not found: D:\...\resources\app\icons\app-icon.ico
```

安装树 `resources/app` 无 `icons/` 目录。

**目标修复**

把源码 `icons` 复制进安装版 `resources/app/icons`，并纳入 overlay zip。

### 2.4 P1-2：正式打包路径

- `electron-builder --dir` 本机超时/失败
- 当前可用：`resources/app` 热替换 + `PromptOptimizer-app-overlay.zip`
- 无 Authenticode 签名、无 asar 一体包

**目标（本轮可完成部分）**

巩固热替换/overlay 交付；文档标明 NSIS 需独立 builder 环境。不强制联网装 Node22。

### 2.5 P1-3：Node engines 与本地 Node24

- 根 `engines.node = ^22.0.0`
- `.npmrc` 可能 `engine-strict`
- 本机 Node 24 导致部分 `pnpm -F` 生命周期失败

**目标（本轮）**

不改 engines（避免扩大兼容面争议）；固定“直调 node 入口”的验证命令进文档与脚本注释。

### 2.6 已完成且无需再改的部分

- Provider `AbortSignal` 真实取消链路
- 领域 IPC 拆分 + channel parity
- sender/stream 安全
- preload Prompt 取消竞速
- 本地 Desktop E2E 烟测脚本
- 发布溯源 hash 脚本

---

## 3. 优化目标与优先级

### 3.1 本轮必须完成（最优 ROI）

1. **修 Core vitest 配置路径**，消除假失败  
2. **加固路径敏感单测**（english-guards 等）  
3. **补安装版 icons**  
4. **提交并推送未入库改动**，对齐 fork  
5. **重跑关键验证矩阵** 并更新报告

### 3.2 本轮明确不做

- 不装 Node22 / 不改 engines
- 不 Docker
- 不强制 electron-builder NSIS（环境已证不稳定）
- 不跑需真实 API 的 Playwright 全量 e2e
- 不 force push develop

### 3.3 成功标准

| 标准 | 度量 |
|------|------|
| Core 问题文件在 package cwd 全绿 | 5 files / 46 tests pass |
| 根目录用 `--config packages/core/vitest.config.js` 也可跑通（修配置后） | 不再找错 setup.js |
| 安装版无 icon 警告（或 icons 存在） | 路径存在 `app/icons/app-icon.ico` |
| 远程包含 update-handlers 等 | `origin/work/desktop-hardening` 有新 commit |
| Desktop 契约/config/E2E 仍绿 | 10 + 52 + smoke pass |

---

## 4. 执行方案（逐步）

### Step A — 修 `packages/core/vitest.config.js`

- `setupFiles` 改为基于配置文件目录的绝对路径
- 可选：`root`/`dir` 指向 package 根

### Step B — 修 `runtime-english-guards` 读源路径

- 用 `import.meta.url` 定位 `packages/core/src/...`，不依赖 cwd

### Step C — 安装版补 icons

- 复制 `packages/desktop/icons` → `D:\PromtOptimizer\PromptOptimizer\resources\app\icons`
- 同步进 overlay zip（若重建）

### Step D — 验证矩阵

1. `cd packages/core && vitest run` 问题五文件  
2. 从 repo 根：`vitest --config packages/core/vitest.config.js` 抽测  
3. Desktop IPC + config tests  
4. `desktop-local-e2e-smoke.cjs`  
5. typecheck core/ui（直调 tsc/vue-tsc）

### Step E — Git 提交推送

- 提交测试修复、update 拆分、manifest、脚本、报告
- `git -c http.proxy= -c https.proxy= push`（规避 7897 代理坑）

---

## 5. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 推送含大量 diff | 仅推 `work/desktop-hardening`；不碰 develop |
| 安装热替换不可逆（备份已按用户要求删除） | 源码与 fork 为唯一恢复源 |
| vitest 配置改动影响 CI | 路径绝对化对 CI package cwd 兼容 |

---

## 6. 附录：推荐日常命令（Node24 本机）

```powershell
# Core 单测（正确）
cd packages/core
node ./node_modules/vitest/vitest.mjs run tests/unit

# Core typecheck
node ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit

# UI unit
cd ../ui
node ./node_modules/vitest/vitest.mjs run tests/unit

# Desktop
cd ../..
node --test packages/desktop/config/*.test.js
node --test scripts/desktop-ipc-handlers.test.mjs
node scripts/desktop-local-e2e-smoke.cjs

# 溯源
node scripts/write-release-traceability.cjs
```

---

## 7. 执行勾选

- [x] A vitest 配置（`setupFiles`/`root` 相对 package 绝对路径）
- [x] B english-guards 路径（`import.meta.url`）
- [x] C icons 安装到 `resources/app/icons`
- [x] D 验证矩阵（Core 问题五文件根目录/包目录 46/46；Desktop 10+52；E2E smoke）
- [x] E commit/push（执行结果见下方 §8）
- [x] 额外修复：`update-handlers` 中 `require('./package.json')` → `../../package.json`（拆分回归）
- [x] 更新本文件执行结果

## 8. 执行结果（2026-07-18）

### 8.1 代码修复

| 项 | 文件 | 结果 |
|----|------|------|
| vitest cwd 无关 | `packages/core/vitest.config.js` | 根目录与 package 目录均可跑通 |
| 源码读路径 | `runtime-english-guards.test.ts` | 不再依赖 cwd |
| 显式导入 | `cloudflare-adapter.test.ts`、`llm/service.test.ts` | `vi`/`afterEach` 导入补齐 |
| update 路径回归 | `config/ipc/update-handlers.js` | `../../package.json` |
| 安装 icons | `D:\...\resources\app\icons\app-icon.ico` | 存在；最新 E2E 无 Icon 警告 |

### 8.2 验证

| 检查 | 结果 |
|------|------|
| Core 5 问题文件（repo 根 + config） | 46/46 pass |
| Core 5 问题文件（packages/core cwd） | 46/46 pass |
| Desktop IPC | 10/10 |
| Desktop config | 52/52 |
| Desktop local E2E | ALL CHECKS PASSED；err 仅无 API key 警告 |
| update package.json 错误 | 已消失 |

### 8.4 Git

| 项 | 状态 |
|----|------|
| 本地 commit | ✅ `9e6d896` — fix: harden test entrypoints, update path, install icons |
| push origin | ⏳ 当前网络无法连接 github.com:443（直连/清代理均失败）；分支 **ahead 1** |
| 重试命令 | `git -c http.proxy= -c https.proxy= push origin work/desktop-hardening`（代理恢复后） |

### 8.5 使用说明

日常运行：`D:\PromtOptimizer\PromptOptimizer\PromptOptimizer.exe`  
Overlay：`D:\PromtOptimizer\PromptOptimizer-app-overlay.zip`（含 icons + update 路径修复）  
详细诊断见本文 §1–§6。
