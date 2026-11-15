# 桌面 MCP 接入计划与第一阶段证据

日期：2026-11-15。任务：`PO-MCP-DESKTOP-20261115`，轮次 1。

基线：`82a40b91ae9a0583f27bec121da03a157aacd42f`。本工作树分支：`feature/po-mcp-desktop-contract-20261115`。交付为 [能力合同草案 v0.1](./mcp-capability-contract.md) 和隔离验证；未改生产代码，未连接真实数据或调用付费模型。统筹提供的存储 `77b8d1c63deda7faf6af7864a6fa529645cbd9e2`、说明 `b82b877e0f1c02885e35e0c2e64b09e0b1dd124f` 已审读为设计事实，未合并；应用实际主入口隔离验收与真实现场恢复仍未完成，不能写成全阶段通过。Skill 场景文档 `439d8c5c` 已作为业务输入读入。

## 1. 建议接受的首版场景

1. 打开已完成迁移的明确桌面数据源，列出真实模型配置和收藏资产。
2. 选中一个变量模式文本收藏的 `assetId/versionId/revision`；选择两个不同、已启用的真实文本模型配置。两者有可能指向相同远端模型，预览须显示实际身份。
3. 为模板如 `请用{{tone}}语气总结：{{text}}` 提供同一变量输入；一次准备和预览 A/B 的实际消息、模型与参数。
4. 执行两个请求，能按已分配的 runId 取消。保留成功、失败及部分输出的真实状态和冻结证据。
5. 人工比较两个原输出；可选地显式选择评估模型，准备并执行 generic compare，使用冻结结果和同一测试输入。不默认调用第三个模型。
6. 显式保存完整比较：冻结输入/运行信息、所有候选状态和原输出、可选评估。通过现有页面内新增的只读入口按 comparisonId 再次查看；不改收藏正文或当前工作稿。保存/查看是首版必交，不由收藏示例替代。

这是现有变量页与多模型运行能力的一条接入路径。首版无需搬走七个 UI 工作区的全部编排，也无需建立新的测试对象管理页面。

## 2. 源码核对与必须提取的逻辑

路径均相对仓库根目录，行号为本基线，之后以符号名为准。

