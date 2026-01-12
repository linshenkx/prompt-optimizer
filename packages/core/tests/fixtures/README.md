# LLM API Fixtures

此目录包含用于测试的预录制 LLM API 响应。

## 目录结构

```
fixtures/
├── llm/                     # LLM 服务响应
│   ├── openai/             # OpenAI API fixtures
│   ├── gemini/             # Gemini API fixtures
│   └── deepseek/           # DeepSeek API fixtures
├── prompt/                 # 提示词优化服务 fixtures
└── image/                  # 图像生成服务 fixtures
```

## Fixture 格式

每个 fixture 文件都是 JSON 格式，包含：

```json
{
  "request": {
    "provider": "openai",
    "model": "gpt-4",
    "messages": [...],
    "stream": true
  },
  "response": {
    "type": "streaming",
    "chunks": [
      { "content": "尊敬的", "timestamp": 0 },
      { "content": "张经理", "timestamp": 50 }
    ],
    "finalResult": {
      "content": "尊敬的张经理：...",
      "usage": { "prompt_tokens": 10, "completion_tokens": 50 }
    }
  },
  "metadata": {
    "recordedAt": "2026-01-09T10:30:00Z",
    "scenarioName": "optimize-basic-system",
    "duration": 1500
  }
}
```

## 录制新 Fixtures

### 方法 1: 自动录制（推荐）

```bash
# VCR 会自动检测缺失的 fixtures
# 如果 fixture 不存在，自动调用真实 API 并保存
pnpm test
```

### 方法 2: 强制重新录制

```bash
# 重新录制所有 fixtures
VCR_MODE=record pnpm test

# 重新录制特定测试
VCR_MODE=record pnpm test -- prompt-optimization
```

### 方法 3: 禁用 VCR（始终使用真实 API）

```bash
# 警告：这会产生 API 费用
VCR_MODE=off pnpm test
# 或
ENABLE_REAL_LLM=true pnpm test
```

## 更新现有 Fixtures

如果 API 响应格式发生变化，可以更新单个 fixture：

```bash
# 删除旧 fixture
rm packages/core/tests/fixtures/llm/openai/optimize-basic-system.json

# 重新运行测试（自动录制）
pnpm test
```

## 版本控制

✅ **应该提交**:
- 生产环境的典型响应
- 边界情况和错误场景
- 不同模型的参数差异

❌ **不应该提交**:
- 敏感数据（API keys, 用户个人信息）
- 临时调试 fixtures
- 超过 10MB 的大型 fixtures

## 最佳实践

1. **使用真实数据**: Fixtures 应该基于真实 API 响应，而非手编
2. **版本化管理**: 重大 API 变更时创建新版本目录（v2/, v3/）
3. **定期审查**: 每季度检查 fixtures 是否仍然匹配当前 API
4. **文档化**: 在文件名或注释中说明场景用途

## 故障排查

### Fixture 未生效

检查：
1. 文件路径是否正确（scenarioName 匹配）
2. JSON 格式是否有效
3. VCR_MODE 是否为 'replay' 或 'auto'

### 需要真实 API

设置环境变量：
```bash
export VITE_OPENAI_API_KEY=sk-...
export VITE_DEEPSEEK_API_KEY=sk-...
```

然后运行：
```bash
VCR_MODE=record pnpm test
```
