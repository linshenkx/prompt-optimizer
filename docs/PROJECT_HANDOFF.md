# PromptOptimizer 项目交接总册（PROJECT_HANDOFF）

> 单一真相入口。更新代码后优先改本文相关章节；安装侧见 `D:\PromtOptimizer\README.md`。

**最后更新：** 2026-07-18  
**产品版本：** Desktop 2.11.7（热替换构建）  
**维护分支：** `work/desktop-hardening`  
**Fork：** https://github.com/xvyimu/prompt-optimizer  
**上游：** https://github.com/linshenkx/prompt-optimizer（`upstream`，默认 `develop`）

---

## 0. 一分钟读懂

| 你想… | 去哪里 |
|--------|--------|
| 改代码 | 源码 worktree（见 §1.1） |
| 打开软件 | `D:\PromtOptimizer\PromptOptimizer\PromptOptimizer.exe` |
| 看本轮改了什么 | §2 + `.pipeline/` |
| 跑测试 | §5 |
| 推送到 GitHub | §6 |
| 清理垃圾 | §7 |
| 优化债务 | `.pipeline/OPTIMIZATION_PLAN.md` |

---

## 1. 目录与角色

### 1.1 源码工作区（真相源）

```
C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop\
├── packages/
│   ├── core/          # LLM/Prompt/模型领域；AbortSignal；electron 子路径
│   ├── desktop/       # Electron main/preload；config/ipc/* 领域拆分
│   ├── ui/            # Vue UI
│   ├── web/           # Web 入口（Desktop 用 web-dist）
│   ├── extension/     # 浏览器扩展
│   └── mcp-server/    # MCP
├── scripts/           # IPC 契约、e2e smoke、溯源
├── docs/              # 含本 HANDOFF
├── .pipeline/         # Ship/优化/验证过程文档
├── task_plan.md       # 当前整理任务计划
├── findings.md
└── progress.md
```

### 1.2 本机安装（日常运行）

```
D:\PromtOptimizer\
├── README.md                          # 安装侧入口（本整理新增）
├── PromptOptimizer\                   # 可执行安装树
│   ├── PromptOptimizer.exe
│   └── resources\
│       ├── app\                       # 热替换后的业务代码（无 app.asar）
│       │   ├── main.js
│       │   ├── preload.js
│       │   ├── remote-storage.js
│       │   ├── package.json
│       │   ├── config\                # 含 ipc/*、security、stream-registry
│       │   ├── icons\                 # app-icon.ico 等
│       │   ├── web-dist\
│       │   └── node_modules\@prompt-optimizer\core\dist\
│       ├── app-update.yml
│       └── elevate.exe
├── PromptOptimizer-app-overlay.zip    # 仅 app 层覆盖包
├── PROJECT_STATUS_REPORT.md           # 长审计/推进报告
├── overview.md                        # 短状态
├── audit\                             # 历史审计
└── custom-templates\                  # 用户模板数据（勿当代码删）
```

**重要：** 用户曾要求删除升级备份；本机**没有** pre-upgrade / asar.bak 回滚副本。恢复靠源码/fork。

### 1.3 远程 Git

| remote | URL | 用途 |
|--------|-----|------|
| origin | https://github.com/xvyimu/prompt-optimizer.git | 你的 fork |
| upstream | https://github.com/linshenkx/prompt-optimizer.git | 官方 |

- 开发分支：`work/desktop-hardening`
- 勿 force 推 `develop`/`main`
- 本机 git 可能配置 `http.proxy=http://127.0.0.1:7897`；代理挂了 push 失败时用：

```powershell
git -c http.proxy= -c https.proxy= push origin work/desktop-hardening
```

### 1.4 提交历史（关键）

| Commit | 说明 |
|--------|------|
| `90adf6d` | feat: IPC 拆分、stream cancel、provider abort（已 push 时） |
| `9e6d896` | fix: vitest 入口、update package.json 路径、icons 文档等（可能仅本地） |

以 `git log -3 --oneline` 为准。

---

## 2. 已交付能力（功能真相）

### 2.1 Provider 真实取消

- `StreamRequestOptions { signal?: AbortSignal }` 贯穿：
  - LLMService / PromptService / ImageUnderstanding
  - Desktop owned-stream-runner → Core
  - OpenAI / Anthropic / Gemini / Chrome / Deepseek adapters
- preload：LLM + Prompt 流式支持 signal → `stream-cancel` 竞速
- 测试：`packages/core/tests/unit/llm/provider-cancellation.test.ts` 等

### 2.2 Desktop IPC 领域拆分

`packages/desktop/config/ipc/`：

| 模块 | 职责 |
|------|------|
| llm-handlers / prompt-stream / prompt-sync | LLM 与 Prompt |
| model / image / template / history / context / favorite / data / preference / system | 各领域 |
| update-handlers | 自动更新（createUpdateHandlers(ctx)） |
| owned-stream-runner | 流所有权 + AbortSignal |
| channel-manifest | 协议版本 1.1.0 + CHANNEL_META + UPDATE channels |

`main.js`：composition root + 生命周期；update 通过 getter/setter 注入。

### 2.3 安全边界

- IPC sender / main-frame / streamId
- stream 所有权与取消
- runtime 公共配置白名单
- 外部导航限制
- WebDAV 路径校验
- preload listener 精确解绑

### 2.4 安装形态

