# MCP 服务器用户指南

Prompt Optimizer 支持 Model Context Protocol (MCP) 协议，可以与 OpenCode、Claude Desktop 等支持 MCP 的 AI 应用集成。

## 🎯 功能特性

- **optimize-user-prompt**: 优化用户提示词以提升 LLM 性能
- **optimize-system-prompt**: 优化系统提示词以提升 LLM 性能
- **iterate-prompt**: 基于特定需求迭代改进成熟的提示词

## 🚀 快速开始

### Docker 部署（推荐）

Docker 是最简单的部署方式，Web 界面和 MCP 服务器会同时启动：

```bash
# 基本部署
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name prompt-optimizer \
  linshen/prompt-optimizer

# 访问地址
# Web 界面：http://localhost:8081
# MCP 服务器：http://localhost:8081/mcp
```

### 开发者本地部署

需要 Node.js 24.x 和仓库指定的 pnpm 10.6.1。以下命令均在仓库根目录执行；也可使用构建后的 CLI 作为 OpenCode 的本地 stdio 服务。

```bash
# 1. 克隆项目
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. 安装依赖
pnpm install --frozen-lockfile

# 3. 配置环境变量（复制并编辑 .env.local）
cp env.local.example .env.local

# 4. 先构建 Core，再构建 MCP 服务器
pnpm build:core
pnpm mcp:build

# 5. 启动 HTTP 服务（读取 .env.local）
pnpm mcp:start
```

服务器将在 `http://localhost:3000/mcp` 启动。开发者可以查看 [开发者文档](../../packages/mcp-server/README.md) 获取更多开发相关信息。

## ⚙️ 环境变量配置

### API 密钥配置

至少需要配置一个 API 密钥：

```bash
# 选择一个或多个 API 密钥
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_DEEPSEEK_API_KEY=your-deepseek-key
VITE_GROK_API_KEY=your-xai-key
VITE_SILICONFLOW_API_KEY=your-siliconflow-key
VITE_ZHIPU_API_KEY=your-zhipu-key

# 自定义 API（如 Ollama）
VITE_CUSTOM_API_KEY=your-custom-key
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=qwen2.5:0.5b
```

### MCP 服务器配置

```bash
# 首选模型提供商（当配置了多个 API 密钥时）
# 可选值：openai, gemini, anthropic, deepseek, grok, siliconflow, zhipu, dashscope, openrouter, modelscope, custom
MCP_DEFAULT_MODEL_PROVIDER=openai

# 日志级别（可选，默认 debug）
# 可选值：debug, info, warn, error
MCP_LOG_LEVEL=info

# HTTP 端口（可选，默认 3000，Docker 部署时无需设置）
MCP_HTTP_PORT=3000

# 内置模板语言（可选，默认 en-US）
# 可选值：zh-CN, en-US；也接受 zh, en
MCP_DEFAULT_LANGUAGE=zh-CN
```

## 🔗 客户端连接

### OpenCode 集成

将以下配置合并到使用 OpenCode 的项目根目录 `opencode.json`，或用户配置 `~/.config/opencode/opencode.json`。OpenCode 使用顶层 `mcp` 字段，详见 [OpenCode MCP 文档](https://opencode.ai/docs/mcp-servers/)。选择一种连接方式即可。

#### 本地 stdio

先完成上述安装和构建，将路径替换为本机仓库的绝对路径，并确保 OpenCode 启动环境中已有 `VITE_OPENAI_API_KEY`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "prompt_optimizer": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/prompt-optimizer/packages/mcp-server/bin/prompt-optimizer-mcp.cjs",
        "--transport=stdio"
      ],
      "environment": {
        "VITE_OPENAI_API_KEY": "{env:VITE_OPENAI_API_KEY}",
        "MCP_DEFAULT_MODEL_PROVIDER": "openai"
      },
      "enabled": true
    }
  }
}
```

OpenCode 会启动此进程，无需另行启动 HTTP 服务。使用 CLI 入口保持 stdout 专用于 MCP 消息；`pnpm mcp:start` 启动的是 HTTP 服务，不适合此 `command`。

`{env:NAME}` 是 [OpenCode 环境变量替换语法](https://opencode.ai/docs/config/#env-vars)，变量未设置时会替换为空字符串。示例显式传入模型凭据，不依赖 OpenCode 加载本仓库的 `.env.local`。OpenCode 自身的模型登录与 MCP 服务使用的模型凭据分别配置；不要把真实密钥写入并提交配置文件。

#### HTTP 服务

先通过 Docker 或 `pnpm mcp:start` 启动服务，再使用：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "prompt_optimizer": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "oauth": false,
      "enabled": true
    }
  }
}
```

