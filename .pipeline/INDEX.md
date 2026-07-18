# .pipeline 文档索引

本目录存放 **Ship / 优化 / 验证** 过程产物。正式交接请读：

→ [`docs/PROJECT_HANDOFF.md`](../docs/PROJECT_HANDOFF.md)

## 必读

| 文件 | 说明 |
|------|------|
| [OPTIMIZATION_PLAN.md](./OPTIMIZATION_PLAN.md) | 优化诊断 + 执行结果（最细问题单） |
| [todos-completion-report.md](./todos-completion-report.md) | 五项待办本地完成报告 |
| [release-traceability.md](./release-traceability.md) | commit / 文件 sha256 |

## Ship 流水线（历史交接）

| 文件 | 说明 |
|------|------|
| [spec.md](./spec.md) | Planner 规格 |
| [changes.md](./changes.md) | Coder 变更摘要 |
| [verify-notes.md](./verify-notes.md) | 验证命令记录 |
| [test-results.md](./test-results.md) | Tester 结果 |
| [review.md](./review.md) | Reviewer SHIP |

## 可删除的可再生文件

| 文件 | 说明 |
|------|------|
| `core-unit-report.json` | vitest JSON 报告，可重跑生成 |

## 相关脚本

- `scripts/desktop-local-e2e-smoke.cjs`
- `scripts/write-release-traceability.cjs`
- `scripts/desktop-ipc-handlers.test.mjs`
