# 桌面 MCP 与共用能力合同（草案 v0.2）

日期：2026-11-15。任务：`PO-MCP-DESKTOP-20261115`，第 4 轮只读接线修订。

状态：首版最小设计已获统筹接受；第 3 轮完成 provider 无关只读 reader，第 4 轮已通过真实 stdio/SQLite 验收，接入六个桌面只读工具，**尚未实现完整比较闭环，未发布**。源码初始基线为 `82a40b91ae9a0583f27bec121da03a157aacd42f`；reader 接受提交为 `cd9c2f9b`，本轮按统筹要求整合已接受的存储提交至 `2d6e04f9` 和业务验收 `05a1f12f`，没有另写存储实现。Chrome 稿 `044737ba` 的来源/生命周期要求已纳入共用 DTO，不采用其 fixture 样本协议。当前已实现范围及 Node 24 的 8 项路由测试、4 项真实协议验收见 [接入计划第 8 节](./mcp-desktop-plan.md#8-第-4-轮真实只读-desktop-mcp-stdio)。

## 1. 首版承诺与边界

从真实收藏选择一个 `pro-variable` 文本资产的**具体版本**，提供同一组变量，使用两个已保存且启用的文本模型配置进行测试，返回可复核快照，保存完整比较并能在产品中重新打开。人工比较必须闭环，模型评估可选，只有明确选择评估模型后才调用。先实现这一条完整路径，其他能力按第 8 节接续。

统筹已接受 Skill 场景文档 `439d8c5c` 的场景一，以及窄 `TextTestCapability`、完整比较记录、现有变量页只读 drawer、DataManager 纳入和可选 generic 评估的最小设计。第 6 节的保存/查看与最小单条删除均为**待实现能力**；收藏示例不能替代完整比较。具体物理布局、容量阈值及其他生产导出名在对应实施批次收敛，本轮只完成读取层及 desktop stdio 接线。

业务合同由 core 的窄接口拥有；MCP、桌面 UI、Chrome 只是调用方和宿主适配器。使用现有 MCP 进程和嵌入式存储，不新增数据库服务、后台服务、测试项目、数据集工作台或持久任务队列。

`list/prepare/get` 不调用模型、不写配置；`execute/evaluate` 会调用用户已配置的模型；只有显式 `save/delete` 修改已保存比较。复用已获授权的连接范围和用户指定动作，不新增逐工具确认流程。纯测试成功不代表已进入 Arena、优化历史或任何可由 UI 恢复的会话。

## 2. 连接真实来源

以下名字是**业务接口草案**，不是 SQLite provider 的导出名，也不是现有 MCP 工具名。MCP 工具可按 `po-<operation>` 薄映射，具体注册放下一阶段。

| 操作 | 输入 | 输出与约束 |
| --- | --- | --- |
| `sources.list` | 无业务数据参数 | 仅当前 owner 可见的 `SourceDescriptor`；不扫描浏览器目录，不读取密钥 |
| `sources.open` | `sourceId, access: 'read' \| 'execute' \| 'save'` | `connectionId, source, schemaVersion, capabilities`；desktop 仅打开已存在且迁移就绪的数据，Chrome 绑定已配对且就绪的页面 |
| `sources.close` | `connectionId` | 撤销该连接登记、终止执行并释放准备态/适配器自持资源；不关闭产品页面、共享服务或桌面自身连接 |

```ts
// ownerId 从 MCP 传输的会话上下文取得，不接受工具参数自报 owner。
interface SourceDescriptor {
  sourceId: string;                 // owner 范围内的不透明登记句柄，不是授权秘密
  kind: 'desktop' | 'web' | 'extension';
  label: string;
  origin?: string;                  // 浏览器实际 origin；不含 URL 路径/query
  extensionId?: string;
  browsingContext?: 'normal' | 'incognito' | 'unknown';
  installationLabel?: string;       // 仅供辨认，不能证明 Chrome profile 身份
  pageInstanceId?: string;          // 页面执行者；desktop Node 无此字段
  connectionGeneration: string;     // 重连新代次；旧句柄不复用
  sourceEpoch: string;              // 数据源身份/兼容状态，与连接代次不同
  productVersion: string;
  contractVersion: string;
  storageVersion: string;
  availability: 'connected' | 'disconnected';
  readiness: 'ready' | 'not-ready' | 'incompatible';
}
interface ExecutionHostDescriptor {
  kind: 'node' | 'web-page' | 'extension-page' | 'electron-main';
  adapterId: string;
  network: 'node' | 'browser' | 'electron';
}
```

第 4 轮只读实现是该合同的受限子集：`sources.open` 返回 `schemaVersion:'prompt-model/v1'`（读取层支持的资产业务合同），迁移状态单独由 `source.storageVersion` 表达；capabilities 仅 read=true、execute/save=false。当前身份只在 MCP 进程/打开租约内有效，identity 明示 sourceEpoch='open-lease'、stableAcrossRestart=false、inPlaceReplacementDetection=false。尚未实现持久库身份或原位文件替换检测，不把临时 sourceEpoch 当成完整来源身份，不写元数据补齐这些能力。

桌面首个适配器为 `kind:'desktop'` 来源、Node 宿主和 `network:'node'`；它不是共用快照的唯一宿主/网络取值。Chrome 的 Web/PWA 和扩展分别登记其来源，不能把 IndexedDB 与桌面库当成同一份数据；Chrome 接入独立于 SQLite。桌面目录由受信任的本地启动配置和定位器绑定，不接受工具中的任意路径；多 profile 显式选取。网页不能可靠取得 Chrome profile 路径/统一 ID，不伪造此身份。

每个业务请求携带 `connectionId`；路由层从它解析 owner、实际来源、页面实例和连接代次，并分配 requestId/有界 deadline。它们不由执行器返回值或工具自报字段覆盖。结果必须匹配原请求和原代次；模型 key 也在该来源内解析。HTTP 多客户端不共享无归属来源池；stdio 的 owner 随其连接生命周期结束。同 origin 多页可共享存储但内存状态独立，不能按最近活动页替换执行者；普通/隐身上下文分别登记。

访问级别累进：read 只读，execute 包含 read，save 包含 execute/read 及仅针对比较记录的显式删除。`execute` 允许执行端内部使用凭据但不输出；Chrome 模型凭据留在页面执行端，不能为复用 DTO 转存到 MCP。显式来源模式不运行旧的 `setupDefaultModel`，不自动创建 `mcp-default`，不把 MCP 环境变量回填到桌面配置；现有环境变量内存模式作为显式 legacy 模式保留。

`sourceEpoch` 是来源身份/兼容状态的业务标识，重新迁移、替换库或切换 profile 后失效；生成方式待存储接口确定。它不代替实体级并发令牌。

Chrome 配对/令牌只属于连接层：核验实际 origin、版本与允许范围，短期票据和连接秘密不进入业务 DTO、持久比较或日志。页面关闭/冻结、租约过期、owner 断开或 MCP 结束时，该代次失效，停止派发并尽力传播 AbortSignal；调用端及时收到 `SOURCE_DISCONNECTED`，拒绝迟到结果，不自动切源、重放或重新发起模型调用。pagehide 只是提前通知，失联仍由租约确认。重连使用新句柄/代次，必要时重新选择来源；不能承诺断连时跨进程 exactly-once。网络取消未获确认时记录 `completionUnknown:true`，不把失联等同供应商已取消；保存应答丢失时按第 6 节核对稳定 ID。回环认证/权限细节由 Chrome 线实现，不把其样本动作/envelope 升格成业务合同。

已核对的存储事实：`@prompt-optimizer/core/node` 已导出并接受 `openExistingDesktopStorage(absoluteUserDataPath, options?) → {provider,migration}`，只打开已有、完成迁移的兼容数据库，使用原生 `readOnly` 和连接内 `query_only`。MCP 只使用这个入口，结束时仅 `close()`；`flush()` 属于被拒绝的写操作。固定文件为 `prompt-optimizer-data.sqlite`；迁移标记位于 `storage_metadata` 的 `legacy-json-migration`，JSON `version=1`。这些信息属于连接适配器内部。`openDesktopStorage` 和普通 `new SQLiteStorageProvider` 仍是可能创建/迁移的 bootstrap 路径，**不能充当本合同的 open-existing 入口**。本轮未另写存储实现。

本合同的 open-existing“无副作用”准确指：不创建 profile/数据源或业务库，不执行 DDL、业务迁移、默认配置/环境变量写回。SQLite 必要锁及 WAL/SHM 的创建、更新、回收行为需按连接模式单独说明和验证；不承诺所有文件内容/时间戳绝不变化，也不能因此启用会建库/迁移的 bootstrap。

## 3. 发现与输出白名单

| 操作 | 输入 | 允许输出 |
| --- | --- | --- |
| `models.list` | `connectionId, cursor?, limit?` | `configKey, name, enabled, providerId, modelId, capabilities, revision, executable, unavailableReason?` |
| `assets.list` | `connectionId, modeKey?, query?, cursor?, limit?` | `favoriteId, assetId, title, modeKey, tags, currentVersionId, versionCount, updatedAt, revision` |
| `assets.getVersion` | `connectionId, favoriteId, assetId, versionId` | 对应文本 `content`、`version/versionId`、变量声明 `name/required/type/options`、上述身份字段、`revision` |

`revision` 是实体内容一致性令牌，不能单凭 `updatedAt` 判冲突。列表默认 20、上限 100，游标绑定来源和筛选条件；返回中明确缺失、损坏或不支持的项，不回退成内存默认模型。

对可能含凭据的模型实体，公开 revision 使用连接内不透明快照句柄，原始比较值只留内部；不输出含密钥配置的未加保护内容摘要。资产 revision 也必须绑定来源，不接受别的 profile 的同名资产令牌。

白名单必须逐字段构造，不能 `...modelConfig`、`...metadata` 或导出整个 storage。禁止输出 `connectionConfig`、API key、headers、代理凭据、环境变量、任意自定义连接字段；URL 也可能带凭据，列表不输出端点。模型能力只包括工具/推理支持和上下文长度等显式字段。`executable` 表示配置/宿主能力满足条件，不表示网络或模型调用已成功；本地模型不强制要求 API key。

收藏正文和用户变量是用户主动选取的业务内容；不因“列收藏”附带全部正文、示例、变量默认值或来源 URL。读取指定版本时才返回正文。资产可由 `promptAssetFromFavorite` 纯投影获得；legacy 的合成 `current` 版本必须与收藏 `revision` 一起绑定，不能当作不可变历史 ID。严禁为读取而先创建会自动初始化/迁移的 `ModelManager` 或 `FavoriteManager`。

第 3 轮对应实现为 `createReadonlyAssetReader(storage, {sourceId, sourceEpoch})`，storage 的类型仅包含 `getItem`；它不是 sources.open，不负责目录/迁移/owner 授权或 provider 关闭。提供 listModels/listAssets/getAssetVersion，只输出上述白名单。所有模型暂返回 `executable:false`，因为本轮未装配执行宿主；旧模型只描述已存身份并标记需迁移，不调用会补默认模型的转换/manager。没有向外暴露可误序列化的私有模型配置接口，后续执行不能从这些公开描述反推完整配置。

revision 是每个 reader 独立临时 HMAC 密钥签发的确定性快照令牌：对规范化后的真实原记录、source scope 和实体身份计算，同一 reader 的相同快照稳定，任意记录变化使令牌变化；不输出未加保护的凭据摘要，新连接须重新发现。分页游标同时绑定完整集合快照及筛选条件。缺 key、损坏结构、未知 schema、错误版本均明确拒绝，不落盘修复、不用默认数据；明确保存的空集合仍是合法空列表。旧收藏只有既有纯投影 current，不伪造 previous 或未保存历史版本。代码/测试详情见接入计划第 7 节。

## 4. 准备、预览与执行快照

```ts
// 草案；JsonValue 为有限 JSON 值，所有输入在边界进行 schema 校验。
interface PrepareTextTest {
  connectionId: string;
  source: {
    favoriteId: string;
    assetId: string;
    versionId: string;         // 不接受 latest、previous 或工作稿别名
    expectedRevision: string;
  };
  variables: Record<string, string>;
  candidates: [
    { id: 'a'; configKey: string; expectedRevision: string },
    { id: 'b'; configKey: string; expectedRevision: string },
  ];
}
interface PreparedTextTestPreview {
  preparedId: string;
  comparisonId: string;             // 本组预分配的稳定保存 ID
  executionSource: SourceDescriptor; // 由登记项补入，不接受执行器伪造来源
  previewRevision: string;
  expiresAt: number;
  source: PrepareTextTest['source'];
  rawPrompt: string;
  variables: Record<string, string>; // 仅实际引用值及使用的预定义值
  messages: Array<{ role: 'user'; content: string }>;
  candidates: Array<{
    id: 'a' | 'b'; runId: string;
    configKey: string; name: string; providerId: string; modelId: string;
    effective: PublicEffectiveConfig;
    fingerprint: string;
  }>;
  warnings: string[];
}
interface PublicEffectiveConfig {
  parameters: Record<string, unknown>; // 通过批准的参数 schema 的可公开值
  parameterCoverage: 'declared';      // 不是远端服务的全部隐含默认值
  omittedParameterNames: string[];
  requestParameters?: Record<string, unknown>; // 执行适配器真正提交给 SDK 的公开参数
  requestEvidence: 'pending' | 'captured';
  host: ExecutionHostDescriptor;
}
```

`tests.prepare(input)` 在同一次逻辑准备中验证版本、变量和两个模型，深拷贝解析结果。任一候选不合法就不产生可执行准备态，不先启动 A 再发现 B 无效。首版固定使用已保存配置中的模型，不在请求里修改模型、参数或连接；以后可复用 `resolveRuntimeTextModel` 做明确的请求级选择。

变量优先级建议与现有变量页对齐：已保存全局变量 → 本次输入 → 计算出的 `currentPrompt/userQuestion`。收藏声明的默认值首版只作提示，缺值仍报错，不静默补齐。输入不能覆盖预定义变量和危险属性名；只输出实际引用值，其他全局值不进入快照。字符串空白值按现有缺失规则拒绝，`"0"` 是有效值。变量页的 `.trim()`、禁止模板语法和变量名规则沿用现有定义。

必须提取 `buildPromptExecutionContext` 及其变量校验为 core 纯函数，保持一次替换；变量值中的 `{{literal}}` 保留为文字。**已渲染消息不能再交给 `testCustomConversationStream` 做第二次 Mustache 替换。**首版共用执行器将编译后的 `messages` 直接传给现有 `llmService.sendMessageStream(..., { configSnapshot })`。该路径已有 Arena 使用证据；执行前冻结的完整 `configSnapshot`（含调用所需凭据）只留进程内，退出/过期释放，不落盘、不输出。

预览与执行使用同一份编译结果和配置副本。`tests.execute({connectionId, preparedId, previewRevision})` 不接受替换后的正文/变量/模型；开始前重验来源 epoch、资产和模型 revision，变化报 `STALE_PREPARATION` 并要求重新预览，不静默换模型或继续过期配置。开始后用户修改设置不改变正在运行的请求。

`effective.parameters` 基于 `describeRuntimeModel` 和参数合并规则，表示客户端配置及声明默认值；对外再按可信 adapter 定义的可公开参数及类型做白名单投影，不能直接信任持久化 modelMeta 中任意扩展 schema，也不能把该函数的递归黑名单视为充分的安全边界。未批准的自定义参数仍可按原配置执行，记录其名称及遗漏状态，禁止声称快照包含它的值。

必须补齐实际请求参数证据：在各已支持文本 adapter 的“归一化后、交给 SDK 前”增加窄的请求描述回调，填入 `requestParameters` 和 `requestEvidence:'captured'`。描述包含实际 model/API 类型和批准的参数，不含 headers、连接地址或消息以外的任意 body。它与冻结配置/编译消息关联，不能通过重读当前配置生成。适配器在发出网络请求前校验描述；若出现与预览不兼容的参数转换则停止并重新准备。远端默认值和 SDK 内部未观察到的转换保持 unknown，不用 declared 值冒充已发送值。尚未接入该证据回调的 adapter 不作为首版支持范围；首条真实验收需明确所选两个模型的 adapter，不能以全部 provider 重写作为先决条件。

快照最少包含：`runId/preparedId`、登记项确认的来源描述（含 sourceId/sourceEpoch/页面实例/连接代次）和实际宿主/网络描述、明确资产版本、原始和实际消息、实际引用变量、模型配置 key/显示名/provider/model 身份、净化的生效参数及遗漏情况、请求指纹、起止时间、`status/output/reasoning/errorCode?`。持久化只保存可公开的历史来源/宿主证据，不存 owner 凭证、连接令牌或可继续控制页面的句柄；历史 sourceId/代次仅作 provenance，重读时必须通过当前有效连接重新授权，不能拿旧 ID 恢复权限。

指纹延续现有“实际提示词/输入/模型/生效配置”的语义，记录算法版本；旧变量页的指纹不包含参数，不能当成完整执行身份。优先复用 Arena 的稳定序列化构造核心证据，额外绑定资产版本与变量。内部凭据 revision 只用于失效判断，不把密钥或其可离线猜测的摘要混入公开指纹。

## 5. 执行、取消与比较

| 操作 | 语义 |
| --- | --- |
| `tests.execute` | 在本次工具调用内等待两次测试结束并返回快照；复用现有并行/顺序策略，无独立队列；每个候选独立记成功/失败 |
| `runs.get` | 按准备阶段已返回的 `runId` 读取当前/终态快照；仅原连接可访问 |
| `runs.cancel` | 按 `runId` 中止当前请求的 `AbortController`；幂等返回 `cancelling/alreadyTerminal`，不操作 Electron 的 `event.sender` |
| `evaluations.prepareCompare` | 输入两个成功 `runId`、评估 `configKey/expectedRevision` 和可选 `focus`，返回 `evaluationId, previewRevision, evaluationRequest, evaluator, templateRevision` |
| `evaluations.execute` | 使用上述冻结证据、模板和评估模型运行一次 generic compare，返回已有 `EvaluationResponse` 的白名单投影及评估执行快照 |

执行状态：`prepared → running → success | error | cancelled`。取消优先检查终态；已取消后的迟到 token/complete 不改成成功。部分输出可随取消/失败快照返回，标记 `partial: true`，默认不能评估或保存为成功示例。流适配器可能只调用 `onError` 而不抛错，或仅回传完成正文；执行器必须同时捕获两类结果，不能把 Promise resolve 直接当成成功。空正文结束也不能静默成功。

MCP 请求取消/连接断开须传播 signal；进程退出中断所有活跃执行，不承诺断点续跑。进程内按连接维护有界准备态和快照（建议上限 32 组、10 分钟无活动过期；运行中不因 TTL 被删除，活跃超限直接报忙）。重复执行同一个 `preparedId` 只返回原状态/结果，不产生第二次计费请求；新一轮必须重新 prepare。进程重启后不能依赖该去重，返回 `PREPARATION_EXPIRED`，保存的比较另按第 6 节读取。评估使用同样的有界状态、按 evaluationId 取消/查询与去重；未运行即取消的候选保持 cancelled，不再发出请求。

取消控制请求不能被正在等待的 execute 串行阻塞；首版应使用现有 MCP 取消信号或能同时分发工具调用的适配器。原型未验证 MCP 传输层并发和取消。

人工比较可查看同组的全部状态；可选模型评估只接受同一来源、同一准备组的两个成功快照。共用测试用例来自冻结变量，两个 `EvaluationSnapshot` 来自运行时证据，不能用当前 UI 状态重建。评估模型必须显式选择，不默认另造 MCP 模型。

映射现有 `CompareEvaluationRequest`：`mode={functionMode:'pro',subMode:'variable'}`，`target.workspacePrompt=选中版本原文`（仅满足现有评估输入字段，不创建工作稿）、`testCases=[同一变量用例]`，两个 `promptRef.kind='custom'` 并保留外层资产版本引用。`compareHints={mode:'generic',hasSharedTestCases:true,hasSamePromptSnapshots:true,hasCrossModelComparison:true}`；这里要求两个不同模型配置，真实 provider/model 身份也随快照列明，不能把重复配置称为两种模型。

现有 UI `buildCompareEvaluationPayload` 要求 workspace 来源，不能直接调用。提取其规范化/共享输入判定的纯部分，保留原 UI 的 workspace 门槛；core generic compare 支持 custom 快照。首版不分配 target/baseline 角色，不用跨模型结果宣称提示词优化。评估产生的 `patchPlan` 只返回建议，不能自动改收藏。

评估服务仍按 modelKey 读配置/模板；下一阶段需增加窄的冻结依赖路径，使校验、消息构造和实际 LLM 调用使用同一副本。不能仅在预览中展示冻结配置、执行时再读活动 manager。generic compare 一次评估；structured compare 可能包含多次 judge/synthesis 调用，后续单独声明成本与取消范围。

## 6. 保存、查看与单条删除比较（已接受设计，待实现）

现状没有经过验证的、可独立寻址的完整比较结果仓库或“按 MCP runId 打开”入口。`PromptTestRunSet` 是可复用类型，UI 会话投影不是可直接追加的结果仓库；两个收藏示例也不能保留比较关系、失败/取消和可选评估。统筹已接受新增窄的完整比较记录与查看入口，DTO 草案复用现有运行类型：

```ts
interface SavedComparisonV1 {
  schemaVersion: 'saved-comparison/v1';
  id: string;                      // 来源内稳定 comparisonId
  savedAt: number;
  executionSource: SourceDescriptor; // 历史公开来源证据，不是活跃连接授权
  source: PrepareTextTest['source']; // 保存时的来源引用，允许以后悬空
  request: { rawPrompt: string; messages: PreparedTextTestPreview['messages'];
    variables: Record<string, string> };
  runSet: PromptTestRunSet;         // 已有 core 类型；每项 metadata 承载白名单执行快照
  evaluation?: { status: 'success' | 'error' | 'cancelled';
    snapshot: PublicEvaluationSnapshot; response?: EvaluationResponse };
}
interface SaveComparison {
  connectionId: string;
  preparedId: string;              // 保存整组，不任意删掉失败候选
  evaluationId?: string;           // 必须属于本组且已终止
  saveKey: string;                 // 重试同一个保存意图时复用
}
// PublicEvaluationSnapshot 是新增 DTO：评估模型身份/公开参数、实际评估消息、
// 模板 ID/版本/内容、focus、参与 runId、时间和状态；无凭据。
```

运行必须全部终止后保存；成功、失败、取消和 partial 输出原样保留。`PromptTestRun.status` 只有 success/error，取消映射 error，同时在 `metadata.execution.status='cancelled'` 保留真值，查看器读取它而不是把取消误标成普通成功。typed 模型参数放净化 execution metadata；`PromptRunInput.parameters` 继续表达字符串变量，不混用。

`comparisons.save` 在选定来源的现有结构化主存储中保存不可变比较，不新增数据库服务。comparisonId 在 prepare 时分配，同一执行组换 saveKey 重试也不能生成第二份记录；同 key/同组同内容返回同一 ID，不同内容报 `IDEMPOTENCY_CONFLICT`。“同内容”比较冻结业务载荷，不把重试时的连接句柄、连接代次或服务端生成的 savedAt 当作新意图；原始历史来源证据不被重连值改写。记录、去重关联和必要索引的提交必须具有原子可见性；物理键布局、是否按条/分片以及索引方式在实现时根据已接受存储事务能力决定，**不把所有结果写进单个巨大 JSON 文档作为合同要求**。

先完成可选评估再保存；已保存后再附加评估属于后续显式更新能力，本版不悄悄修改不可变记录。原收藏随后修改或删除不改写冻结证据；引用可悬空，仍能在比较查看器读旧内容。纯记录保存不要求源收藏当前 revision 不变，因为它不修改收藏；来源 epoch 必须仍是本次连接的数据源。

容量初始可调建议仍为单条 1 MiB、当前来源已保存比较的有效载荷合计 16 MiB；不是已接受的固定阈值、单一文档约束或现有 provider 限额。只接受文本 JSON，拒绝 inline 图片；超限报 `RESULT_STORAGE_LIMIT`，用户可删除指定已保存比较后再保存，不自动淘汰结果，也不要求整库清空。导出/导入/设备迁移将这些记录作为正式业务数据纳入现有 DataManager；保留稳定 ID/证据并检查目标来源的 ID/去重冲突，不静默复活删除标识。具体布局、预算计算和必要元数据的维护一并实现，不私藏在 MCP 内存。

`comparisons.list({connectionId, favoriteId?, cursor?, limit?})` 仅返回 `id/source/title/savedAt/status/evaluationStatus/revision` 等摘要；`comparisons.get({connectionId, comparisonId})` 返回该白名单记录及 revision。当前连接决定读取哪个真实来源，历史 sourceId 不授予访问权；重连后在明确选定的同一数据源中仍可按 comparisonId 查询。保存返回：

```json
{
  "saved": true,
  "comparisonId": "comparison-fixture-001",
  "viewTarget": { "kind": "saved-comparison", "sourceId": "desktop-selected", "comparisonId": "comparison-fixture-001" },
  "visibility": "reload-required"
}
```

`viewTarget` 是**已接受设计、待实现的语义定位对象**，不是现有深链接；其中 sourceId 来自返回时的有效连接，不拿历史句柄路由。变量工作区增加“已保存比较”入口及轻量只读 drawer：列当前来源的比较、按 ID 选中，呈现冻结输入、模型运行信息、两列原输出、失败/取消及可选评估；也可从收藏详情按 favoriteId 筛选。同一来源的孤立记录可从工作区入口访问。只读查看不替换工作稿、不切换收藏版本、不覆盖未保存编辑；列表提供仅针对指定比较的删除动作。新增成本为窄的读写 repository/DTO、MCP 保存/查询/删除映射、主进程/renderer 接口、列表/详情 drawer、DataManager 纳入及相应回归；无需新的工作台或后台调度。

最小删除接口：`comparisons.delete({connectionId, comparisonId, expectedRevision})`，仅限具有比较写权限的有效连接和显式选定的记录；在原子操作内校验记录 revision，删除其载荷、仅属于该记录的索引/引用并更新比较容量占用。不修改模型、收藏、原提示词版本、工作区、其他比较或数据库 schema，不取消模型请求。已删除的同一记录重试返回 `alreadyDeleted`；记录变化报 `REVISION_CONFLICT`；未知 ID 返回 `COMPARISON_NOT_FOUND`，不扩大为批量清理。UI 删除当前项后关闭其详情并刷新列表，保持当前工作稿。

去重边界分开约定：执行去重只在 owner/连接代次/preparedId 的活跃进程状态内成立，重连不自动重发；持久保存去重属于选定数据源的比较命名空间，以 comparisonId/saveKey 识别，不因 owner 或页面重连而丢失。删除载荷时保留必要的最小删除/去重标识（ID、去重关联、提交身份与删除状态，不含正文/输出），迟到或显式保存重试命中后返回 `COMPARISON_DELETED`，即使换 saveKey 也不得复活旧 comparisonId。首版不提供隐式恢复；新执行使用新 ID。标识生命周期/体积在实现时明确，不能随载荷删除而无声丢弃其防重承诺。

断连/超时可能发生在写入已提交但响应未到达时，返回 `WRITE_OUTCOME_UNKNOWN`，不能断言未保存或自动重写。恢复后明确选回该数据源，先按 comparisonId 查询已保存/已删除状态，再由既有工作流决定是否显式重试原 saveKey；不承诺跨断连的执行 exactly-once。删除同样允许按稳定 ID 核对，不因丢响应转而清理其他数据。

数据库提交、变更通知、UI 重新加载是三个阶段。首版保存返回 `reload-required`；drawer 每次打开显式重新读取比较记录，已打开时提供刷新并保留仍存在的所选 ID，不依赖不存在的跨进程通知；已删除项不继续显示成可用结果。只有实际打开并渲染该 comparisonId 才算“产品中查看”验收通过；写库成功不能替代 UI 验收。现有 `favorite-updated` 只是窗口内事件，独立 Node MCP 不能触发它来证明页面已刷新。

现有 `PromptTestRun → promptExampleFromTestRun → 收藏示例` 可作后续可选派生，不替代本节保存。若追加示例，需要在同一收藏原子修改内校验版本/revision/去重并保护 metadata、体积预算。隔离验证确认：同时有 legacy `reproducibility` 字段时，单改 `metadata.promptAsset.examples` 会被 `refreshPromptAssetFromFavorite` 重新投影覆盖；必须提取同步新版/旧版表示的业务变换，不能盲调 `updateFavorite`。

本节不写当前 `pref:session/v1/*` 或 ArenaState。新的比较记录在进程重启后按 comparisonId 查询；进程内 runId/prepare 去重不会因此变成可恢复任务。首次读取没有比较记录表示空列表，不落盘初始化；显式 save 创建记录，显式 delete 仅清理选中比较。

## 7. 宿主能力与错误

| 情况 | 首版支持范围 |
| --- | --- |
| 桌面已关闭 | 在库已由桌面完成迁移、补齐 open-existing 且 Node 兼容时，列数据、准备、Node 文本执行/取消、可选评估、保存/读取比较；没有 UI 激活/刷新 |
| 桌面已打开 | 上述能力以跨连接并发和来源就绪检查通过为前提；共享磁盘结构化数据，不读取未保存草稿，不替换活跃会话 |
| 桌面代理/证书/网络配置 | Node 不自动等于 Electron；首个桌面适配器报告 `host.network:'node'`。共用 DTO 同时支持 browser/electron 网络描述，不因此声称已实现这些适配器；依赖桌面代理的模型须明确宿主可用性 |
| 图片与工具 | 首版拒绝；renderer 的两个图片 IndexedDB、图片读取租约和 Electron 图片归一化不随 SQLite 结构化数据共享 |
| Chrome 调用 | 共用资产投影、准备/快照/比较/保存/删除语义；按 owner、实际来源、页面实例和连接代次派发，页面失联不切换执行者；权限、CORS、图片和 UI 刷新由 Chrome 适配器负责，独立于 SQLite |

需要 Electron 网络的后续实现可在现有 MCP 进程嵌入轻量网络适配，复用确定后的网络代码；若依赖活跃主进程则明确要求桌面打开并提供受限宿主桥，不能直接调用 preload IPC，也不能新增独立常驻服务。该部分尚未实现。

稳定业务错误：`SOURCE_NOT_CONFIGURED / SOURCE_NOT_FOUND / SOURCE_NOT_READY / SOURCE_DISCONNECTED / SCHEMA_UNSUPPORTED / ACCESS_DENIED / INVALID_INPUT / ASSET_VERSION_NOT_FOUND / MODEL_UNAVAILABLE / HOST_CAPABILITY_UNAVAILABLE / STALE_PREPARATION / PREPARATION_EXPIRED / RUN_NOT_FOUND / RUN_BUSY / REVISION_CONFLICT / IDEMPOTENCY_CONFLICT / COMPARISON_NOT_FOUND / COMPARISON_DELETED / WRITE_OUTCOME_UNKNOWN / RESULT_STORAGE_LIMIT / STORAGE_BUSY / EXECUTION_FAILED`。错误返回 code、可公开消息和重试建议，过滤 provider 原始错误中的 URL、headers、凭据和请求体；日志同样遵守白名单。

## 8. 已有能力如何完整接续

| 产品能力 | 已有实现 | 共用合同接续与首版状态 |
| --- | --- | --- |
| 多模型测试/比较 | LLMService、Arena、文本工作区、EvaluationService | 首版纵向路径；请求准备和结果协议需提取 |
| 收藏版本与示例 | PromptAsset/PromptExample、FavoriteManager | 首版只读指定版本；追加示例、内容编辑/新版本以后显式动作 |
| 保存完整比较并查看/删除 | PromptTestRunSet 可复用；独立保存/读取/查看入口缺失 | 最小记录、现有页面 drawer、DataManager 纳入已接受，均待实现；补齐仅针对比较的单条删除 |
| 优化/迭代/模板 | PromptService、TemplateManager、HistoryManager；现有三个 MCP 工具 | 后续增加来源/模型/模板显式选择和冻结，保留现有优化历史语义 |
| 单结果/提示词/迭代评估 | EvaluationService 的 result/prompt-only/prompt-iterate | 后续复用相同快照和模板冻结路径，不复制评分实现 |
| 多消息/上下文/变量生成 | CustomConversationRequest、context repo、变量提取/生成服务 | 后续为各模式提供窄的准备器；保持消息角色和工具边界 |
| Arena、图片测试和图片评估 | ArenaState、ImageService、图片资产库、文生图评估 | 后续宿主适配与结果导入协议；不以文本首版为由重写这些 UI |
| Chrome/Skill | 各自负责连接验证/工作流 | 消费本合同，不能自行复制变量、模型冻结、评估或保存语义 |

已接受的是本稿明确的最小设计范围；本轮只读层以外的生产实现、物理布局、阈值及真实 MCP 验收仍未完成。候选改写/受控复测仍在下一步；下一阶段按统筹安排接续已接受存储接口，本轮不启动默认 MCP singleton、不读真实 profile、不触碰现存 SQLite/WAL/SHM、不轮询其他工作线。
