# 桌面 MCP 本地业务入口

适用于包含新版桌面 MCP 的 Windows 安装包和本地源码构建。

## 入口与兼容

| 入口 | 使用的数据 | 传输与能力 |
| --- | --- | --- |
| `prompt-optimizer-mcp`（原命令，不带桌面模式） | 原环境变量、内存装配 | 原三个优化工具；stdio 和 HTTP `/mcp` 保留 |
| 原命令加 `--mode=desktop-readonly` | 指定的已有桌面 SQLite | 原只读资产/模型目录与精确版本读取 |
| 原命令加 `--mode=desktop-comparison` | 指定的已有桌面 SQLite | 原预览、冻结输入、双模型/双提示词比较、采纳与已保存比较 |
| **`prompt-optimizer-desktop-mcp`**（独立新命令） | 指定的已有桌面 SQLite 和产品服务 | 业务目录及文本对照工具；仅 stdio，不载入 `.env`，不替换旧命令 |

## 从 Windows 安装包连接 Codex

1. 安装并启动桌面应用，完成已有数据的迁移。
2. 从桌面菜单 **Help → Copy Codex MCP Configuration** 复制配置。将 `[mcp_servers.prompt_optimizer_desktop]` 配置段粘贴到 Codex 的 `config.toml`。如果已有同名配置段，替换该段。
3. 在 Codex 中重新载入 MCP 配置后，调用 `po_sources_list` 查看桌面来源。Codex 按需启动安装包自带的运行时，使用桌面应用的实际数据目录。

要使用首个对照 Skill，可将安装目录下的 `resources/skills/prompt-optimizer-compare` 文件夹复制到目标 Codex 项目的 `.agents/skills`，然后调用 `$prompt-optimizer-compare`。查收藏、运行和回读仍使用同一份 MCP 配置。

## 从源码启动

使用仓库支持的 Node 24 环境先构建 Core 与 MCP。

```powershell
pnpm --filter @prompt-optimizer/core build
pnpm --filter @prompt-optimizer/mcp-server build
node packages/mcp-server/bin/prompt-optimizer-desktop-mcp.cjs --desktop-profile="C:/absolute/path/to/existing/userData"
```

`--desktop-profile` 必须是明确授权的绝对 **userData 目录**，不是 SQLite 文件；可指定最多八个目录。已有数据库必须通过 schema、迁移及旧 JSON 分歧检查。不存在、损坏、未迁移或有分歧时拒绝打开，不为 MCP 自动创建库、迁移或覆盖资料。先由桌面程序完成迁移。新命令不接受调用者覆盖 `--mode` 或切成 HTTP。

源码模式的客户端配置把支持的 Node 可执行文件设为 `command`，把已构建的 `.cjs` 入口及 `--desktop-profile=...` 放在 `args`。桌面模式使用已保存的模型配置。

## 工具与业务覆盖

先调用 `po_sources_list`，再调用 `po_desktop_catalog` 查看实时目录。`sourceId` 在当前 MCP 进程内标识同一个桌面来源，进程重启后需重新列出。

| 工具 | 用途 |
| --- | --- |
| `po_desktop_query` | 按 `domain`、`operation`、位置参数数组 `arguments` 查询；返回 `revision` 与 `result` |
| `po_desktop_mutate` | 同一目录的产品写操作，要求 `expectedRevision` 和新 `requestKey` |
| `po_runs_start/get/list/cancel` | 启动异步业务，按稳定 runId 获取状态、部分文本、推理文本、最终输出及脱敏错误；可取消 |
| `po_runs_save/delete` | 显式归档或定向删除；优化/迭代可用 `target: "history"` 存入原历史记录 |
| `po_data_export_file` | 将应用 JSON（含凭据）导出到**不存在的新绝对路径**；须 `includeCredentials: true` |
| `po_resources` | 运行中的 Windows 桌面资源桥：图片库读写和完整 ZIP 导入导出，见后文 |

`po_desktop_query/mutate` 的目录均绑定现有产品服务方法，而非任意方法名或原始数据库写入：

