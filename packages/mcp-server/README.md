# 提示词优化器 MCP 服务器

## 独立桌面业务入口（本地源码）

新增 `prompt-optimizer-desktop-mcp --desktop-profile=<已有 userData 的绝对目录>`，也可直接运行 `node packages/mcp-server/bin/prompt-optimizer-desktop-mcp.cjs --desktop-profile=...`。它仅提供 stdio，不读取 MCP 环境变量或 `.env`，不改变原命令的三个优化工具及 HTTP `/mcp`。

该入口提供业务操作目录、收藏/版本、模板、文本与图片模型、上下文、历史、变量、工作区、设置、异步优化/测试/评估、文本对照与成果重开，以及由运行中的 Windows 桌面提供的图片/完整资源包桥。先用 `po_sources_list` 找到来源，再用 `po_desktop_catalog` 查看业务操作，或用 `po_sources_open` 打开同一来源做对照。

完整参数、覆盖矩阵、安全限制和验收命令见 [桌面 MCP 使用说明](../../docs/user/desktop-mcp.md)。本轮为本地交付，不等于现用安装包已升级；远端模型质量不能由回环协议夹具证明。

为提示词优化器项目提供的 MCP (Model Context Protocol) 服务器。提供提示词优化工具，支持通过 HTTP 协议连接，可被任何 MCP 兼容客户端使用。

> **用户部署和使用指南**：请查看 [MCP 服务器用户指南](../../docs/user/mcp-server.md)

## 桌面数据只读模式（v0.2 子集）

需要 Node 24.22.1，并先构建 core 和 MCP。通过受信任的客户端启动配置显式绑定已完成迁移的桌面 userData 目录，例如：

```text
node packages/mcp-server/bin/prompt-optimizer-mcp.cjs --mode=desktop-readonly --desktop-profile=C:\path\to\desktop-userData
```

`--desktop-profile=<绝对路径>` 可重复，最多 8 个；所有参数使用 `--名称=值`。只支持 stdio，不启动 HTTP。启动后仅登记来源，不自动打开数据库；工具参数不能传入目录。客户端先调用 `po_sources_list`，再以返回的 `sourceId` 调用 `po_sources_open`，且 `access` 只能为 `read`。其余工具为 `po_models_list`、`po_assets_list`、`po_assets_list_versions`、`po_assets_get_version`、`po_sources_close`。

指定历史版本时，用收藏列表返回的 `favoriteId`、`assetId` 和 `revision` 调用 `po_assets_list_versions`，将收藏的 `revision` 传为 `expectedRevision`。请求携带同一个 `connectionId`。工具按版本号从高到低返回版本号、版本 ID 和创建时间，以及当前版本 ID 和收藏的 `revision`。可用 `limit` 和 `cursor` 分页。按版本号选中后，将该条 `versionId` 和列表的 `revision` 传给 `po_assets_get_version` 读取正文。

此模式仅使用严格只读的 open-existing 接口：缺库、未迁移或不兼容时返回不可用，不建目录、建库、迁移、修复或补默认值。模型只返回保存的公开描述，执行能力始终不可用；资产支持精确文本版本读取。不提供运行、比较保存/删除、drawer 或 Chrome 接入。

`sources.open` 的 `schemaVersion='prompt-model/v1'` 表示读取层支持的资产业务合同；`source.storageVersion='legacy-json-migration/1'` 表示已核对的迁移状态。它们不把 SQLite 的 `user_version` 改为 1。所有来源句柄、连接和 revision 都仅在本次 MCP 进程/打开租约内有效；关闭或重启后须重新发现、打开。**尚未实现跨重启的持久来源身份，也不检测打开期间的数据文件原位替换。**响应中的 `identity` 明确公布这些限制。SQLite 自身的锁及 WAL/SHM 行为不包含在业务数据和表结构零改写的承诺内。

原三工具仍为默认或 `--mode=legacy` 模式，保留原环境变量配置；其 stdio 日志在加载配置之前转到 stderr。桌面只读模式会先分流，不加载这些环境配置。

开发验收使用独立、禁用 dotenv 自动加载的入口：

```text
pnpm -F @prompt-optimizer/mcp-server test:desktop-readonly
pnpm -F @prompt-optimizer/mcp-server test:desktop-stdio
```

第二个入口需先完成构建，只使用新建的合成临时 profile 和合成环境。它还会把编译产物复制到临时目录，隔离旧入口的全部 dotenv 搜索路径后验证原三工具发现，不调用模型。

## 桌面文本比较模式

将已迁移的桌面目录配置到独立桌面 MCP，通过 stdio 使用比较工具。

