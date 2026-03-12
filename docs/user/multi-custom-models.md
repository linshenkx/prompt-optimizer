# 多自定义模型配置指南

## 概述

Prompt Optimizer 现在支持配置无限数量的自定义模型，让您可以同时使用多个本地模型或自建API服务。

## 功能特性

- ✅ 支持无限数量的自定义模型
- ✅ 通过环境变量自动发现和注册
- ✅ 友好的模型名称显示
- ✅ 完全向后兼容原有配置
- ✅ 支持所有部署方式（Web、Desktop、Docker、MCP）

## 配置方法

### 环境变量格式

使用以下格式配置多个自定义模型：

```bash
VITE_CUSTOM_API_KEY_<suffix>=your-api-key          # 必需
VITE_CUSTOM_API_BASE_URL_<suffix>=your-base-url    # 必需
VITE_CUSTOM_API_MODEL_<suffix>=your-model-name     # 必需
VITE_CUSTOM_API_PARAMS_<suffix>=json-object-string # 可选，额外请求参数
```

### 配置要求

- **后缀名**：只能包含字母（a-z, A-Z）、数字（0-9）、下划线（_）、连字符（-），长度不超过50个字符
- **API_KEY**：必需，用于API认证
- **BASE_URL**：必需，API服务器地址
- **MODEL**：必需，具体的模型名称
- **PARAMS**：可选，JSON 对象字符串，会注入到最终请求体中

### 后缀名命名示例

| 模型服务 | 推荐后缀名 | 环境变量示例 | 显示名称 |
|---------|-----------|-------------|----------|
| Qwen3 | `qwen3` | `VITE_CUSTOM_API_KEY_qwen3` | Qwen3 |
| Qwen2.5 | `qwen2_5` 或 `qwen25` | `VITE_CUSTOM_API_KEY_qwen2_5` | Qwen2 5 |
| Claude本地 | `claude_local` | `VITE_CUSTOM_API_KEY_claude_local` | Claude Local |
| GPT本地 | `gpt_local` | `VITE_CUSTOM_API_KEY_gpt_local` | Gpt Local |
| 自定义LLM | `my_llm` | `VITE_CUSTOM_API_KEY_my_llm` | My Llm |
| 公司内部模型 | `company_ai` | `VITE_CUSTOM_API_KEY_company_ai` | Company Ai |

**命名规则：**
- ✅ **允许**：字母（a-z, A-Z）、数字（0-9）、下划线（_）、连字符（-）
- ❌ **不允许**：点号（.）、空格、特殊符号等
- 💡 **建议**：使用小写字母，用下划线分隔单词（如：`qwen2_5`、`claude_local`）
- 📏 **长度限制**：最多50个字符

### 限制说明

- **字符限制**：后缀名只能包含 `a-z A-Z 0-9 _ -`，不支持点号、空格等特殊字符
- **长度限制**：最大50个字符
- **冲突检查**：不能与现有静态模型名冲突（如：openai, gemini, deepseek, zhipu, siliconflow, custom）
- **完整性要求**：所有三个配置项都必须提供，缺少任何一项都会跳过该模型
- **额外参数要求**：`PARAMS` 必须是 JSON 对象字符串，不能是数组、字符串或数字
- **保留字段**：`PARAMS` 中的 `model`、`messages`、`stream` 会被自动忽略，避免覆盖核心请求结构

### 配置示例

```bash
# 原有配置（保持兼容）
VITE_CUSTOM_API_KEY=default-custom-key
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=default-model

# Ollama Qwen3 模型
VITE_CUSTOM_API_KEY_qwen3=ollama-qwen3-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b

# Ollama Qwen2.5 模型（使用下划线分隔版本号）
VITE_CUSTOM_API_KEY_qwen2_5=ollama-qwen25-key
VITE_CUSTOM_API_BASE_URL_qwen2_5=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen2_5=qwen2.5:14b

# 本地 Claude 兼容服务
VITE_CUSTOM_API_KEY_claude_local=claude-local-key
VITE_CUSTOM_API_BASE_URL_claude_local=http://localhost:8080/v1
VITE_CUSTOM_API_MODEL_claude_local=claude-3-sonnet
VITE_CUSTOM_API_PARAMS_claude_local={"temperature":0.3,"top_p":0.8}

# 其他自建 API 服务
VITE_CUSTOM_API_KEY_my_llm=my-llm-api-key
VITE_CUSTOM_API_BASE_URL_my_llm=https://my-api.example.com/v1
VITE_CUSTOM_API_MODEL_my_llm=my-custom-model
VITE_CUSTOM_API_PARAMS_my_llm={"temperature":0.7,"top_p":0.9,"max_tokens":4096}

# NVIDIA NIM thinking 模式
VITE_CUSTOM_API_KEY_nvidia=nvapi-xxx
VITE_CUSTOM_API_BASE_URL_nvidia=https://integrate.api.nvidia.com/v1
VITE_CUSTOM_API_MODEL_nvidia=qwen/qwen3.5-397b-a17b
VITE_CUSTOM_API_PARAMS_nvidia={"chat_template_kwargs":{"enable_thinking":true},"temperature":0.6,"top_p":0.95,"max_tokens":16384}
```

### 额外请求参数说明

`VITE_CUSTOM_API_PARAMS_<suffix>` 适合以下场景：

- 为 OpenAI 兼容接口补充 `temperature`、`top_p`、`max_tokens` 等标准参数
- 传递供应商特有字段，例如 NVIDIA NIM 的 `chat_template_kwargs`
- 在 Docker 运行时一次性下发模型默认参数，避免每次在 UI 中重新手动填写

配置示例：