| domain | 产品操作 |
| --- | --- |
| `favorites` | 收藏查询/搜索、增改删、使用次数、版本切换/删除；分类与标签管理；导入校验/导入/导出 |
| `assets`（只读） | `listAssets`、`listAssetVersions`、`getAssetVersion`；精确选择收藏、资产和版本 |
| `templates` | 模板列表、类型过滤、读取、保存、删除、单模板导入导出及内置模板语言 |
| `models` / `imageModels` | 已保存的文本/图像模型配置增改删、文本模型启停 |
| `providers` / `imageProviders` | 提供商元数据和静态模型目录；动态发现及连接测试见 runs |
| `contexts` | 多消息上下文的列表、创建、复制、改名、保存/更新、删除、当前上下文及导入导出 |
| `history` | 优化记录与迭代链的列表、读取、新建、追加、删除和清空 |
| `variables` | 全局变量的列表、读取、设置和删除；与 UI 共用名称规则，不覆盖其余变量管理状态 |
| `workspaces` | 导出、校验和导入各子模式的会话快照（包括多消息、变量、图片模式及 Arena） |
| `settings` | 偏好设置读取、枚举、导入导出、设置和删除；会话必须用 `workspaces` 的校验路径 |
| `data` | 应用 JSON 的校验、导入和脱敏导出；含会话、已保存比较及已保存 MCP 成果，不含收藏/图片二进制 |

参数位置及必选项由 `po_desktop_catalog` 返回，例如：

```json
{"sourceId":"<fresh-source-id>","domain":"favorites","operation":"searchFavorites","arguments":["待查关键词"]}
```

查询结果的 `revision` 传给后续 `po_desktop_mutate.expectedRevision`。写操作在内存中调用原服务、校验并暂存，最终通过 SQLite 同一事务比较原值后提交；发现竞争变更返回 `REVISION_CONFLICT`，不要盲目重试或覆盖。相同 requestKey 与原封不动的参数可读取既有回执；复用为另一个请求会被拒绝。普通查询及目录初始化不把默认配置/迁移结果写回数据库。

配置查询会遮盖 API key、连接配置、请求头、私有地址路径等字段，包含 JSON 字符串里的配置。脱敏结果不是可直接回写的完整备份；更新配置应仅提交用户明确提供的字段。模型生成内容、用户提示词和导出的文件仍可能敏感，不应自动分享。

## 优化、测试、评估与比较

`po_runs_start.input` 接受 `{kind, request, source?, promptField?, inputRunId?, timeoutMs?}`。默认最长 180 秒，可显式设为 100–600000 毫秒；每个来源最多四个运行中任务。只使用原库中实际存在的模型配置，不从 MCP 环境创建收费执行配置，也不接受请求内的 `configSnapshot/modelConfig`。

| kind | request 的主要字段 |
| --- | --- |
| `optimize` | `targetPrompt, optimizationMode: "system"/"user", modelKey, templateId?`；可选产品支持的高级上下文/图片 |
| `optimize-message` | `selectedMessageId, messages, modelKey, templateId?, variables?, tools?` |
| `iterate` | `originalPrompt, lastOptimizedPrompt, iterateInput, modelKey, templateId, contextData?` |
| `test` | `systemPrompt?, userPrompt?, modelKey, inputImages?, variables?` |
| `test-conversation` | `modelKey, messages, variables, tools?, contextMode?` |
| `evaluate` | 原 `EvaluationRequest`，包括 `type, evaluationModelKey, mode, target` 及对应测试快照；结构不被改成另一个评分模型 |
| `test-batch` | `candidates`：2–4 个 test 请求；可使用不同已存模型及各自精确资产版本。每个候选保留独立成功/失败/部分输出 |
| `extract-variables` | `promptContent, extractionModelKey, existingVariableNames?` |
| `generate-variable-values` | `promptContent, variables, generationModelKey, contextVariables?` |
| `model-list` / `model-test` | `modelKey`；复用已存连接的动态发现/连接检查 |
| `image-model-list` / `image-model-test` | `modelKey` 为已存图像配置 ID |
| `image` | 原 `ImageRequest`：`prompt, configId, inputImage?/inputImages?, modelId?` |
| `image-understand` | `modelKey` 加原图片理解请求的字段，连接配置由已存模型注入 |

`source` 是 `{favoriteId, assetId, versionId, expectedRevision}`，必须来自当前连接重新查询的资产目录。它可替代 optimize 的 targetPrompt、iterate 的 originalPrompt、test 的指定 promptField（默认 systemPrompt）或 evaluate 的工作提示词。`test-batch` 在每个候选里分别放 `source/promptField`。版本或 revision 不匹配即拒绝，不偷偷换用当前版本。test 的变量先校验再一次性替换，值中的占位符不会递归展开。

`inputRunId` 可以将成功优化的文本直接交给 test，或将成功测试的原输入/输出快照交给 result 评估。先 `po_runs_start`，再轮询 `po_runs_get`；成功启动不代表执行成功。批次顶层 succeeded 代表编排结束，还须检查每个候选的 status。取消会保留已收到的文本，但不能保证服务商停止已提交的工作/计费。失败不伪装成成功结果。