| 位置/符号 | 已核实行为 | 接入动作 |
| --- | --- | --- |
| `packages/mcp-server/src/adapters/core-services.ts`：`initialize` | 创建 MemoryStorageProvider，随后配置默认模型，只有优化相关服务装配 | 新增显式 desktop 装配分支，与 legacy 内存/环境变量装配分开；每来源持有连接，不能用全局单例串来源 |
| `packages/mcp-server/src/config/models.ts`：`setupDefaultModel` | 专用 `mcp-default` 配置路径 | desktop 分支禁止调用；不能用 MCP 环境变量覆盖现有配置 |
| `packages/core/src/services/model/manager.ts:36,81,829` | 构造即 init；补默认/迁移/回填，异常可写默认；getAllModels 等待 init；缺数据读取可回默认 | 拆分“打开已有目录/读模型”与“初始化应用”；提取纯解析/元数据规范化供只读目录和执行使用，损坏数据显式报错 |
| `packages/core/src/services/favorite/manager.ts:55,127,163` | 构造即 initialize；migrateLegacyData 调 updateData，即便列表读取也会走它 | 只读收藏投影不实例化该 manager；后续写路径也要复用无迁移装配 |
| `packages/core/src/services/prompt-model/favorite.ts:468` | promptAssetFromFavorite 优先嵌入资产，否则纯投影 legacy 收藏；合成版本 ID 为 current | 复用投影，显式版本选择并绑定收藏 revision，不偷偷落盘“补齐资产” |
| `packages/core/src/services/prompt-model/types.ts` | 已有 PromptAsset/版本/示例、PromptTestRun/Set/Session | 复用资产和示例；存在类型不等于存在独立结果仓库 |
| `packages/ui/src/components/context-mode/ContextUserWorkspace.vue:1210-1354` | 版本解析、变量合并、模板校验、消息构造、清评估、run、保存仍由页面承担 | 仅抽取变量文本准备器；UI 的 toast、清理、响应式状态和 saveSession 留在 UI |
| `packages/ui/src/utils/prompt-variables.ts:107` 与 `types/variable.ts` | 变量名/缺失/禁止语法/一次替换；依赖 core 的预定义变量常量 | 将这些纯逻辑移入 core 并从 UI 重导出；不复制正则产生第二套语义 |
| `packages/core/src/services/prompt/service.ts:1109` | 自定义会话测试仍做 Mustache 替换，按 modelKey 再读取配置 | 不直接用来执行已渲染/冻结请求；文本准备器输出最终消息交给冻结 LLM 路径 |
| `packages/core/src/services/llm/service.ts:127` | sendMessageStream 支持 `RuntimeModelSelection.configSnapshot`，传播 signal | 直接复用该执行出口；装配时仍需避免其 concrete ModelManager 的初始化副作用 |
| `packages/core/src/services/model/runtime-selection.ts` | resolveRuntimeTextModel、describeRuntimeModel 已存在；后者净化配置并合并 schema 参数默认值 | 复用身份/参数规则，公开输出额外白名单；不把声明默认值误称为远端全部实际默认值 |
| `packages/ui/src/stores/session/useArenaSession.ts:146-245`、`core/services/arena/types.ts` | Arena 已冻结完整配置，存净化 effective、稳定指纹，传 configSnapshot；状态在 Pinia 中 | 复用窄的运行/指纹语义，不把 Arena store 直接拖进 Node，不改 Arena 持久格式 |
| `packages/ui/src/composables/prompt/compareEvaluation.ts:611-703` | 构造 compare evidence/hints，但要求一个 workspace promptRef | 提取纯规范化/判定；保留 UI 原门槛。收藏来源使用 custom promptRef 和外层版本引用，不能伪造 workspace |
| `packages/core/src/services/evaluation/types.ts`、`service.ts:453-517` | generic compare 可接受明确输入和 custom snapshots；必须提供非空 target.workspacePrompt | 复用 EvaluationRequest/Response 和评估算法；给评估模型与模板增加冻结依赖路径 |
| `packages/core/src/services/prompt/service.ts:383` | testPrompt 明确不保存测试历史 | MCP 结果先属于进程内快照；显式保存另外处理，不能混入优化历史 |
| `packages/core/src/services/prompt-model/example.ts`、`packages/ui/src/utils/favorite-reproducibility.ts:393` | PromptTestRun 能转 PromptExample；UI 能映射示例输入/输出及 metadata | 可选示例派生可以复用，但不足以保存完整比较；不以此替代首版结果协议 |
| `packages/core/src/services/prompt-model/favorite.ts:526`：refreshPromptAssetFromFavorite | 存在 legacy reproducibility 时会重新投影 examples，覆盖 canonical-only 追加 | 后续示例保存必须同步两种表示；隔离验证已复现，无需触及真实收藏 |
| `packages/ui/src/stores/session/promptSessionProjection.ts`、`useSessionManager.ts:238` | PromptSession 由多个 UI store 投影，Arena 另行投影结果 | 不直接追加一份 PromptSession 就宣称 UI 能恢复；活动工作区导入另设边界 |
| `packages/ui/src/stores/session/sessionPersistence.ts:172` | CAS 基于原始快照；冲突时阻止覆盖，跨异步保存有状态 | 数据库原子性不代替业务冲突；首版不写当前 session |
| `packages/ui/src/utils/favorite-events.ts` | favorite-updated 是 window 自定义事件 | 独立 MCP 写库不会自动通知窗口，返回 reload-required |
| `packages/desktop/main.js:668,1004,1134` | 主进程集中创建 provider；stream 取消绑定 event.sender；网络包装在主进程 | 接受存储线接口后替换装配；独立 Node 不调用 preload，也不借用 renderer 的取消归属 |

旧 `docs/architecture/storage-runtime-architecture.md` 在本基线仍描述 FileStorageProvider/JSON。存储提交的新事实另见下一节，不能把旧文档或 API 名称当作可直接用于只读接入的依据。

## 3. 与存储线的五项连接要求

已审读实现事实：Node 子入口为 `@prompt-optimizer/core/node`；`SQLiteStorageProvider(databasePath, options?)` 和 `openDesktopStorage(userDataPath, options?) → {provider,migration}`；provider 有 close/flush；文件 `prompt-optimizer-data.sqlite`；`storage_metadata` 的 `legacy-json-migration` 保存 `{version:1,source,itemCount}`。openDesktopStorage 会建目录/表和迁移，provider 首次读也会执行建库/DDL；目前没有无副作用 open-existing 入口。存储报告尾部提到共用 bootstrap，但本线依据统筹澄清，**不能将 bootstrap 直接用于 MCP 只读发现**。