Docker 示例的 URL 为 `http://localhost:8081/mcp`。`remote` 表示 HTTP 连接，也适用于本机服务。模型凭据配置在服务端；这里的 `oauth: false` 关闭 OpenCode 的 OAuth 探测，与模型 API 密钥无关。

在该 OpenCode 项目中执行 `opencode mcp list` 检查连接状态。随后可提示：

> 使用 prompt_optimizer 的 optimize-user-prompt 优化“为这个 TypeScript 项目编写 README”，只返回优化后的提示词。

OpenCode 会给工具名加上服务器名前缀，例如 `prompt_optimizer_optimize-user-prompt`。原始 MCP 工具名仍为 `optimize-user-prompt`。

### Claude Desktop 集成

#### 1. 找到配置目录

- **Windows**: `%APPDATA%\Claude\services`
- **macOS**: `~/Library/Application Support/Claude/services`
- **Linux**: `~/.config/Claude/services`

#### 2. 编辑配置文件

创建或编辑 `services.json` 文件：

```json
{
  "services": [
    {
      "name": "Prompt Optimizer",
      "url": "http://localhost:8081/mcp"
    }
  ]
}
```

> **注意**：如果你使用的是开发者本地部署（端口 3000），请将 URL 改为 `http://localhost:3000/mcp`。



### 其他 MCP 客户端

MCP 服务器支持标准的 MCP 协议，可以被任何兼容的客户端使用：

- **连接地址**：
  - Docker 部署：`http://localhost:8081/mcp`
  - 本地部署：`http://localhost:3000/mcp`
- **协议**：HTTP Streamable
- **传输方式**：HTTP 或 stdio

## 工具输入输出约定

通过 MCP `tools/list` 获取当前工具的 `inputSchema`。三个工具使用以下参数：

| 工具 | 必填参数 | 可选参数 |
| --- | --- | --- |
| `optimize-user-prompt` | `prompt` | `template` |
| `optimize-system-prompt` | `prompt` | `template` |
| `iterate-prompt` | `prompt`、`requirements` | `template` |

`prompt` 必须是非空白字符串，最长 50,000 个字符；`requirements` 必须是非空白字符串，最长 10,000 个字符。长度限制由服务端运行时校验，按 JavaScript 字符串 `length` 计算。`template` 的可用 ID、`enum` 和 `default` 由内置模板动态生成，请读取 `tools/list` 中该工具的 schema；省略时使用默认模板，避免硬编码其他版本的模板 ID。

成功结果为 `content: [{ "type": "text", "text": "优化后的提示词" }]`。工具处理错误会返回 `isError: true` 和说明错误的文本，应先检查 `isError` 再使用结果。当前工具没有 `outputSchema` 或 `structuredContent`，也没有逐 token 流式输出参数；HTTP 的 Streamable 传输不代表工具返回 token 流。

调用方负责保存并传递每次优化结果。下面假设 `client` 是已连接的 MCP SDK `Client`，演示优化后继续迭代：

```javascript
const optimized = await client.callTool({
  name: "optimize-user-prompt",
  arguments: { prompt: "为这个 TypeScript 项目编写 README" }
});
if (optimized.isError) throw new Error(JSON.stringify(optimized.content));
const prompt = optimized.content
  .filter(item => item.type === "text")
  .map(item => item.text)
  .join("\n");

const refined = await client.callTool({
  name: "iterate-prompt",
  arguments: { prompt, requirements: "要求包含安装步骤和一个最小使用示例" }
});
if (refined.isError) throw new Error(JSON.stringify(refined.content));
// refined.content 中的文本是本轮结果，可继续作为下一轮的 prompt。
```

