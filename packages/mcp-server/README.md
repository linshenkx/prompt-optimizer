# 提示词优化器 MCP 服务器

为提示词优化器项目提供的 MCP (Model Context Protocol) 服务器。提供提示词优化工具，支持通过 HTTP 协议连接，可被任何 MCP 兼容客户端使用。

> **用户部署和使用指南**：请查看 [MCP 服务器用户指南](../../docs/user/mcp-server.md)

## 桌面数据只读模式（v0.2 子集）

需要 Node 24.22.1，并先构建 core 和 MCP。通过受信任的客户端启动配置显式绑定已完成迁移的桌面 userData 目录，例如：

```text
node packages/mcp-server/bin/prompt-optimizer-mcp.cjs --mode=desktop-readonly --desktop-profile=C:\path\to\desktop-userData
```

`--desktop-profile=<绝对路径>` 可重复，最多 8 个；所有参数使用 `--名称=值`。只支持 stdio，不启动 HTTP。启动后仅登记来源，不自动打开数据库；工具参数不能传入目录。客户端先调用 `po_sources_list`，再以返回的 `sourceId` 调用 `po_sources_open`，且 `access` 只能为 `read`。其余工具为 `po_models_list`、`po_assets_list`、`po_assets_get_version`、`po_sources_close`。

此模式仅使用严格只读的 open-existing 接口：缺库、未迁移或不兼容时返回不可用，不建目录、建库、迁移、修复或补默认值。模型只返回保存的公开描述，执行能力始终不可用；资产支持精确文本版本读取。不提供运行、比较保存/删除、drawer 或 Chrome 接入。

`sources.open` 的 `schemaVersion='prompt-model/v1'` 表示读取层支持的资产业务合同；`source.storageVersion='legacy-json-migration/1'` 表示已核对的迁移状态。它们不把 SQLite 的 `user_version` 改为 1。所有来源句柄、连接和 revision 都仅在本次 MCP 进程/打开租约内有效；关闭或重启后须重新发现、打开。**尚未实现跨重启的持久来源身份，也不检测打开期间的数据文件原位替换。**响应中的 `identity` 明确公布这些限制。SQLite 自身的锁及 WAL/SHM 行为不包含在业务数据和表结构零改写的承诺内。

原三工具仍为默认或 `--mode=legacy` 模式，保留原环境变量配置；其 stdio 日志在加载配置之前转到 stderr。桌面只读模式会先分流，不加载这些环境配置。

开发验收使用独立、禁用 dotenv 自动加载的入口：

```text
pnpm -F @prompt-optimizer/mcp-server test:desktop-readonly
pnpm -F @prompt-optimizer/mcp-server test:desktop-stdio
```

第二个入口需先完成构建，只使用新建的合成临时 profile 和合成环境。它还会把编译产物复制到临时目录，隔离旧入口的全部 dotenv 搜索路径后验证原三工具发现，不调用模型。

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

此 MCP 服务器遵循零侵入设计原则：
- 仅使用现有 Core 模块 API，无需修改
- 采用内存存储实现无状态操作
- 提供 MCP 和 Core 格式之间的参数适配

## 许可证

GNU Affero General Public License v3.0 (AGPL-3.0-only)
