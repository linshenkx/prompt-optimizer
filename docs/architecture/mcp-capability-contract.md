# 桌面 MCP 与共用能力合同（草案 v0.1）

日期：2026-11-15。任务：`PO-MCP-DESKTOP-20261115`，轮次 1。

状态：供统筹审查的设计，**不是已发布接口**。本工作树源码基线为 `82a40b91ae9a0583f27bec121da03a157aacd42f`。统筹补充的存储实现 `77b8d1c6`、说明 `b82b877e` 已作为设计事实审读，未合并到本分支；应用实际主入口的隔离验收与真实现场恢复仍未完成，不能描述成存储全阶段通过。实现拆分和验证见 [接入计划](./mcp-desktop-plan.md)。

## 1. 首版承诺与边界

从真实收藏选择一个 `pro-variable` 文本资产的**具体版本**，提供同一组变量，使用两个已保存且启用的文本模型配置进行测试，返回可复核快照，保存完整比较并能在产品中重新打开。人工比较必须闭环，模型评估可选，只有明确选择评估模型后才调用。先实现这一条完整路径，其他能力按第 8 节接续。

统筹已接受的业务输入为 Skill 场景文档 `439d8c5c` 的场景一。已有收藏示例不足以表示完整比较；第 6 节提出一个最小的保存结构和现有页面内的只读查看入口，**两者都是新增能力，需统筹接受后实现**。不以两个示例已保存代替此交付。

业务合同由 core 的窄接口拥有；MCP、桌面 UI、Chrome 只是调用方和宿主适配器。使用现有 MCP 进程和嵌入式存储，不新增数据库服务、后台服务、测试项目、数据集工作台或持久任务队列。

`list/prepare/get` 不调用模型、不写配置；`execute/evaluate` 会调用用户已配置的模型；只有显式 `save` 写业务数据。纯测试成功不代表已进入 Arena、优化历史或任何可由 UI 恢复的会话。

## 2. 连接真实来源

以下名字是**业务接口草案**，不是 SQLite provider 的导出名，也不是现有 MCP 工具名。MCP 工具可按 `po-<operation>` 薄映射，具体注册放下一阶段。

| 操作 | 输入 | 输出与约束 |
| --- | --- | --- |
| `sources.list` | 无业务数据参数 | 已配置的来源描述：`sourceId/label/kind/availability/readiness`；不扫描浏览器目录，不读取密钥 |
| `sources.open` | `sourceId, access: 'read' \| 'execute' \| 'save'` | `connectionId, sourceId, sourceEpoch, schemaVersion, capabilities`；仅打开已存在且迁移就绪的数据 |
| `sources.close` | `connectionId` | 终止该连接的执行，释放准备态及本连接的数据库句柄；不关闭桌面连接 |

`kind` 首版只有 `desktop`；Chrome 将来可增加独立来源，不能把它的 IndexedDB 与桌面库当成同一份数据。目录由受信任的本地启动配置和存储线的定位器绑定到 `sourceId`；普通工具调用不接受任意文件路径。存在多份桌面 profile 时显式选取，不依赖当前目录、模糊扫描或硬编码默认目录。

每个请求都携带 `connectionId`。句柄绑定 MCP 调用会话、来源和访问级别，不能跨会话借用。访问级别累进：read 只读，execute 包含 read，save 包含 execute/read。`execute` 允许内部读取凭据以调用模型，但输出不含凭据；`save` 表示已获得本次连接的写入授权，仍只执行调用中指定的保存动作。显式来源模式不运行旧的 `setupDefaultModel`，不自动创建 `mcp-default`，不把 MCP 环境变量回填到桌面配置。现有环境变量内存模式可作为另一个明确标记的 legacy 模式保留。

`sourceEpoch` 是来源身份/兼容状态的业务标识，重新迁移、替换库或切换 profile 后失效；生成方式待存储接口确定。它不代替实体级并发令牌。