服务使用内存存储，不会自动读取 Web/桌面版保存的模型配置或优化历史；迭代工具也不会隐式选取“上一次结果”。这与传输层会话不同：HTTP MCP 会建立会话，并要求后续请求携带会话 ID，由 MCP SDK 客户端处理。

## 🧪 测试与验证

### 本地协议 smoke tests

在仓库根目录运行 `pnpm mcp:test`，命令会先构建 Core 和 MCP。协议测试使用 MCP SDK 客户端和本地 mock provider 检查 stdio、HTTP 及工具调用，无需真实 API 密钥或付费模型。它们验证传输和工具契约，不评价优化质量。

OpenCode 配置按官方文档核对；协议 smoke tests 不等于 OpenCode 端到端测试，本次验证环境未安装 OpenCode CLI。

### 使用 MCP Inspector

MCP Inspector 是官方提供的测试工具：

```bash
# 1. 启动 MCP 服务器
pnpm mcp:start

# 2. 在另一个终端启动 Inspector
npx @modelcontextprotocol/inspector
```

在 Inspector Web UI 中：
1. 选择传输方式：`Streamable HTTP`
2. 服务器 URL：`http://localhost:3000/mcp`
3. 点击 "Connect" 连接服务器
4. 测试可用的工具

## 🔧 故障排除

### 常见问题

#### 1. 服务器启动失败

**错误**: `Error: listen EADDRINUSE: address already in use`
**解决**: 端口被占用，更改端口或停止占用进程

```bash
# 查看端口占用
netstat -ano | findstr :3000

# 更改端口
MCP_HTTP_PORT=3001 pnpm mcp:dev
```

#### 2. API 密钥无效

**错误**: `No enabled models found`
**解决**: 检查 API 密钥配置

```bash
# 确保至少配置一个有效的 API 密钥
echo $VITE_OPENAI_API_KEY
```

#### 3. 模型提供商不匹配

**错误**: 使用了错误的模型
**解决**: 检查 `MCP_DEFAULT_MODEL_PROVIDER` 配置

```bash
# 确保提供商名称正确
MCP_DEFAULT_MODEL_PROVIDER=openai  # 不是 OpenAI
```

#### 4. Docker 部署时 401 认证错误

**问题**: 使用 Docker 部署并启用了 `ACCESS_PASSWORD` 后，MCP Inspector 连接失败，返回 401 错误

**原因**: Docker 部署启用密码保护后，Nginx 会对所有路由启用 Basic 认证，包括 `/mcp` 路由

**解决方案**:
- **已修复（v1.4.0+）**：`/mcp` 路由已配置为绕过 Basic 认证
- **旧版本临时方案**：
  1. 不设置 `ACCESS_PASSWORD` 环境变量
  2. 或使用网络隔离（如仅在内网使用）
  3. 或直接暴露 3000 端口：`docker run -p 3000:3000 ...`

**技术说明**:
- MCP 协议本身不支持 HTTP Basic 认证
- 新版本在 `docker/nginx.conf` 中为 `/mcp` 路由添加了 `auth_basic off;`
- Web 应用访问仍然受密码保护

#### 5. Claude Desktop 连接失败

**解决步骤**：
1. 确认 MCP 服务器正在运行
2. 检查 URL 是否正确
3. 确认防火墙设置
4. 查看 Claude Desktop 日志

### 日志调试

启用详细日志：

```bash
# 开发环境
MCP_LOG_LEVEL=debug pnpm mcp:dev

# Docker 环境
docker run -e MCP_LOG_LEVEL=debug ...
```

## 📚 更多资源

- [MCP 官方文档](https://modelcontextprotocol.io)
- [开发者文档](../../packages/mcp-server/README.md)
- [项目主页](../../README.md)

## 🆘 获取帮助

如果遇到问题：

1. 查看本文档的故障排除部分
2. 检查项目 Issues
3. 提交新的 Issue 描述问题
4. 联系开发团队

---

**最后更新**：2026-09-30
