# Review（2026-07-18 · pipeline-reviewer）

## VERDICT

**SHIP**

范围是「本地可启动 Desktop + 保留 hardening 改动 + fork remote 就绪 + 约定验证绿」，不是全量产品发版。在该 DoD 下可交付；默认仍不 commit/push。

## 范围对照

| Spec DoD | 证据 | 判定 |
|----------|------|------|
| Desktop 离线可起（web-dist） | smoke log：`Loading web app from: ...\web-dist\index.html`；core services / storage / templates 初始化成功；进程 ≥6s 未闪退 | 满足 |
| core dist 含 abort / electron 入口 | `packages/core/dist/index.cjs` + `electron.cjs` 存在（2026-07-18 rebuild） | 满足 |
| IPC 契约 + desktop config + cancellation 单测 | IPC 10/10；desktop config 52/52；core 相关 28/28 | 满足 |
| `typecheck:core` | exit 0 | 满足 |
| 用户改动保留 | 工作树仍含 IPC domain split / AbortSignal / security；无 reset/clean | 满足 |
| origin/upstream | origin=`xvyimu/prompt-optimizer`；upstream=`linshenkx/prompt-optimizer` | 满足 |
| 分支 `work/desktop-hardening`；无 commit/push | HEAD 仍 `2c1f4ba`；dirty 未提交 | 满足 |
| 无 install / 无真实 API / 不 Docker 作交付入口 | 符合 notes；无 API key 仅 warn，spec 允许 | 满足 |

## 关键发现

1. **交付主轴匹配 spec，不是空壳绿灯**  
   `main.js` 已是 composition root，领域 handler 在 `config/ipc/*`；`owned-stream-runner` 把同一 `AbortSignal` 交给 service；preload 有 `cancelStream` / `createStreamAbortRace`；core `StreamRequestOptions.signal` 经 service→adapter→SDK。烟测日志确认离线 `loadFile(web-dist)`，不是 dev server 白屏路径。

2. **测试有实质行为断言，不只是存在性检查**  
   - `provider-cancellation.test.ts`：mock 在 signal abort 后才结束，并断言 OpenAI/Anthropic/Gemini/Chrome 收到 signal。  
   - `stream-registry.test.js`：owner cancel、非 owner 拒绝、destroyed 清理、事件停发。  
   - `desktop-ipc-handlers.test.mjs`：preload channel ⊆ main handlers、`stream-cancel`、domain 委托不回流 main。  
   静态契约测试防 channel 漂移；取消链路另有行为测，整体够支撑本阶段。

3. **安全边界未为「能启动」而卸掉**  
   `registerSecureIpcHandler`：main-frame + allowed origin；streamId 字符集/长度；stream 所有权与并发上限；非 owner cancel → `IPC_STREAM_NOT_OWNER`。未见本轮为启动关闭校验或写入密钥文件。

4. **引擎与 build 约束按 spec 处理**  
   Node 24 下用直接 tsup/vitest/tsc 入口完成 rebuild/test，未改 engines、未改 lock、未 `pnpm install`。`@prompt-optimizer/core` exports 含 `"."` + `"./electron"`；UI `useAppInitializer` Electron 分支动态 `import('@prompt-optimizer/core/electron')`。`web-dist` 已含 `electron-*.js` chunk，与子路径拆分一致。

5. **非阻塞缺口（不构成 NEEDS WORK/BLOCK）**  
   - 全量 Core/UI / `vue-tsc` / package / 真实流式对话未跑（spec 明确允许）。  
   - smoke stderr 实际有「No API keys」warn（符合非目标）；notes 写「stderr 空」略不精确，但不影响判定。  
   - auto-updater 在未 packaged 下记 Development mode，预期行为。  
   - docker/mcp-server 等同树改动不在本 DoD 验收轴；合并上游前需另审。  
   - 大 diff 仍未 commit；push 须用户确认，且应走 `work/desktop-hardening`，禁止 force 到 fork `develop`。

## 安全结论

无启动阻断级安全回归。IPC sender 信任、stream 所有权、导航/runtime 相关单测仍在通过集合中。不自动 push 避免未审查大 diff 上默认分支。

## 推送前（人工，默认不执行）

```text
cd C:\Users\yuanjia\Documents\Codex\2026-07-17\dui\work\source-extract\prompt-optimizer-develop
git status -sb
git remote -v
# 用户确认后：
# git add -A   # 再扫无 .env.local / 密钥
# git commit -m "feat(desktop): ipc domain split, stream cancel, provider abort signal"
# git push -u origin work/desktop-hardening
```

## 最终

**SHIP** — 本地可用 Desktop + fork remote 就绪 + 约定验证绿；可继续本地使用。合并/发版前再补全量测试与 package。