`po_runs_save` 默认只归档，不修改当前草稿、收藏正文或采纳答案。重启桌面后，从顶部 **「MCP 运行成果」** 按 runId 或列表重开；原变量工作区 **「已保存比较」** 仍是独立入口。删除须带最新 `expectedUpdatedAt`，保留最小防重标记，旧重试或备份不能复活已删除运行。记录最多 200 条非删除项、总载荷 32 MiB；到限显式拒绝，不自动清理用户成果。

## 文本对照与 Skill

在同一新入口中，用 `po_sources_list` 返回的 `sourceId` 调用 `po_sources_open`，指定 `access: "compare"`。其返回的 `connectionId` 用于 `po_models_list`、`po_assets_*`、`po_tests_*` 和 `po_comparisons_*`。这些工具支持预览实际模型参数、对照同一收藏的两个模型或同一模型的两版提示词，以及保存和回读完整原始结果。[工具调用说明](../../packages/mcp-server/README.md#桌面文本比较模式)

配置新命令后，在包含仓库 Skill 的 Codex 项目里可调用 `$prompt-optimizer-compare`。提供桌面来源、变量工作区的收藏及版本、两个已存模型和共用变量，并说明是否执行与保存。Codex 请求确认模型调用时，可核对预览后确认本次执行。保存后在桌面变量工作区的 **「已保存比较」** 中输入返回的 `comparisonId` 即可重开。[Skill](../../.agents/skills/prompt-optimizer-compare/SKILL.md)

## 图片资源与完整备份

`po_resources` 支持 `images.list/get/save/delete`、`package.export/import`。必须保持本次源码构建的 Windows 桌面已就绪；由其真实 renderer 访问现有 IndexedDB，Node 不猜测或直接修改浏览器数据库。桥按同源数据目录的随机命名管道和临时秘密授权，不监听 TCP/HTTP，不返回管道秘密。桌面未启动或尚未就绪时返回错误。

- `store` 是 `imageCache` 或 `favoriteImages`；save/get 使用显式绝对 `file` 路径，save 需 MIME。get/export 不覆盖已有文件。
- save 不替换内容不同的现有图片，不触发自动淘汰。delete 需要 get/save 返回的 digest，并在刷新会话后拒绝删除仍被工作区/收藏引用的图片。
- `imageCache` 的未引用图片仍受产品原有垃圾回收规则约束。需要长期保留时，应先建立有效的工作区引用或收藏图片引用；资源传输成功不表示已自动建立引用。删除已不存在的图片返回 `alreadyAbsent: true`。
- package 导出/导入使用原完整资源包实现，包含应用 JSON、收藏、图片与校验清单；两者都须明确 `includeCredentials: true`。输入文件最多 20 MiB，桥响应最多 32 MiB；更大的资料使用原桌面备份 UI，不拆包绕过限额。
- import 通过原会话恢复协调器、完整包校验及容量/哈希预检；正在运行的工作或保存冲突会阻止恢复。成功回执后刷新桌面，避免旧内存会话自动保存回去。
- 每个变更使用独立 requestKey；`RESOURCE_RESULT_UNKNOWN` 表示结果未能确认，先检查实际资料/已有回执，不能换一个 key 重复执行。资源请求按顺序执行，避免上一条回执送达与 renderer 释放工作之间的竞争。

`workspaces/settings/variables/data` 的直接写操作在检测到活动 renderer 时返回 `DESKTOP_STATE_IN_USE`，避免当前页面的未保存状态被替换；关闭桌面再做这些操作，完成后重开。需要在运行中的桌面整体恢复时使用受协调的 package.import。收藏、模型、模板等外部改动也应重新打开对应页面确认，不能把数据库写成功等同于当前页面已重新载入。MCP 的模型联网使用 Node 配置，不自动继承 Electron 的代理或原生图片格式转换能力；本轮没有承诺所有第三方服务商都在真实远端验收通过。

## 本地验证入口与边界

```powershell
pnpm --filter @prompt-optimizer/core exec vitest run --config vitest.desktop-business.config.ts
pnpm --filter @prompt-optimizer/mcp-server test:desktop-business
pnpm --filter @prompt-optimizer/mcp-server test:desktop-readonly
pnpm --filter @prompt-optimizer/mcp-server test:desktop-stdio
pnpm --filter @prompt-optimizer/ui exec vitest run --config vitest.desktop-business.config.ts
node --test scripts/desktop-ipc-handlers.test.mjs
node scripts/desktop-main-isolated.mjs
node scripts/desktop-business-ui.acceptance.mjs
```

完整 UI 验收脚本只运行开发依赖中的 Electron，创建独立合成 profile，以空 env 构建真实产品 UI，拒绝访问真实 env、写出隔离目录、服务商网络、更新器及外部导航。通过独立 MCP 入口和本机回环模型夹具执行优化→测试→评估→显式保存；随后真实界面查看并退出重开；资源桥使用真实 IndexedDB。证据留在脚本打印的 `.codex-run/po-desktop-main-r2-product-*`，含运行摘要、阶段报告和截图。

**回环夹具不是真实远端 LLM**，88 分仅验证结构/保存与展示，不证明优化质量。该验收没有调用付费服务商，也没有安装或发布桌面包、注册系统 MCP 配置、修改真实 profile、提交或推送代码。远端模型质量/费用、Windows 安装器、跨平台资源桥和 Chrome 真实数据接入不在这份通过声明内。

## 逐项证据与实际缺口

2026-11-19 本地交付清单在 `.codex-run/desktop-mcp-delivery-20261119/manifest.json`，包含源码 SHA-256、命令与日志、原始隔离验收目录、运行标识及截图路径。它不是安装包或远端上线回执。

| 桌面功能 | 对应 MCP 入口 | 已有证据与未覆盖项 |
| --- | --- | --- |
| 收藏与准确版本 | `favorites` 写操作；`assets` 精确读取 | 新 stdio 从零创建、查找、修改收藏，选择旧/新版本；两个版本分别实际送入 Core 的测试请求。分类、标签等目录通过真实服务方法解析，但未逐个做原生界面回归 |
| 模板 | `templates`；运行的 `templateId` | 从实际内置模板目录选择并完成优化；自定义模板的每种编辑交互未逐项界面验收 |
| 文本模型与提供商 | `models/providers`；`model-list/model-test` | 两份独立已存配置、配置脱敏、动态列表及连接测试通过回环协议验收；未请求真实服务商 |
| 图像模型与提供商 | `imageModels/imageProviders`；`image-model-list/image-model-test` | 已接现有配置与适配器目录；未做远端图像模型发现、连接或生成验收 |
| 优化、迭代、多消息优化 | `optimize/iterate/optimize-message` | 优化经过真实 Core、SQLite、stdio 和桌面保存重开；迭代及多消息优化的远端行为未单独验收 |
| 单次、多消息与多版本/多模型测试 | `test/test-conversation/test-batch` | 单测、同模型双提示词、两个准确版本与两份模型配置、变量替换、部分输出和取消已验证；完整多消息测试与所有模型组合未穷举 |
| 提示词/结果评估 | `evaluate` | result 类型完成独立 runId、取回、归档和实际桌面重开；88 分为合成响应，不是质量评测。其他评估类型复用现有服务，但未逐个远端验收 |
| 历史与保存成果 | `history`；`po_runs_save/get/list/delete` | 优化进入原历史链、重复保存幂等；优化/测试/评估三份成果在真实 UI 首启和重启分别按 ID 重开；归档导入、防复活标记经过真实仓库测试 |
| 多消息上下文 | `contexts`、`workspaces` | 现有服务方法解析及工作区导入校验通过；没有承诺每个消息编辑控件都做过界面回归 |
| 全局变量 | `variables`；变量提取/生成运行 | 与 UI 共用名字校验、保留其他状态；变量化批测通过。提取/生成的远端输出未单独验收 |
| 工作区、设置与并发编辑 | `workspaces/settings` | 外部偏好更新重读、旧 revision 拒绝、原子提交与幂等、损坏数据拒绝已测；活动桌面拒绝直接替换状态，未实现所有页面实时无刷新同步 |
| 图片与理解/生成 | `po_resources images.*`；`image/image-understand` | 实际 renderer/IndexedDB 保存、读取、列出和删除通过；带收藏引用的图片随完整 ZIP 恢复并在进程重启后逐字节一致。引用保护由真实服务加合成 IndexedDB 单元验证；远端图像生成/理解与原生格式转换未验收 |
| 数据导入导出 | `data`、`po_data_export_file`、`po_resources package.*` | 真实 Core 数据/工作区回归、凭据查询脱敏、归档导入与完整资源 ZIP 导出/导入通过；大于资源桥限额的资料继续使用桌面 UI |
| 原比较和旧客户端 | `desktop-comparison`；原三个工具 | 两种冻结比较及保存重开、只读无写入、EOF 退出、原 stdio、HTTP `/mcp` 初始化/会话/三工具发现均通过；没有改变旧客户端配置 |

验收分层：Core 定向回归 **123** 项、MCP 业务单元 **10** 项、新入口实际 stdio **1** 项、只读单元 **14** 项、旧/比较实际协议 **7** 项、UI 单元 **2** 项、IPC 静态合同 **20** 项；另有实际 Electron main/preload 三阶段和完整产品 UI 两阶段。原生进程验收的网络审计为零外部请求；完整 UI 验收的三次模型请求仅发往隔离脚本创建的本机端点。
