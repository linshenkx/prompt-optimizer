# 测试运行指南（门禁）

本项目测试目标是：**自动拦截 UI 控制台错误/未捕获异常**，并通过 VCR 让 LLM 相关测试在 CI 中离线稳定运行。

## 常用命令

```bash
# Fast gate（用于 pre-commit）
pnpm test:gate

# Full gate（本地手动/CI 可用，包含 E2E）
pnpm test:gate:full

# 强制回放（CI 推荐：缺 fixtures/未拦截请求会失败）
pnpm test:replay

# 重新录制 fixtures（真实 API，会产生费用）
pnpm test:record
```

## VCR

- 使用说明：`docs/testing/vcr-usage-guide.md`
- fixtures 默认目录：`packages/core/tests/fixtures/`

## UI 错误门禁

- Vitest（UI 包）：`packages/ui/tests/utils/error-detection.ts`
- Playwright（E2E）：`tests/e2e/fixtures.ts`