```text
node packages/mcp-server/bin/prompt-optimizer-desktop-mcp.cjs "--desktop-profile=C:\path\to\desktop-userData"
```

原命令的 `--mode=desktop-comparison` 继续兼容已有客户端配置。

1. 用 `po_sources_list` 查找数据源，再通过 `po_sources_open({sourceId, access: "compare"})` 建立连接。如果旧 JSON 和 SQLite 都包含需要保留的数据，打开会返回 `SOURCE_DATA_DIVERGED`。两份数据保留供核对。
2. 用 `po_assets_list` 查找 `pro-variable` 收藏，选择一个版本。用 `po_assets_list_versions` 按版本号找到需要的 `versionId`。资产和模型各自的 `revision` 可从 `po_assets_get_version`、`po_models_list` 取得。首版使用 `executable: true` 的两个不同已保存配置，支持 OpenAI 和 OpenAI Compatible。
3. 用 `po_tests_prepare` 冻结输入和模型设置。提交 `connectionId`、`source: {favoriteId, assetId, versionId, expectedRevision}`、`variables` 和两项 `candidates: [{id, configKey, expectedRevision}]`，候选 ID 依次为 `a`、`b`。返回两份请求预览、`preparedId`、`previewRevision` 和候选 `runId`。
4. 确认后调用 `po_tests_execute`，提交原 `preparedId`、`previewRevision` 与同一 `connectionId`。这一步会将预览中的输入发给配置的模型，可能产生调用费用。网络由 MCP 的 Node 运行环境处理。用 `po_tests_get` 查询状态，用 `po_tests_cancel` 取消全部候选或指定 `runId`。关闭连接时也会取消运行中的请求。
5. 两个候选结束后，用 `po_comparisons_save` 提交 `preparedId` 和本次保存意图的 `saveKey`。以返回的 `comparisonId` 在桌面变量工作区的「已保存比较」中重开结果，也可用 `po_comparisons_list`、`po_comparisons_get` 查询。删除时使用 `po_comparisons_delete` 提交选定记录的 `comparisonId` 和 `expectedRevision`。

对照工具通过 `connectionId` 定位已打开的来源。关闭对照连接后，业务工具仍可使用同进程内的 `sourceId`。重新打开对照连接后可按原 `comparisonId` 回读已保存数据。查看记录会保留当前工作区的编辑。

保存或删除返回 `WRITE_OUTCOME_UNKNOWN` 时，重开同一来源，通过 `po_comparisons_get` 核对该 `comparisonId` 的最终状态。保存所用的 ID 在准备阶段已经返回。

### 用同一个模型比较两版提示词

仍用 `po_tests_prepare`。`source` 指定原收藏版本，`candidates` 中 A、B 填同一个已保存模型的 `configKey` 和 `expectedRevision`。`variables` 给两边提供同一组变量。满足以下一种输入即可。

- 临时草稿使用 `candidatePrompt: {kind: "draft", text: "将 {{topic}} 概括为三条要点"}`。
- 比较同一收藏的另一个版本时，先查历史版本，再传 `candidatePrompt: {kind: "saved-version", versionId: "..."}`。

预览中的 `request` 是 A 的输入，`candidatePrompt.request` 是 B 的输入。确认后沿用执行、查询、取消和保存工具。桌面「已保存比较」可查看和核对两次实际输入。决定采纳草稿时，可复制候选提示词到现有收藏编辑器保存。

## 网页授权数据源模式

npm 包发布后，使用 Node.js 24.22.1 或更新的 24.x，将以下命令配置为客户端的 stdio 启动命令。

```sh
npx -y --prefer-online --package=@prompt-optimizer/mcp-server@latest prompt-optimizer-mcp --mode=browser
```

维护者可在仓库根目录运行 `pnpm mcp:pack`，在 `dist/npm/` 生成包含运行时、私有 Core 和比较 Skill 的命令行安装包。使用 `pnpm mcp:pack --out-dir <目录>` 可指定输出目录。

本地源码构建支持 `--mode=browser`。它是现有 MCP 包的另一种显式启动模式，不是独立常驻服务，不扫描 Chrome/Firefox 的资料目录，也不使用 CDP。原有 legacy、desktop-readonly、desktop-comparison 模式不变。

```text
pnpm -F @prompt-optimizer/core build
pnpm -F @prompt-optimizer/ui build:bundle
pnpm -F @prompt-optimizer/web build
pnpm -F @prompt-optimizer/mcp-server build
node packages/mcp-server/bin/prompt-optimizer-mcp.cjs --mode=browser
```