下表仍是消费方需要的能力，不要求存储线照抄方法名；已实现事实与缺口分别说明。

| 接口项 | 需要存储线提供/确认 | 接入验证条件 |
| --- | --- | --- |
| ① 数据目录定位 | 与 Electron userData/profile/便携模式一致的定位规则或受信任 descriptor；返回稳定来源身份，不把目录路径给普通模型工具 | 同机两份 profile、路径含空格、不同 cwd 均连接指定库；不碰另一份数据 |
| ② schema/迁移完成识别 | 已有 version=1 完成标记。仍需无建库/DDL地查询兼容状态，区分 not-created/migrating/ready/unsupported；ready 与数据一致，不能只看文件存在 | 迁移中/失败/较新 schema 均拒绝接入，无创建和自动重迁移；应用业务模型格式另行校验 |
| ③ 仅打开已有库 | 当前明确缺失。需 open-existing/no-create 语义；读操作无默认初始化/环境变量写回，无 fallback 内存配置；结构迁移只由存储线授权入口拥有 | 路径不存在或缺 models 时失败，目录/库/业务配置无创建/写回；SQLite 锁/共享内存文件的只读行为由接口明确。不能先 new 自动建库 provider 再检查 |
| ④ 连接生命周期 | Node 与打包 Electron 的运行时兼容、打开/关闭/flush/错误清理、并行连接、busy timeout；只释放自己拥有的句柄 | 桌面关闭、打开、重启和 MCP 断开均不破坏其他连接；MCP 退出取消网络并释放句柄 |
| ⑤ 业务并发与刷新 | 已有 CAS/updateData 在 BEGIN IMMEDIATE 后读改写，回调同步；无跨进程通知。仍需确认只打开连接路径沿用这些语义、版本读取/多 key 边界 | 比较文档的追加和幂等在一个原子修改；双写不丢记录；保存完成后重读可见，UI 每次打开查看器重新读取 |

已审读 `updateData` 在 BEGIN IMMEDIATE 后读取并执行 modifier，仅获取锁重试，不重放 modifier；本轮未重跑其并发测试，也不扩展该结论到所有 manager。仅有 WAL、busy 重试或单连接互斥，不能证明上层“先读后写 metadata”安全；`supportsAtomic` 也不能自动当成多 key 业务事务。

连接要求 ⑤ 中存储原子性归存储线；实体 revision、比较保存/去重、可选收藏示例冲突由本线业务层负责；缓存与页面刷新由宿主适配器负责。缺少原子条件时显式禁用 save，不降级为覆盖。

## 4. 实现拆分与依赖

| 批次 | 本线实现范围 | 依赖与可审查结果 |
| --- | --- | --- |
| A：接受接口后只读接入 | desktop 与 legacy 装配分离；无副作用的模型/收藏 reader；受信任 source descriptor、连接隔离、白名单 | 依赖存储五项确认。用临时已有库检查零写入和跨 profile 隔离；不读取真实密钥 |
| B：一条文本执行路径 | core 纯准备器、使用现有 LLM configSnapshot 的窄执行器、实际请求参数证据、进程内状态/取消、MCP 工具映射 | 提取前后同一输入/变量行为一致；fake adapter 检查最终请求消息/参数、配置变更不污染、取消不被迟到回调覆盖 |
| C：保存与现有 UI 查看（首版必交） | 新增 SavedComparisonV1/窄 repository/主库单 KV 文档、原子追加/幂等、MCP save/list/get、desktop 读取接口；变量页内只读 drawer，DataManager 纳入 | 两个独立连接并发保存；同 saveKey 重试一次；记录重启后可寻址；源收藏/模型变动或删除后仍可解释；真实 UI 打开对应 ID，显示失败/取消和两组快照，保留未保存编辑 |
| D：可选 generic 模型评估 | 提取 compare 纯规范化，冻结 evaluator/template，复用 EvaluationService；随 C 保存已选择的评估 | 两个成功结果/同一输入；显式模型和模板；原 UI 门槛保留；不选评估模型也能完成 A-C；评估失败不损失测试结果 |
| 后续能力 | 优化/迭代的明确来源、单结果/提示词评估、多消息、图片及宿主网络 | 逐项扩展同一合同；不作为 A-D 的前提 |

