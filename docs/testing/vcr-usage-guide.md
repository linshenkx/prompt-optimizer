# VCR 使用指南

VCR（Video Cassette Recorder）用于在自动化测试中对 LLM API 调用进行**录制**与**回放**，让测试在离线/CI 环境中也能稳定运行。

## 目录

- [快速开始](#快速开始)
- [模式与环境变量](#模式与环境变量)
- [Fixtures 目录结构](#fixtures-目录结构)
- [编写测试](#编写测试)
- [故障排查](#故障排查)

## 快速开始

```bash
# 默认：auto 模式（有 fixture 就回放；缺 fixture 且未启用真实 API 时会失败或降级，取决于测试/拦截层）
pnpm test

# 强制回放（CI 推荐）：缺 fixture 或未拦截请求会直接失败
pnpm test:replay

# 重新录制（真实 API）：会产生费用，需配置 API Key
pnpm test:record

# 禁用 VCR（真实 API）：会产生费用，需配置 API Key
pnpm test:real
```

## 模式与环境变量

VCR 的行为由以下环境变量控制：

- `VCR_MODE`: `auto` | `record` | `replay` | `off`
- `ENABLE_REAL_LLM=true`: 允许真实 API（用于 `record`/`off`）
- `RUN_REAL_API=1`: 兼容 core 包已有开关（等价于 `ENABLE_REAL_LLM=true`）

项目已提供脚本（根目录 `package.json`）：

- `pnpm test:record` 等价于 `VCR_MODE=record ENABLE_REAL_LLM=true pnpm test`
- `pnpm test:replay` 等价于 `VCR_MODE=replay pnpm test`
- `pnpm test:real` 等价于 `VCR_MODE=off ENABLE_REAL_LLM=true pnpm test`

## Fixtures 目录结构

默认 fixtures 目录位于：

- `packages/core/tests/fixtures/`

按提供商/场景名组织：

- `packages/core/tests/fixtures/llm/<provider>/<scenario>.json`

示例：

- `packages/core/tests/fixtures/llm/deepseek/optimize-simple-prompt.json`

## 编写测试

在 core 包测试中，优先使用 `withVCR()` 包住真实调用（录制/回放由 VCR 决定）：

```ts
import { withVCR } from '../utils/vcr'

const response = await withVCR(
  'optimize-simple-prompt',
  { provider: 'deepseek', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], stream: true },
  async () => {
    // 这里放真实 API 调用（record/off 模式会实际发请求）
    return await llmService.optimizePromptStream(...)
  }
)
```

核心原则：

- 日常开发/CI：使用 `replay`，确保测试离线可重复
- 需要更新 fixtures：使用 `record` 并显式启用真实 API（`ENABLE_REAL_LLM=true`）
- fixtures 需要纳入版本控制（避免 CI 缺失导致不稳定）

## 故障排查

1) `Fixture not found`

- 说明当前处于回放路径但缺少 fixture。
- 解决：运行 `pnpm test:record` 生成 fixture，并将 `packages/core/tests/fixtures/` 纳入提交。

2) `Real LLM is disabled. Cannot record fixture.`

- 说明正在录制，但未启用真实 API。
- 解决：运行 `pnpm test:record`（已自动设置 `ENABLE_REAL_LLM=true`），并确保 `.env.local` 中配置了对应 API Key。

3) 回放时出现“未拦截请求”错误

- `pnpm test:replay` 会以更严格的方式运行，任何未被 fixtures/MSW 覆盖的请求都应视为失败。
- 解决：补齐对应 fixture 或补齐拦截/handlers；避免测试静默访问网络。

