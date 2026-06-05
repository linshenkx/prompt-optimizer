# 小词 MCP 服务器

为小词（XC）项目提供的 MCP (Model Context Protocol) 服务器。XC 面向飞书、XGD、GPC、Hermes、OpenClaw 等系统提供基于 wiki 体系的提示词生成、优化和迭代服务，支持通过 HTTP 协议连接，可被任何 MCP 兼容客户端使用。

> **用户部署和使用指南**：请查看 [MCP 服务器用户指南](../../docs/user/mcp-server.md)

## 功能特性

- **optimize-user-prompt**: 结合任务目标和 wiki 语境优化用户提示词以提升 LLM 性能
- **optimize-system-prompt**: 结合角色、流程和系统规范优化系统提示词以提升 LLM 性能
- **iterate-prompt**: 基于特定需求迭代改进成熟的提示词
- **generate-wiki-prompt**: 根据业务目标、调用方系统和 wiki 上下文生成可嵌入的生产级提示词
- **evaluate-prompt-fit**: 评估提示词是否适配 XC 的 MCP/Web/Desktop 嵌入式使用场景，返回评分、风险和改进建议

所有工具都支持可选 XC 上下文字段：

- `caller_system`: 调用方系统，如 `feishu`、`xgd`、`gpc`、`hermes`、`openclaw`、`web`、`desktop`
- `task_type`: 任务类型，如 `wiki_summary`、`workflow_agent`、`qa`、`report`
- `business_context`: 业务背景、流程边界、受众或系统约束
- `output_contract`: 输出格式、字段、语言、语气和校验规则
- `wiki_context`: 调用方提供的 wiki 查询、范围、片段或纯文本上下文
- `source_refs`: 需要保留的 wiki 页面、文档链接或来源摘录

## 快速开始

### 开发模式（推荐）

```bash
# 安装依赖
pnpm install

# 开发模式：自动监听文件变化，自动重新编译和重启服务器
pnpm dev
```

服务器将在 `http://localhost:3000/mcp` 启动，修改代码后自动重启。

### 生产模式

```bash
# 1. 构建项目
pnpm build

# 2. 启动服务器
pnpm start
```

服务器将在 `http://localhost:3000/mcp` 启动。

### 根目录快捷命令

如果你在项目根目录，可以使用以下快捷命令：

```bash
# 开发模式
pnpm mcp:dev

# 构建项目
pnpm mcp:build

# 启动服务器（默认已启用 debug 日志）
pnpm mcp:start

# 如需调整日志级别
MCP_LOG_LEVEL=info pnpm mcp:start

# 运行测试
pnpm mcp:test
```

## 开发配置

### 环境变量

开发时需要在项目根目录配置 `.env.local` 文件。详细的配置说明请参考 [用户指南](../../docs/user/mcp-server.md#环境变量配置)。

开发环境最小配置示例：
```bash
# 至少配置一个 API 密钥
VITE_OPENAI_API_KEY=your-openai-key
MCP_DEFAULT_MODEL_PROVIDER=openai
MCP_LOG_LEVEL=debug
```

可选生产配置：

```bash
# 配置后 /mcp 需要 Authorization: Bearer <token> 或 X-XC-MCP-Token
MCP_AUTH_TOKEN=replace-with-at-least-16-characters

# 浏览器型 MCP 客户端来源白名单，逗号分隔；默认 *
MCP_ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.example

# 专用健康检查端点
# http://localhost:3000/healthz
```

## 日志配置

MCP 服务器默认启用 `debug` 级别日志，可通过 `MCP_LOG_LEVEL` 环境变量调整：

```bash
# 默认 debug 级别（显示所有日志）
pnpm start

# 调整为 info 级别
MCP_LOG_LEVEL=info pnpm start

# 调整为 warn 级别
MCP_LOG_LEVEL=warn pnpm start

# 调整为 error 级别
MCP_LOG_LEVEL=error pnpm start
```

### 日志级别说明

- `debug` - 调试信息（默认，开发时使用）
- `info` - 一般信息（服务启动、配置等）
- `warn` - 警告信息（非致命问题）
- `error` - 错误信息（需要关注的问题）



## 开发

```bash
# 开发模式（自动监听文件变化，自动重启服务器）
pnpm dev

# 运行测试
pnpm test

# 类型检查
pnpm type-check

# 代码检查
pnpm lint
```

## 测试与调试

### 使用 MCP Inspector 测试

MCP Inspector 是官方提供的可视化测试工具，支持通过 Web UI 测试 MCP 服务器。

#### 使用 MCP Inspector 测试

```bash
# 1. 启动 MCP 服务器
pnpm start

# 2. 在另一个终端启动 Inspector
npx @modelcontextprotocol/inspector
```

然后在 Inspector Web UI 中：
1. 选择传输方式：`Streamable HTTP`
2. 服务器 URL：`http://localhost:3000/mcp`
3. 点击 "Connect" 连接服务器
4. 测试可用的工具：`optimize-user-prompt`、`optimize-system-prompt`、`iterate-prompt`、`generate-wiki-prompt`、`evaluate-prompt-fit`

#### 其他测试方法

**重要提示**：MCP 协议不是简单的 REST API，不能直接用 curl 测试。

**推荐的测试方式**：
1. **MCP Inspector**（官方工具）- 最佳选择
2. **Claude Desktop** - 实际使用场景
3. **自定义 MCP 客户端** - 使用 `@modelcontextprotocol/sdk`

**为什么不能用 curl**：
- MCP 使用 JSON-RPC 2.0 协议
- 需要特殊的握手和初始化过程
- HTTP 传输使用流式连接，不是简单的请求-响应

## 📚 相关文档

- [MCP 服务器用户指南](../../docs/user/mcp-server.md) - 用户部署和使用指南
- [MCP 服务器开发经验](../../docs/archives/120-mcp-server-module/experience.md) - 开发经验和最佳实践
- [项目主页](../../README.md) - 项目概述和快速开始

## 架构设计

此 MCP 服务器遵循零侵入设计原则：
- 仅使用现有 Core 模块 API，无需修改
- 采用内存存储实现无状态操作
- 提供 MCP 和 Core 格式之间的参数适配

## 许可证

GNU Affero General Public License v3.0 (AGPL-3.0-only)