已核对的存储事实：`@prompt-optimizer/core/node` 导出 `SQLiteStorageProvider(databasePath, options?)` 与 `openDesktopStorage(userDataPath, options?) → {provider,migration}`，provider 有 `close/flush`；固定文件为 `prompt-optimizer-data.sqlite`；迁移标记位于 `storage_metadata` 的 `legacy-json-migration`，JSON `version=1`。这些信息属于连接适配器内部。`openDesktopStorage` 会建目录/schema 并迁移，底层 provider 首次 get 也可能建库/DDL，**两者都不能充当本合同的 open-existing 入口**。需存储线补齐仅打开已有、验证迁移完成和兼容状态的连接能力，或另行接受受控桌面桥；本轮不自行补写存储实现。

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
  network: 'node';
}
```

`tests.prepare(input)` 在同一次逻辑准备中验证版本、变量和两个模型，深拷贝解析结果。任一候选不合法就不产生可执行准备态，不先启动 A 再发现 B 无效。首版固定使用已保存配置中的模型，不在请求里修改模型、参数或连接；以后可复用 `resolveRuntimeTextModel` 做明确的请求级选择。

变量优先级建议与现有变量页对齐：已保存全局变量 → 本次输入 → 计算出的 `currentPrompt/userQuestion`。收藏声明的默认值首版只作提示，缺值仍报错，不静默补齐。输入不能覆盖预定义变量和危险属性名；只输出实际引用值，其他全局值不进入快照。字符串空白值按现有缺失规则拒绝，`"0"` 是有效值。变量页的 `.trim()`、禁止模板语法和变量名规则沿用现有定义。

必须提取 `buildPromptExecutionContext` 及其变量校验为 core 纯函数，保持一次替换；变量值中的 `{{literal}}` 保留为文字。**已渲染消息不能再交给 `testCustomConversationStream` 做第二次 Mustache 替换。**首版共用执行器将编译后的 `messages` 直接传给现有 `llmService.sendMessageStream(..., { configSnapshot })`。该路径已有 Arena 使用证据；执行前冻结的完整 `configSnapshot`（含调用所需凭据）只留进程内，退出/过期释放，不落盘、不输出。

预览与执行使用同一份编译结果和配置副本。`tests.execute({connectionId, preparedId, previewRevision})` 不接受替换后的正文/变量/模型；开始前重验来源 epoch、资产和模型 revision，变化报 `STALE_PREPARATION` 并要求重新预览，不静默换模型或继续过期配置。开始后用户修改设置不改变正在运行的请求。

`effective.parameters` 基于 `describeRuntimeModel` 和参数合并规则，表示客户端配置及声明默认值；对外再按可信 adapter 定义的可公开参数及类型做白名单投影，不能直接信任持久化 modelMeta 中任意扩展 schema，也不能把该函数的递归黑名单视为充分的安全边界。未批准的自定义参数仍可按原配置执行，记录其名称及遗漏状态，禁止声称快照包含它的值。

必须补齐实际请求参数证据：在各已支持文本 adapter 的“归一化后、交给 SDK 前”增加窄的请求描述回调，填入 `requestParameters` 和 `requestEvidence:'captured'`。描述包含实际 model/API 类型和批准的参数，不含 headers、连接地址或消息以外的任意 body。它与冻结配置/编译消息关联，不能通过重读当前配置生成。适配器在发出网络请求前校验描述；若出现与预览不兼容的参数转换则停止并重新准备。远端默认值和 SDK 内部未观察到的转换保持 unknown，不用 declared 值冒充已发送值。尚未接入该证据回调的 adapter 不作为首版支持范围；首条真实验收需明确所选两个模型的 adapter，不能以全部 provider 重写作为先决条件。

快照最少包含：`runId/preparedId/sourceId/sourceEpoch`、明确资产版本、原始和实际消息、实际引用变量、模型配置 key/显示名/provider/model 身份、净化的生效参数及遗漏情况、请求指纹、起止时间、`status/output/reasoning/errorCode?`。公开快照和后续示例保存复用同一白名单。

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

## 6. 保存完整比较与 UI 读取（必须新增的最小能力）

现状没有经过验证的、可独立寻址的完整比较结果仓库或“按 MCP runId 打开”入口。`PromptTestRunSet` 是可复用类型，UI 会话投影不是可直接追加的结果仓库；两个收藏示例也不能保留比较关系、失败/取消和可选评估。建议新增一个窄的 `SavedComparisonV1`，复用现有运行类型：

```ts
interface SavedComparisonV1 {
  schemaVersion: 'saved-comparison/v1';
  id: string;                      // 来源内稳定 comparisonId
  savedAt: number;
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

`comparisons.save` 建议在同一现有结构化主库的一个新 KV 文档 `comparison-runs/v1` 中原子追加不可变记录（逻辑名字待接受），不建新 SQLite 表或服务。comparisonId 在 prepare 时分配，同一执行组即使换 saveKey 重试也不能生成第二份记录。文档同时保存 comparisonId 与 saveKey 的关联，单次 `updateData/CAS` 完成；同 key/同组同内容返回同一个 ID，不同内容报 `IDEMPOTENCY_CONFLICT`。先完成可选评估再保存；已保存后再附加评估属于后续显式更新能力，本版不悄悄修改不可变记录。原收藏随后修改或删除不改写冻结证据；引用可悬空，仍能在比较查看器读旧内容。纯记录保存不要求源收藏当前 revision 不变，因为它不修改收藏；来源 epoch 必须仍是本次连接的库。

建议每条记录最多 1 MiB、总文档最多 16 MiB；只接受文本 JSON，拒绝 inline 图片，超限报 `RESULT_STORAGE_LIMIT`，不自动删除旧结果。这是初版容量约束建议，需统筹接受；并非现有存储限额。首版不提供更新记录、单条删除、统计或数据集操作，现有明确授权的整库清空涵盖它。导出/导入/设备迁移需把该文档作为正式业务数据纳入现有 DataManager；导入时保留记录 ID 与证据并检查目标来源内 ID 冲突，不能只让 MCP 私藏这个 key。此处保留成本，不能把新增数据协议说成已有能力。

`comparisons.list({connectionId, favoriteId?, cursor?, limit?})` 仅返回 `id/source/title/savedAt/status/evaluationStatus` 等摘要；`comparisons.get({connectionId, comparisonId})` 返回该白名单记录。保存返回：

```json
{
  "saved": true,
  "comparisonId": "comparison-fixture-001",
  "viewTarget": { "kind": "saved-comparison", "sourceId": "desktop-selected", "comparisonId": "comparison-fixture-001" },
  "visibility": "reload-required"
}
```

`viewTarget` 是**待实现的语义定位对象**，不是现有深链接。建议在当前变量工作区增加“已保存比较”入口及轻量只读 drawer：列当前来源的比较、按 ID 选中，呈现冻结输入、模型运行信息、两列原输出、失败/取消及可选评估；也可从收藏详情按 favoriteId 筛选。同一来源的孤立记录可从工作区入口访问。只读查看不替换当前工作稿、不切换收藏版本、不覆盖未保存编辑。新增成本为一个窄的读写 repository/DTO、MCP 保存/查询映射、主进程/renderer 读取接口、一个列表/详情 drawer、DataManager 纳入及相应回归；无需新的工作台或后台调度。

数据库提交、变更通知、UI 重新加载是三个阶段。首版保存返回 `reload-required`；drawer 每次打开显式重新读取结果文档，已打开时提供刷新并保留所选 ID，不依赖不存在的跨进程通知。只有实际打开并渲染该 comparisonId 才算“产品中查看”验收通过；写库成功不能替代 UI 验收。现有 `favorite-updated` 只是窗口内事件，独立 Node MCP 不能触发它来证明页面已刷新。

现有 `PromptTestRun → promptExampleFromTestRun → 收藏示例` 可作后续可选派生，不替代本节保存。若追加示例，需要在同一收藏原子修改内校验版本/revision/去重并保护 metadata、体积预算。隔离验证确认：同时有 legacy `reproducibility` 字段时，单改 `metadata.promptAsset.examples` 会被 `refreshPromptAssetFromFavorite` 重新投影覆盖；必须提取同步新版/旧版表示的业务变换，不能盲调 `updateFavorite`。

本节不写当前 `pref:session/v1/*` 或 ArenaState。新的比较记录在进程重启后按 comparisonId 查询；进程内 runId/prepare 去重不会因此变成可恢复任务。首次读取缺少结果文档表示空列表，不落盘创建；只有显式 save 创建它。

## 7. 宿主能力与错误

| 情况 | 首版支持范围 |
| --- | --- |
| 桌面已关闭 | 在库已由桌面完成迁移、补齐 open-existing 且 Node 兼容时，列数据、准备、Node 文本执行/取消、可选评估、保存/读取比较；没有 UI 激活/刷新 |
| 桌面已打开 | 上述能力以跨连接并发和来源就绪检查通过为前提；共享磁盘结构化数据，不读取未保存草稿，不替换活跃会话 |
| 桌面代理/证书/网络配置 | Node 不自动等于 Electron；首版报告 `network:'node'`。依赖桌面代理才能调用的模型报宿主能力不可用，不能假装已复用 |
| 图片与工具 | 首版拒绝；renderer 的两个图片 IndexedDB、图片读取租约和 Electron 图片归一化不随 SQLite 结构化数据共享 |
| 未来 Chrome 调用 | 共用资产投影、准备/快照/比较/保存语义；来源连接、权限、CORS、图片和实时 UI 刷新由 Chrome 适配器负责 |

需要 Electron 网络的后续实现可在现有 MCP 进程嵌入轻量网络适配，复用确定后的网络代码；若依赖活跃主进程则明确要求桌面打开并提供受限宿主桥，不能直接调用 preload IPC，也不能新增独立常驻服务。该部分尚未实现。

稳定业务错误：`SOURCE_NOT_CONFIGURED / SOURCE_NOT_FOUND / SOURCE_NOT_READY / SCHEMA_UNSUPPORTED / ACCESS_DENIED / INVALID_INPUT / ASSET_VERSION_NOT_FOUND / MODEL_UNAVAILABLE / HOST_CAPABILITY_UNAVAILABLE / STALE_PREPARATION / PREPARATION_EXPIRED / RUN_NOT_FOUND / RUN_BUSY / REVISION_CONFLICT / IDEMPOTENCY_CONFLICT / RESULT_STORAGE_LIMIT / STORAGE_BUSY / EXECUTION_FAILED`。错误返回 code、可公开消息和重试建议，过滤 provider 原始错误中的 URL、headers、凭据和请求体；日志同样遵守白名单。

## 8. 已有能力如何完整接续

| 产品能力 | 已有实现 | 共用合同接续与首版状态 |
| --- | --- | --- |
| 多模型测试/比较 | LLMService、Arena、文本工作区、EvaluationService | 首版纵向路径；请求准备和结果协议需提取 |
| 收藏版本与示例 | PromptAsset/PromptExample、FavoriteManager | 首版只读指定版本；追加示例、内容编辑/新版本以后显式动作 |
| 保存完整比较并查看 | PromptTestRunSet 可复用；独立保存/读取/查看入口缺失 | 首版新增最小记录与现有页面 drawer，需明确接受其成本 |
| 优化/迭代/模板 | PromptService、TemplateManager、HistoryManager；现有三个 MCP 工具 | 后续增加来源/模型/模板显式选择和冻结，保留现有优化历史语义 |
| 单结果/提示词/迭代评估 | EvaluationService 的 result/prompt-only/prompt-iterate | 后续复用相同快照和模板冻结路径，不复制评分实现 |
| 多消息/上下文/变量生成 | CustomConversationRequest、context repo、变量提取/生成服务 | 后续为各模式提供窄的准备器；保持消息角色和工具边界 |
| Arena、图片测试和图片评估 | ArenaState、ImageService、图片资产库、文生图评估 | 后续宿主适配与结果导入协议；不以文本首版为由重写这些 UI |
| Chrome/Skill | 各自负责连接验证/工作流 | 消费本合同，不能自行复制变量、模型冻结、评估或保存语义 |

接受本草案不等于接受新的储存格式、包导出或生产行为。下一阶段先收敛存储线五项接入条件，再实施一条文本路径，最后按现有能力逐项扩展。
