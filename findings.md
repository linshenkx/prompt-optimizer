# 发现与决策

## 需求
- 整理项目
- 规划**详细**文档（细节全部交代清楚）
- 清理不需要的文件
- 用 grilling + superpower 工作流继续

## 研究发现

### 布局（真相源）

| 位置 | 角色 |
|------|------|
| `.../prompt-optimizer-develop` | 源码 worktree、可 commit/push 的真相源 |
| `D:\PromtOptimizer\PromptOptimizer` | 本机可运行安装（`resources/app` 热替换，无 asar） |
| `D:\PromtOptimizer\*.md` | 审计/状态报告（历史 + 更新） |
| `D:\PromtOptimizer\PromptOptimizer-app-overlay.zip` | app 层分发包（~3.7MB） |
| `https://github.com/xvyimu/prompt-optimizer` | fork；分支 `work/desktop-hardening` |
| 上游 `linshenkx/prompt-optimizer` | remote `upstream`；默认 `develop` |

### Git
- 本地：`9e6d896`（ahead of origin 1 时可能仍未 push）
- 已推基线：`90adf6d`
- 工作树可能还有 `OPTIMIZATION_PLAN.md` 未提交修改

### 可再生垃圾（建议删）
| 路径 | 原因 |
|------|------|
| `D:\PromtOptimizer\portable-build\` | 失败/重复 Electron 整壳拷贝，极大 |
| `D:\PromtOptimizer\portable-app-overlay\` | 已打 zip，目录可删 |
| `.pipeline/core-unit-report.json` | vitest 临时 JSON，~331KB 可再生成 |
| `packages/desktop/dist/win-unpacked` | builder 半成品（若存在） |
| `%TEMP%\po-local-e2e-*.log` / `po-electron*` | 烟测日志 |

### 必须保留
| 路径 | 原因 |
|------|------|
| 源码 worktree 全部业务代码 | 开发真相源 |
| `.pipeline/*.md` | 过程与优化文档 |
| `D:\PromtOptimizer\PromptOptimizer\` | 日常运行 |
| `PromptOptimizer-app-overlay.zip` | 轻量分发 |
| `PROJECT_STATUS_REPORT.md` / `overview.md` / audit | 历史审计上下文 |

### 已完成能力（勿回退）
- AbortSignal 真实取消
- Desktop 领域 IPC 拆分 + channel-manifest 1.1.0
- update-handlers 拆分 + package.json 相对路径修复
- Core vitest cwd 无关配置
- 安装 icons
- 本地 e2e smoke / 溯源脚本

### 验证快照（最近）
- Core 问题五文件：46/46（正确入口）
- Desktop IPC 10、config 52
- 安装 E2E smoke：core/IPC/web-dist 通过；err 仅无 API key

## 技术决策
| 决策 | 理由 |
|------|------|
| 文档双入口：源码 HANDOFF + D 盘 README | 开发 vs 安装路径不同 |
| 清理只动 junk | 用户要整理，不要误删可运行安装 |
| push 失败不阻塞整理 | 网络问题单独处理 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 误判 Core 测试失败 | 必须 `cd packages/core` 或 `--config packages/core/vitest.config.js` |
| update 拆分后 package.json | `require('../../package.json')` |
| D: 删除受限 | bash `rm -rf` |

## 资源
- `.pipeline/OPTIMIZATION_PLAN.md`
- `.pipeline/todos-completion-report.md`
- `.pipeline/release-traceability.md`
- Ship 文件：spec/changes/verify-notes/test-results/review