- 加载路径：`resources/app`（**无** `app.asar`）
- 缺 API key 时仅警告，可启动
- icons 已补：`resources/app/icons/app-icon.ico`

---

## 3. 过程文档索引（.pipeline）

见 `.pipeline/INDEX.md`。要点：

| 文件 | 用途 |
|------|------|
| OPTIMIZATION_PLAN.md | **优化诊断与执行结果（最细）** |
| todos-completion-report.md | 五项待办完成报告 |
| release-traceability.md | commit/文件 sha256 |
| spec/changes/verify-notes/test-results/review | Ship 流水线交接 |
| PROJECT_HANDOFF.md | 本文（docs/ 下） |

---

## 4. 日常开发路径

### 4.1 改 Core / Desktop

1. 在源码 worktree 改  
2. Core rebuild（Node24 直调 tsup）：

```powershell
cd packages/core
node ../../node_modules/tsup/dist/cli-default.js src/index.ts src/electron.ts --format cjs,esm --dts
```

3. 同步安装版 app（热替换）：

```text
复制 main.js / preload.js / remote-storage.js / config/ / core dist / package.json / icons
→ D:\PromtOptimizer\PromptOptimizer\resources\app\
```

4. 或解压 `PromptOptimizer-app-overlay.zip` 覆盖 `resources\app`

### 4.2 环境

- 本机常见 Node **24**；engines 写 `^22`  
- 优先：**直调 node 入口**，少依赖 `pnpm -F` lifecycle  
- 不装新依赖、不 Docker（当前约束）

---

## 5. 测试命令（正确入口）

### 5.1 Core 单测（务必从 package 或指定 config）

```powershell
# 推荐
cd packages/core
node ./node_modules/vitest/vitest.mjs run tests/unit

# 从 monorepo 根（依赖已修 vitest root/setup 绝对路径）
cd <repo>
node ./packages/core/node_modules/vitest/vitest.mjs run --config packages/core/vitest.config.js tests/unit
```

### 5.2 Core typecheck

```powershell
cd packages/core
node ./node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

### 5.3 UI

```powershell
cd packages/ui
node ./node_modules/vitest/vitest.mjs run tests/unit
node ./node_modules/vue-tsc/bin/vue-tsc.js -p tsconfig.json --noEmit
```

### 5.4 Desktop

```powershell
cd <repo>
node --test packages/desktop/config/*.test.js
node --test scripts/desktop-ipc-handlers.test.mjs
node scripts/desktop-local-e2e-smoke.cjs          # 安装版
node scripts/desktop-local-e2e-smoke.cjs --source # 源码 electron
node scripts/write-release-traceability.cjs
```

### 5.5 已知坑

| 错误入口 | 现象 |
|----------|------|
| 根目录 vitest 不带 core config（旧配置） | `vi is not defined`、ENOENT `src/...`、MSW 超时 |
| update-handlers 用 `./package.json` | 更新检查 MODULE_NOT_FOUND（已修为 `../../package.json`） |

---

## 6. Git 工作流

```powershell
cd C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop
git status -sb
git log -3 --oneline
# 提交后：
git -c http.proxy= -c https.proxy= push origin work/desktop-hardening
```

PR：https://github.com/xvyimu/prompt-optimizer/pull/new/work/desktop-hardening  

---

## 7. 清理策略（允许删 / 禁止删）

### 7.1 允许删除（可再生 junk）

| 路径 | 说明 |
|------|------|
| `D:\PromtOptimizer\portable-build\` | 失败整壳拷贝 |
| `D:\PromtOptimizer\portable-app-overlay\` | 已有 zip |
| `.pipeline/core-unit-report.json` | 可重跑生成 |
| `packages/desktop/dist/win-unpacked\` | builder 半成品 |
| `%TEMP%\po-local-e2e-*.log` | 烟测日志 |

### 7.2 禁止删除

| 路径 | 说明 |
|------|------|
| 源码 worktree 业务代码 | 真相源 |
| `.pipeline/*.md` | 过程文档 |
| `D:\PromtOptimizer\PromptOptimizer\` | 可运行安装 |
| `PromptOptimizer-app-overlay.zip` | 分发 |
| `custom-templates\` | 用户数据 |
| 历史 audit / PROJECT_STATUS_REPORT | 审计上下文 |

### 7.3 清理后自检

```powershell
Test-Path D:\PromtOptimizer\PromptOptimizer\resources\app\main.js
Test-Path D:\PromtOptimizer\PromptOptimizer\resources\app\config\ipc\update-handlers.js
Test-Path D:\PromtOptimizer\PromptOptimizer\resources\app\icons\app-icon.ico
node scripts/desktop-local-e2e-smoke.cjs
```

---

## 8. 未决与可选债

1. **push `9e6d896`**：网络 443 恢复后执行 §6  
2. **electron-builder NSIS**：需稳定 builder/Node 环境；本机曾超时  
3. **Playwright 全量 e2e**：非日常门禁  
4. **API 密钥**：安装启动警告无 key，需用户配置模型  

细节见 `.pipeline/OPTIMIZATION_PLAN.md` §8。

---

## 9. 相关记忆（Claude）

- `prompt-optimizer-2026-07-18-delivery.md`
- `prompt-optimizer-remaining-todos.md`

---

## 10. 变更日志（本文）

| 日期 | 变更 |
|------|------|
| 2026-07-18 | 初版：路径/能力/测试/清理/Git 全细节交接 |