使用 Node 24.22.1，将最后一行作为客户端的 stdio 启动命令；客户端需使用对应的绝对文件路径。网页必须是包含此次更新的实际产品构建。此模式不读取 legacy 模型环境变量，不接受桌面目录参数或 HTTP MCP transport。

1. 调用 `po_sources_authorize`，传入实际产品的根 URL（可含部署子路径，但不含查询或 hash）以及 `access: "read"` 或 `"compare"`。只有此时才在**同一 MCP 进程**内启动临时 `127.0.0.1` 监听器。
2. 在希望连接的浏览器及资料中打开返回的一次性授权链接，在真实产品的「连接 Codex」面板检查网址、来源标签和权限后点击授权。链接两分钟内有效，页面立即清除其中的令牌；不要公开、保存到日志或转发链接。
3. 调用 `po_sources_list`。来源包含精确 `origin`、`browser`、`browserContextId`、`pageId` 和自定义标签。相同网址在不同资料或 Firefox/Chromium 中的数据不会合并；资料名称由用户自行填写，不读取本机资料路径。只发现已授权并在线的页面。
4. 使用返回的**指定** `sourceId` 调用 `po_sources_open`。`read` 可查模型公开元数据、收藏资产版本和已保存比较；`compare` 另外允许收藏写入、模型测试及比较保存/删除。只读授权不可升级；改变已打开连接的权限须先 close，再显式 open。
5. 收藏接口复用 `po_desktop_catalog/query/mutate` 的 favorites 子集及位置参数合同；浏览器模式不提供其他桌面业务域。先 query 获取 `revision`，写入时传 `expectedRevision`、`requestKey`。相同请求的准确重试不会重复创建；页面并发修改返回 `REVISION_CONFLICT`，须重新读取，不能强行覆盖。
6. 文本比较仍使用本页上节的 `po_models_list` → `po_assets_get_version` → `po_tests_prepare/execute/get` → `po_comparisons_save` 合同。不同的是，网络请求由**原网页已经初始化的 LLMService** 执行，使用该网页已有模型设置、浏览器网络及 CORS 规则，不把 API key 交给 MCP。执行可能产生模型费用，需在执行前核对预览和用户意图。
7. 保存返回 `comparisonId` 和 `viewTarget`。在同一来源网页的变量工作区打开「已保存比较」并输入该 ID，可读取持久化输出；收藏写入后刷新原收藏视图。网页结果与原业务服务共用同一已初始化 Dexie，无镜像库。

单次文本优化和测试也可以通过 `po_runs_start` 发起，并用 `po_runs_get` 读取状态和输出。使用 `po_desktop_query` 返回的当前 `revision` 作为 `expectedRevision`，并传入唯一的 `requestKey`。优化用 `kind: "optimize"`，传 `targetPrompt`、`optimizationMode`、`modelKey` 和可选的 `templateId`。单次测试用 `kind: "test"`，传 `userPrompt` 和 `modelKey`，可提供 `systemPrompt`，或用 `inputRunId` 引用成功的优化结果。页面用现有提示词服务执行，单次运行结果在本次连接内可读，可用 `po_runs_cancel` 请求取消。已保存的对照比较会保留在网页数据源中。

撤销授权、页面关闭或重新加载会使旧来源/连接失效并取消本页连接的运行任务，不自动切换到其他页面。重新加载后需新链接授权，但 `browserContextId` 和已保存结果仍在该资料的 IndexedDB 中。`po_sources_close` 仅关闭业务会话；网页授权仍在线时可重新 open。MCP 结束会关闭监听器；无授权链接、无页面时也回收监听器。异常断网由心跳检测（默认约 2–4 秒），每项业务调用还会先确认页面响应；休眠/冻结页面可能被断开，不自动重连。

写入断连或超时返回 `WRITE_OUTCOME_UNKNOWN`，执行返回 `EXECUTION_OUTCOME_UNKNOWN`，不能据此认为操作未发生或自动再调用模型。重连同一资料后查明保存结果/收藏现状；收藏可用相同 `requestKey` 和完全相同输入核对原写入回执，比较保存的目标 ID 在 prepare 已返回。

当前为 HTTP/HTTPS 普通网页入口；本地实测覆盖 HTTP loopback、自定义 `.localhost` 域名和内网 IP 的 Chromium/Firefox。**公网 HTTPS → 回环、部署 CSP/企业网络策略、安装版 PWA、扩展页和真实付费提供商尚未验收**，不能用本地测试替代。浏览器拒绝回环权限时按提示操作，不能关闭浏览器安全限制绕过。实现与证据见 [架构状态](../../docs/architecture/mcp-chrome-bridge.md) 和 [本机验收](../../docs/testing/browser-mcp-local-20261119.md)。

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