建议生产入口增加窄的 `TextTestCapability`（prepare/execute/get/cancel）与 `ComparisonRepository`（save/list/get），不引入按模式分支的通用 RunService。新增结果协议是满足已接受场景的必要成本：复用 PromptTestRunSet、一个 KV 文档和现有页面的只读 drawer，不新建测试项目/数据集 UI、SQLite 表或后台任务。容量建议、DTO 与 UI 入口需本轮供统筹选择；没有这些新增能力只能称为底层测试打通，不能称为场景一完成。

现有服务依赖 concrete ModelManager 的地方，应收窄为所需 reader 接口或增加明确的只读装配，不能用类型强转掩盖构造副作用。生产导出名和文件布局在接到存储接口后定稿。

Chrome 线消费 A-D 的业务 DTO 和错误，不自行实现模型冻结、变量替换、compare、保存。Chrome 负责发现可达来源、鉴权/权限、浏览器连接和 UI 宿主能力；Skill 线负责选择来源/版本/模型、展示预览和保存意图的工作流。本文不写入这两条线的产物。

## 5. 隔离验证与证据范围

验证文件：`experiments/mcp-desktop-contract/probe.mjs`。运行：

```powershell
node experiments/mcp-desktop-contract/probe.mjs
```

正常安装仓库依赖后，上述命令使用 core 的 TypeScript 编译器。此独立工作树没有 node_modules；本机验证复用已安装的全局 TypeScript 5.9.3，未安装或复制其他工作树依赖：

```powershell
$compiler = Join-Path (pnpm root -g) 'typescript/lib/typescript.js'
node experiments/mcp-desktop-contract/probe.mjs --typescript $compiler
```

脚本用进程内解析/转译钩子直接加载本仓库纯函数；`probe-core-exports.mjs` 只重导出所需纯符号，避免 core 总入口加载 SDK/存储模块。没有替换变量处理或模型参数实现。最初直接用 Node strip-types 加载遇到 UI 错误类的 TypeScript 参数属性不支持，已改用上述已安装编译器转译；不是业务函数失败。脚本不导入 MCP server/main.js、不装配会写配置的 manager、不读用户数据目录、不访问网络、不落数据库。运行环境为本机 Node `v26.13.0`；项目声明 Node `^24.22.1`，本次不宣称已在该版本复验，也不是生产包构建/类型检查。

验证内容：合成收藏经真实资产纯函数投影和明确版本选取；现有变量校验/一次替换；`resolveRuntimeTextModel/describeRuntimeModel` 的冻结与参数语义；公开字段投影不带配置凭据；`PromptTestRun → PromptExample → UI 示例` 的输入/输出/版本转换；legacy 复现字段覆盖 canonical-only 示例追加，以及同步两种表示后保留结果；现有 compare helper 拒绝“无 workspace”的资产快照。模型配置、凭据哨兵和结果全为合成 fixture。

这是**协议/纯适配验证**，共 7 项通过。未验证 SQLite/真实桌面数据、SDK 实际请求参数、真实模型效果、评估模型装配、MCP 并发取消、新增比较 repository/drawer、真正原子保存、已打开页面刷新或桌面打包。本轮不运行全仓测试或打包，因为没有生产行为改动；下一阶段按 A-D 的实际改动验证。

7 项检查的名称随脚本运行直接输出，全部通过；没有生成数据库、模型配置或备份。审查可由上述命令重复执行。

## 6. 交回统筹的开放问题

- 存储已给实现事实，但 open-existing 入口仍缺失；需统筹确定补齐责任和接受点，不能将 Electron 迁移报告代替 Node 接入验收。
- 首版沿用已接受的确定收藏版本/同变量/两模型场景，Node 网络与仅 pro-variable 的模式范围待核对；模型评估可选。
- 是否接受新增 SavedComparisonV1、主库单 KV 文档与现有页面只读 drawer；容量建议、导出/清空纳入以及完整快照显示成本需明确，不能以两个示例或临时输出代替完整保存查看。
- 评估服务冻结模型/模板的窄依赖入口；不把这项遗漏成“直接调用 evaluate 即完成”。
- 若必须复用 Electron 的代理/证书或桌面关机后也能读取图片，需要统筹另定宿主范围；不能从共享 SQLite 推出这些能力。

本轮完成后等待统筹发来已接受的存储接口和下一阶段范围；不轮询其他会话、不推送、不发布、不合并原 checkout。
