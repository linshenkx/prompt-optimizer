# 提示词优化器 MCP

## 新版 MCP

运行 `prompt-optimizer-product-mcp`，默认连接当前用户已有的桌面资料。桌面安装包可通过帮助菜单复制 Codex MCP 配置；源码构建可运行：

```powershell
node packages/mcp-server/bin/prompt-optimizer-product-mcp.cjs
```

- `--desktop-profile=<绝对目录>` 指定已有桌面资料目录。可传多个，首个作为桌面默认资料。
- `--product-url=<网页 URL>` 将指定网页设为默认来源。使用 `po_sources_authorize` 生成链接，在目标浏览器资料的产品页中授权。
- 只用网页版也可独立运行 MCP。首次提供完整产品入口地址，或设置默认网页后直接申请链接。日常访问时页面隐藏 MCP 入口。打开链接、确认权限后，保持该标签页开启即可使用网页资料和模型。
- 已登记网页用 `po_sources_authorize({sourceId})` 重新授权，首次连接用 `po_sources_authorize({productUrl})`。用户在目标浏览器资料中打开链接并确认。相同网址的多份资料需按浏览器和资料名称选择。
- 用 `po_sources_open` 获取 `connectionId`。此后的查询、写入、模型运行和对照都使用该连接。离线网页需授权恢复连接后再操作。

用 `po_catalog` 查同一份业务目录，再用 `po_query`、`po_mutate`、`po_runs_*` 和文本对照工具处理资料。已保存结果写回所选来源，可以在原产品重开。配套 Skill 为 `prompt-optimizer-compare`。

桌面需要已经迁移的 SQLite 资料。使用网页时，要打开含授权桥的新版网页。两端共用工具契约，模型调用和存储操作由所选来源执行。详细参数见 [新版 MCP 使用说明](../../docs/user/desktop-mcp.md)。

## Legacy

原有命令 `prompt-optimizer-mcp` 保留环境变量配置、stdio 和 HTTP `/mcp`。支持系统提示词优化、用户提示词优化和迭代。以下为 Legacy 的配置和开发说明。

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
4. 测试可用的工具：`optimize-user-prompt`、`optimize-system-prompt`、`iterate-prompt`

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

默认优化工具使用独立的内存配置。桌面模式通过已有存储和产品服务读取资产，比较模式把结果保存为独立记录。

## 许可证

GNU Affero General Public License v3.0 (AGPL-3.0-only)
