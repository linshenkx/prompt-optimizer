# 提示词优化器 MCP 服务器

为提示词优化器项目提供的 MCP (Model Context Protocol) 服务器。提供提示词优化工具，支持通过 HTTP 协议连接，可被任何 MCP 兼容客户端使用。

> **用户部署和使用指南**：请查看 [MCP 服务器用户指南](../../docs/user/mcp-server.md)

## 功能特性

- **optimize-user-prompt**: 优化用户提示词以提升 LLM 性能
- **optimize-system-prompt**: 优化系统提示词以提升 LLM 性能
- **iterate-prompt**: 基于特定需求迭代改进成熟的提示词

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

### HTTP 安全配置

HTTP 模式默认只监听 `127.0.0.1`。使用非回环地址时必须配置 Bearer token；Docker 部署无论内部监听地址如何都必须配置 token，因为 Nginx 会对外暴露 `/mcp`。

```bash
MCP_HTTP_HOST=127.0.0.1
MCP_AUTH_TOKEN=replace-with-a-long-random-token
MCP_ALLOWED_ORIGINS=https://app.example.com,http://localhost:5173
MCP_HTTP_BODY_LIMIT=256kb
MCP_MAX_SESSIONS=100
MCP_SESSION_TTL_MS=1800000
```

- `MCP_ALLOWED_ORIGINS` 仅用于浏览器客户端，不支持 `*`；不发送 `Origin` 的原生 MCP 客户端不受影响。
- 设置 `MCP_AUTH_TOKEN` 后，客户端必须发送 `Authorization: Bearer <token>`。
- `/healthz` 不要求认证，用于本地和容器健康检查。
- token 不应写入仓库、日志或客户端公开配置。

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
3. 如果配置了 `MCP_AUTH_TOKEN`，添加 `Authorization: Bearer <token>` 请求头
4. 点击 "Connect" 连接服务器
5. 测试可用的工具：`optimize-user-prompt`、`optimize-system-prompt`、`iterate-prompt`

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