```json
{
  "chat_template_kwargs": {
    "enable_thinking": true
  },
  "temperature": 0.6,
  "top_p": 0.95,
  "max_tokens": 16384
}
```

注意事项：

- 参数值必须是合法 JSON 对象字符串
- 如在 Docker Compose 中填写复杂 JSON，建议使用单引号包裹整个值
- `timeout` 可以作为额外参数传入，用于覆盖请求超时
- 系统不会自动校验供应商私有参数的语义，请按目标服务文档填写

## UI 显示效果

配置的模型会在模型选择下拉框中显示为：

- **Custom** (原有配置)
- **Qwen3** (来自 custom_qwen3)
- **Qwen2 5** (来自 custom_qwen2_5)
- **Claude Local** (来自 custom_claude_local)
- **My Llm** (来自 custom_my_llm)

后缀名会自动格式化为友好的显示名称：
- 下划线和连字符会被替换为空格
- 每个单词首字母自动大写
- 例如：`qwen2_5` → `Qwen2 5`，`claude_local` → `Claude Local`

## 部署方式配置

### Web 开发环境

在项目根目录的 `.env.local` 文件中添加配置：

```bash
VITE_CUSTOM_API_KEY_qwen3=your-qwen-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b
VITE_CUSTOM_API_PARAMS_qwen3={"temperature":0.7}
```

### Desktop 应用

设置系统环境变量或在启动时指定：

```bash
# Windows
set VITE_CUSTOM_API_KEY_qwen3=your-qwen-key
npm run desktop

# macOS/Linux
export VITE_CUSTOM_API_KEY_qwen3=your-qwen-key
npm run desktop
```

### Docker 部署

#### 方式1：环境变量参数

```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e VITE_CUSTOM_API_KEY_ollama=dummy-key \
  -e VITE_CUSTOM_API_BASE_URL_ollama=http://host.docker.internal:11434/v1 \
  -e VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b \
  -e 'VITE_CUSTOM_API_PARAMS_ollama={"temperature":0.7}' \
  -e VITE_CUSTOM_API_KEY_qwen3=your-qwen3-key \
  -e VITE_CUSTOM_API_BASE_URL_qwen3=http://host.docker.internal:11434/v1 \
  -e VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b \
  -e 'VITE_CUSTOM_API_PARAMS_qwen3={"temperature":0.6,"top_p":0.95}' \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

#### 方式2：环境变量文件

创建 `.env` 文件：

```bash
VITE_OPENAI_API_KEY=your-openai-key
VITE_CUSTOM_API_KEY_ollama=dummy-key
VITE_CUSTOM_API_BASE_URL_ollama=http://host.docker.internal:11434/v1
VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b
VITE_CUSTOM_API_PARAMS_ollama={"temperature":0.7}
VITE_CUSTOM_API_KEY_qwen3=your-qwen3-key
VITE_CUSTOM_API_BASE_URL_qwen3=http://host.docker.internal:11434/v1
VITE_CUSTOM_API_MODEL_qwen3=qwen3:8b
VITE_CUSTOM_API_PARAMS_qwen3={"temperature":0.6,"top_p":0.95}
```

使用环境变量文件运行：

```bash
docker run -d -p 8081:80 --env-file .env \
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

#### 方式3：Docker Compose

修改 `docker-compose.yml` 添加 `env_file` 配置：

```yaml
services:
  prompt-optimizer:
    image: linshen/prompt-optimizer:latest
    env_file:
      - .env  # 从 .env 文件读取环境变量
    ports:
      - "8081:80"
    restart: unless-stopped
```

然后在 `.env` 文件中配置变量（同方式2）。

### MCP 服务器

MCP 服务器会自动识别所有配置的自定义模型。可以通过 `MCP_DEFAULT_MODEL_PROVIDER` 指定首选模型：

```bash
# 使用特定的自定义模型
MCP_DEFAULT_MODEL_PROVIDER=custom_qwen3
```

## 常见问题

### Q: 如何验证配置是否正确？

A: 启动应用后，检查控制台日志。成功配置的模型会显示类似信息：
```
[scanCustomModelEnvVars] Found 2 custom models: qwen3, claude_local
[generateDynamicModels] Generated model: custom_qwen3 (Qwen3)
```

如果使用了 `PARAMS`，还可以在浏览器开发者工具的 Network 面板里检查发出的请求体是否包含额外字段。

### Q: 配置错误时会发生什么？

A: 系统会输出详细的错误信息，但不会影响其他模型的正常使用：
```
[scanCustomModelEnvVars] Skipping invalid_suffix due to validation errors:
  - Invalid suffix format: invalid$suffix
```

如果 `PARAMS` 不是合法 JSON 对象，系统会忽略该参数配置并输出警告，但模型本身仍然可用。

### Q: 可以配置多少个自定义模型？

A: 理论上没有限制，但建议根据实际需要合理配置，避免UI界面过于拥挤。

### Q: 如何删除不需要的自定义模型？

A: 删除对应的环境变量并重启应用即可。

## 技术细节

- 模型key格式：`custom_<suffix>`
- 配置验证：自动检查后缀名格式、API密钥、baseURL等
- 容错处理：单个配置错误不影响其他模型
- 默认值：提供合理的默认配置，确保系统稳定性

## 更新日志

- **v1.2.6**: 代码质量修复和性能优化
  - 修复MCP Server大小写转换Bug，环境变量映射更准确
  - 优化配置验证逻辑，性能提升66%
  - 解决ValidationResult接口冲突，提升类型安全
  - 实现静态模型键动态获取，自动同步更新
  - 所有修复经过全面测试，确保跨环境一致性

- **v1.4.0**: 新增多自定义模型支持
  - 完全向后兼容原有配置
  - 支持所有部署方式
  - 添加配置验证和容错处理
