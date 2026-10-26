# 备份、导入导出与跨设备恢复完整性审计

日期：2026-10-26。任务：`backup-data-integrity-audit`，轮次 1。

第 1–8 节记录审计时的 `f49c4304` 基线，不代表修复后的现状。用户随后授权的最小修复及验证结果见第 9 节。

## 1. 结论与范围

当前实现已经覆盖大量业务数据，但还不能承诺“无损、可验证、失败可回滚的全量跨设备恢复”。问题主要发生在数据契约、身份引用、错误上报和恢复写入阶段；更换远程存储提供商不会自动修复这些缺口。本报告不决定同步架构。

核对基线：版本 `2.12.0`，HEAD `f49c430479f0ee3fb51edea6ebd03adb4e9612ca`；审计开始时工作区干净。向上检查工作目录至 `D:\` 未发现磁盘上的额外 `AGENTS.md`，遵循会话提供的浏览器及共享仓库约束。未修改业务代码，未提交、推送、部署、上传真实数据或访问真实备份账户。只用内存样本和测试进程内的独立 fake IndexedDB。

分级：P1 为应在承诺完整备份前修复的数据损失或引用破坏；P2 为条件性完整性缺口。以下分别注明“确认缺陷”“设计边界”“待实测风险”，不将它们混为已发生的用户事故。

## 2. 真实备份路径

| 路径 | 实际内容 | 恢复顺序与局限 |
| --- | --- | --- |
| 核心 `DataManager` JSON | history、models、imageModels（服务存在时）、userTemplates、userSettings、contexts、workspaceSessions | 历史→文本模型→图像模型→模板→设置→上下文→工作区；不含独立收藏和图片二进制 |
| 数据管理页本地 ZIP | `app-data.json`、`favorites.json`、manifest、会话及收藏图片，支持按区选择 | 图片逐个校验并写入→收藏→应用数据；不是全局事务 |
| 数据管理页远程快照 | 同样四类业务区；结构化 JSON 与图片对象分开，manifest 最后上传 | 先下载/校验所选 JSON 语法及全部图片，再图片→收藏→应用数据；也不是全局事务 |
| 收藏库 ZIP | 收藏、分类、标签，以及从收藏引用图扫描得到的图片 | 图片→收藏；与全应用备份扫描图片库的方式不同 |
| 收藏 JSON / 分享 PNG、HTML | JSON 不带图片二进制；分享载荷来自选定栏目组成的收藏资源包 | 用收藏导入规则；分享允许裁剪版本、示例等，不能作为全应用备份 |
| Desktop 主文件 `.backup` | `prompt-optimizer-data.json` 对应结构化 KV 的文件恢复副本 | 不是导入 ZIP，不含渲染进程的两个图片 IndexedDB 或远程连接 localStorage；不能单靠它迁移整套应用 |

本地与远程默认均选择四区。界面允许关闭应用图片；关闭图片后的包属于文本/结构化数据备份，不能期待离线恢复其图片引用。纯核心 JSON 的边界同样必须保留。

入口依据：[核心 DataManager](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/manager.ts:70)、[本地 ZIP](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/data-manager-resource-package.ts:212)、[远程快照](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:372)、[收藏 ZIP](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/favorite-resource-package.ts:156)、[分享栏目](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/favorite-share-export.ts:24)。

## 3. 数据覆盖与恢复矩阵

“主 KV”在 Web/Extension 为 `PromptOptimizerDB.storage`；Desktop 为主进程 `<userData>/prompt-optimizer-data.json`。偏好键物理前缀为 `pref:`。矩阵中的“应用区”同时进入本地 ZIP 的 app-data 和远程 app-data；“收藏区”进入二者的 favorites。下列恢复判断均以选择对应区为前提。

| 数据 | 存在哪里 | 如何导出 | 如何导入、覆盖/合并语义 | 引用是否保持、干净设备恢复判断 |
| --- | --- | --- | --- | --- |
| 文本模型、连接、凭据 | 主 KV `models` | modelManager.exportData→应用区 models | 按 id 更新或新增，保留目标额外模型；支持旧 key 格式转换 | 常规 ID 保留；条目失败可能被吞掉。connectionConfig 中已有的密钥随 JSON 导出，模型可用性仍取决于网络/提供商 |
| 图像模型、参数、凭据 | 主 KV `image-models` | imageModelManager.exportData→imageModels | 按 id 更新/新增，修复旧格式、校验 provider | 不清空目标额外配置；失败可能静默；未知提供商/环境不同可导致配置无法实际使用 |
| 自定义模板 | 主 KV `user-templates` | 仅非内置模板→userTemplates | 全量预校验后单键替换；重复 ID 最后一项胜出 | 通常保持 ID；与目标内置 ID 冲突时改新 ID，相关工作区/历史 templateId 不自动映射；内置模板由目标应用重建 |
| 历史、优化链 | 主 KV `prompt_history` | historyManager.exportData→history | 先清空、逆序重放、最多 50 条；保留 record/chain/previous ID | 正常当前备份可保留已有 50 条；失败静默可能损失链；已经被历史上限淘汰的链不在包中 |
| basic-system 草稿 | `pref:session/v1/basic-system` | 七模式枚举→workspaceSessions | 包中存在的模式整体替换，缺席模式保持目标原值 | prompt、优化文、推理、链/版本、testContent、测试图引用、布局、四列配置/结果/指纹、评估/比较角色、模型/模板选择、来源绑定均保存；测试图需图片区 |
| basic-user 草稿 | `pref:session/v1/basic-user` | 同上 | 同上 | 同类文本草稿、测试/评估结果、比较状态、选择与绑定保留；不能据此保证外部引用有目标对象 |
| pro-multi 草稿 | `pref:session/v1/pro-multi` | 同上 | 同上 | 消息快照、选中消息、messageChainMap、临时变量、测试/评估/布局/选择及绑定保留；工具仍在 contexts 中 |
| pro-variable 草稿 | `pref:session/v1/pro-variable` | 同上 | 同上 | prompt、临时变量、测试/评估、选择及绑定保留；不替代全局变量备份 |
| image-text2image 草稿 | `pref:session/v1/image-text2image` | 同上；结果图转资产引用 | 同上 | 提示词、临时变量、四列/原始优化图结果、评估、模型/模板选择及绑定保留；图片实体需 imageCache |
| image-image2image 草稿 | `pref:session/v1/image-image2image` | 同上；inputImageId、结果图引用 | 同上 | 另含输入图 ID/MIME；base64 通常不存快照，输入及结果实体需 imageCache |
| image-multiimage 草稿 | `pref:session/v1/image-multiimage` | 同上；inputImages 引用 | 同上 | 多张输入图、临时变量、结果/评估、选择及绑定保留；缺图在加载时可能触发该模式快照清理 |
| 全局主题、语言、活动模式及子模式 | `pref:global-settings/v1`（JSON 字符串），部分 legacy UI 键 | preferenceService.exportData→userSettings | 有效快照优先，按已提供字段合并；旧主题/语言映射进新快照 | 已进入 keyCache 时可恢复，正常初始化通常会读取；新服务实例未访问快照时可能漏出。无明确完整性保证 |
| 评估/图片识别功能模型选择 | 两个 `app:function-model:*` 偏好键 | 固定白名单补读→userSettings | 合法字符串覆盖 | 模型 ID 保留；依赖模型配置真正导入成功。模式内优化/测试模型选择以 session 为准，不把过时键常量当成全部仍在使用 |
| 全局自定义变量 | `pref:variableManager.storage` 对象 | 当前被 String(value) 变成 `[object Object]` | 当前又被设置白名单跳过 | **无法经全量备份恢复**；工作区临时变量不能补齐它们 |
| advancedModeEnabled / lastConversationMessages 旧变量管理器附属字段 | 同一 VariableStorage 对象 | 同样损坏并跳过 | 同上 | 只见变量管理器及 composable 包装，当前 src 无有效外部消费者证据；当前模式状态在 global-settings，Pro 消息在 session，不能宣称当前对话因此全丢 |
| 工作区临时变量 / 临时聚合 store | Pro 与图像 session 的 temporaryVariables；聚合 store 本身在内存 | 前者随工作区结构化导出；后者无独立备份 | 前者随模式替换并做变量名清理；后者随初始化重建 | 已保存的工作区级变量可恢复；未落入 session/context 的纯内存中间态没有独立恢复契约 |
| 上下文消息、变量、工具及当前上下文 | 主 KV `ctx:store` | contextRepo.exportAll→contexts | replace；当前 ID 无效会选有效首项；剔除预定义变量覆盖 | 合法项保持 ID，工具/消息随对象；变量不含全局变量；坏项可被跳过且顶层不知情 |
| 收藏文本、属性 | 主 KV `favorites` | favoriteManager.exportFavorites→收藏区 | 按 content 判重：skip 跳过；overwrite 更新已存在记录并保留目标 ID；merge 新增 | 干净目标同内容多条可保留；已有同内容目标或 ID 冲突时不保证身份、版本、来源引用保持 |
| 分类 | 主 KV `favorite_categories` | categories 数组→收藏区 | 按 ID 或名称判已有；新增类别调用 addCategory 分配新 ID，未传入 parentId | **旧分类引用不自动映射，新设备可出现悬空分类**；父子分类关系还会丢失 |
| 标签、收藏统计 | `favorite_tags` / `favorite_stats` | 标签以字符串数组导出；统计不单独导出 | 标签去重合并并重建时间，统计由收藏重算 | 标签文字/独立预建标签可保留，标签 createdAt 不原样保留；统计属于可重建数据 |
| 提示词资产、版本、示例、来源绑定 | 收藏 metadata.promptAsset / reproducibility / gardenSnapshot 等；session.assetBinding、origin；历史元数据 | 收藏 metadata 与 workspace/history JSON | 收藏导入刷新资产投影，工作区按原引用写回；无全局引用映射 | 无冲突时多数内容及版本可保留；收藏改 ID、内容冲突覆盖、删改模板/历史、未选收藏区时不保证关联可解析 |
| 会话图片实体 | IndexedDB `PromptOptimizerImageDB` 的 metadata/data 两表 | imageCache 扫描库中全部 metadata→读取实体→ZIP/远程图片对象 | 同 ID 有数据直接跳过；否则 saveImage | 干净、未超配额且引用完整时可恢复；配额淘汰、源已缺图、同 ID 异内容均可破坏最终引用 |
| 收藏图片实体 | IndexedDB `PromptOptimizerFavoriteImageDB` | favoriteImages 全库扫描；收藏专用 ZIP 按业务引用扫描 | 同 ID 跳过；否则保存；200 MiB/1000 张 reject | 配额失败会报错但前序写入不回滚；导入后的 GC 删除当前收藏未引用的图片 |
| 外链图片、示例 URL、来源页面链接 | 收藏 media / 资产示例 / 消息或快照 JSON | 保留 URL；备份器不会通用抓取外链正文 | 原 URL 写回；部分 session 保存流程会先下载为本地资产 | 未缓存实体的 URL 依赖外站、鉴权、时效和 CORS；blob URL 跨设备无保证。URL 存在不等于图片已备份 |
| 远程连接参数和凭据 | localStorage `prompt-optimizer:remote-backup-settings`；Google access token 在进程内缓存 | **不进上述包/快照** | 无迁移步骤 | 新设备需重配端点/目录/凭据或重新授权；属于必须说明的连接引导边界，不自动判为业务数据缺陷 |
| 备份提醒、缓存、更新/PWA、机器配置 | 提醒 localStorage、sessionStorage、Service Worker/Cache Storage；Desktop network JSON、环境变量、窗口/更新状态等 | 不在业务备份契约 | 提醒/缓存重建；机器网络配置按设备重新设置 | 应明确排除；不复制 SW、临时锁、blob URL、更新下载物。`.env`/代理/证书/端点网络可达性不因导入模型 JSON 自动恢复 |

七类 session 保存字段依据：[basic-system](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useBasicSystemSession.ts:545)、[basic-user](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useBasicUserSession.ts:454)、[pro-multi](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useProMultiMessageSession.ts:493)、[pro-variable](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useProVariableSession.ts:412)、[text2image](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useImageText2ImageSession.ts:590)、[image2image](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useImageImage2ImageSession.ts:657)、[multiimage](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useImageMultiImageSession.ts:630)。

## 4. 按严重程度排序的发现

### F01 / P1 / 确认缺陷：全局自定义变量不能往返恢复

触发：设置一个全局变量，再执行默认全量备份并在空存储导入。VariableManager 将整个 VariableStorage 作为对象保存；PreferenceService.getAll 对值调用 `String(value)`；importData 又只接受 UI 白名单和单独的 global-settings 快照，跳过 variableManager.storage。结果即使 JSON 有该键，变量内容已变成 `[object Object]`，且恢复完全不写入。七个工作区快照不能补齐全局变量。

证据：原会话内存样本已复现，本轮核对相同 HEAD 和完整写读路径，未无意义重复。附属高级模式/旧消息字段的业务影响必须按矩阵收窄，当前 Pro 消息不是靠它恢复。

源码：[VariableManager.ts:335](D:/Dev/myProject/prompt-optimizer/packages/ui/src/services/VariableManager.ts:335)、[preference/service.ts:304](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/preference/service.ts:304)、[preference/service.ts:386](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/preference/service.ts:386)。

修复分组：为全局变量建立独立版本化数据区，结构化序列化、验证和恢复；不要简单把任意 pref 键全部放开。

### F02 / P1 / 确认缺陷：条目失败被吞掉，顶层仍报告成功

触发与影响：

- history.importData 清空旧历史后逐条 addRecord，写入失败仅警告；故障可同时导致旧历史被清空、新历史没恢复。
- 文本/图像模型逐条捕获失败，函数正常返回；工作区仍可能提交指向未恢复模型的选择。
- ContextRepo 只验证 bundle 外壳；replace 时坏条目异常被计入 skipped，importData 丢弃返回报告；只要还有合法上下文，顶层成功。
- PreferenceService 对不少无效值、普通设置写入失败也仅警告；global-settings 写入失败会抛错，这个保护应保留。
- 收藏分类导入失败只记警告，不计入 result.errors。收藏条目错误则会返回 errors，全应用 ZIP/远程会据此失败，不能一概称为全部吞错。

本轮复现：旧历史 1 条，给新历史写入注入一次存储异常，DataManager.importAllData 正常 resolve，最后历史 0 条；`imageModels:[{id:'broken'}]` 和文本模型 `[{}]` 不使各自导入失败；两个上下文中一个 variables=null，bundle version=999，最终只剩合法项但导入 resolve。

源码：[history/manager.ts:400](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/history/manager.ts:400)、[model/manager.ts:1314](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/model/manager.ts:1314)、[image-model/manager.ts:328](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/image-model/manager.ts:328)、[context/repo.ts:453](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/context/repo.ts:453)、[context/repo.ts:589](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/context/repo.ts:589)、[preference/service.ts:442](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/preference/service.ts:442)、[DataManager.vue:2034](D:/Dev/myProject/prompt-optimizer/packages/ui/src/components/DataManager.vue:2034)。

修复分组：各服务返回统一的成功/跳过/冲突/失败报告并逐层聚合；默认完整恢复不得把失败当成功；历史先验证、暂存再单次替换。

### F03 / P1 / 确认缺陷：自定义分类重建了 ID，收藏仍引用旧 ID

触发：源有自定义分类 C、收藏.category=C.id；向空目标导入。导入器调用 addCategory 产生新 ID，却没有把旧→新映射加入 categoryMapping；收藏写回原 category。已有同名但异 ID 的目标分类也不建立映射。分类失败还可静默。

影响：分类对象和收藏都“导入成功”，但分类筛选/路径关联失效。原会话样本得到 errors=[]，收藏指向目标不存在分类；本轮源码确认。新增分类参数还遗漏了实际类型支持的 parentId，父子关系被摊平；分类颜色/描述等导入已有分类时也不会覆盖同步。

源码：[favorite/manager.ts:653](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:653)、[favorite/manager.ts:1218](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:1218)、[favorite/manager.ts:1360](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:1360)、[favorite/types.ts:60](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/types.ts:60)、[favorite-category-path.ts:82](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/favorite-category-path.ts:82)。

修复分组：灾备恢复优先保持分类身份；合并导入必须产出并应用 ID 映射，对完整引用图做校验。

### F04 / P1 / 确认缺陷：收藏以内容判重，无法保持身份、资产版本和来源绑定

边界必须准确：**空目标导入同内容的两条收藏可保留两条**。新增分支没有更新 content map，不能把空目标也描述为必然合并。

真正触发：目标已有同 content 的收藏。overwrite 从 existingFavorite 展开，保留目标 ID，但以传入 metadata 替换来源资产/版本等；一个包中多条相同内容会反复覆盖同一目标。skip 会丢弃这些导入项的属性和版本；merge 允许新增，但 ID 冲突时生成新 ID，没有同步重写嵌入资产 ID、版本来源、workspace.origin 或 binding。

本轮复现 A：源两条合法同内容收藏，空目标恢复 2 条；目标已有该内容时，报告 imported=2、errors=[]，最终只有 1 条，保留备份迭代顺序最后一项属性。复现 B：源/目标都用 favorite id=shared、内容不同，merge 产生两个不同 favorite ID，却都持有 asset id=`favorite:shared`。按 origin.favoriteId 查找可能先命中目标旧项，按 assetId 查找也有歧义，完整绑定图没有被修复。

源码：[favorite/manager.ts:1299](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:1299)、[favorite/manager.ts:1368](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:1368)、[favorite/manager.ts:1406](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:1406)、[prompt-model/favorite.ts:526](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/prompt-model/favorite.ts:526)、[source-asset.ts:50](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/source-asset.ts:50)。

修复分组：区分“恢复原备份”和“内容去重导入”；定义 favorite/asset/version/source 身份规则及映射。版本冲突要显式处理，不能把 metadata 覆盖称作版本合并。merge 重复导入也不能视作幂等恢复。

### F05 / P1 / 确认缺陷：图片恢复计数成功，不代表最终图片仍存在

触发：目标现有图片与待导入图片的并集超过 session 库 100 张/50 MiB，或备份本身超过目标配置上限。saveImage 按默认 evict 策略写后清理，可能删除目标旧引用图片，或在输入本身超限时删除刚恢复的前序图片；恢复器只累加 saveImage 成功次数，没有最终引用/实体复查。

本轮用真实 ImageStorageService + fake IndexedDB，将 count 上限缩为 2，导入 3 个不同图片，恢复成功 restored=3，最终 metadata 只有 2 条。收藏库配置为 reject，缩为 1 后导入 2 张会失败，但第 1 张仍留在库中。真实当前配置：session 50 MiB/100 张/7 天，favorite 200 MiB/1000 张/不过期/reject。恢复会刷新访问时间，因此不能说旧备份仅因 createdAt 很老就立即过期。

这不是“所有干净设备恢复都会淘汰”：默认源合法存量且目标为空、并集未超限时不触发该缺陷。危险场景包括已有数据的目标、部分模式恢复、不同配额来源和后续超限。

源码：[image/storage.ts:143](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/image/storage.ts:143)、[image/storage.ts:288](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/image/storage.ts:288)、[useAppInitializer.ts:296](D:/Dev/myProject/prompt-optimizer/packages/ui/src/composables/system/useAppInitializer.ts:296)、[remote-snapshot-backup.ts:602](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:602)。

修复分组：恢复前对联合存量预检容量；暂存恢复时禁止静默淘汰受保护引用；恢复完成后验证所有存活引用，再报告完整成功。

### F06 / P1 / 确认缺陷：图片、收藏、应用数据之间没有统一预检/提交/回滚

本地 ZIP 边校验边保存图片，扫描结束才 assert；远程先检查全部图片字节和 JSON 语法，资源预检更强，但业务语义预检要等图片/收藏写入后才调用 DataManager。DataManager 只预检 workspace 结构，其他服务边导边检查；某一服务失败会继续尝试后面服务，最终抛部分失败，之前成功的写入仍保留。

本轮复现 A：本地两张资源的第二张损坏，最终导入抛错、应用数据没导，但第一张已永久写入；同样损坏远程样本在首次图片写入前拒绝。复现 B：app-data 中 workspace version=999，本地/远程均在写完图片和收藏后才失败，目标已出现该图片及收藏，无法回到导入前状态。

工作区自己的 CAS/回滚只覆盖传入模式；前序服务抛错时工作区不提交，这是有效保护，不能把整个实现描述为毫无防护。它仍不足以回滚图片、分类、标签、收藏、模型、模板、历史和设置。收藏尺寸预算失败前分类/标签也可能已写。导入失败后恢复旧内存 session 的自动保存，会与部分新配置混合。

源码：[data-manager-resource-package.ts:315](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/data-manager-resource-package.ts:315)、[data-manager-resource-package.ts:387](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/data-manager-resource-package.ts:387)、[remote-snapshot-backup.ts:485](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:485)、[remote-snapshot-backup.ts:592](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:592)、[data/manager.ts:133](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/manager.ts:133)、[workspace-session-transfer.ts:179](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/workspace-session-transfer.ts:179)。

修复分组：恢复流程统一为解析→全部业务校验→身份/容量计划→暂存→提交→引用复核；不能跨存储事务时使用恢复日志/可恢复检查点，明确部分写入清单。恢复前自动快照可以作为额外恢复点，但本身不代替事务。

### F07 / P1 / 确认缺陷：全应用备份未沿业务引用检查图片缺失

触发：某快照/收藏仍引用 image id，图片实体和 metadata 已消失。本地与远程只 listAllMetadata，因此压根不会查该 id，missingResources/missingAssets=[]。所选图片服务不存在也返回空列表。备份成功提示不能证明所有引用有实体。

原会话已经复现该盲区，本轮核对当前源码。补充对照复现：收藏专用 ZIP 从 media.assetIds=['gone'] 扫描，在空图片库准确报告 missingResourceIds=['gone']，说明当前不同入口的完整性定义不一致。

影响：干净目标恢复后图片不可见；部分模式会保留坏引用显示错误，多图输入缺失还可能被会话恢复层判断为损坏并清理快照。全库扫描同时会打包无引用的孤儿图片，增加体积；这不等同于引用闭包完整。

源码：[data-manager-resource-package.ts:165](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/data-manager-resource-package.ts:165)、[remote-snapshot-backup.ts:292](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:292)、[favorite-resource-package.ts:161](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/favorite-resource-package.ts:161)、[useImageMultiImageSession.ts:117](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useImageMultiImageSession.ts:117)、[useSessionManager.ts:57](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useSessionManager.ts:57)。

修复分组：统一收集七种 session、全部收藏资产/历史版本/示例所需图片引用并按库求闭包；分别报告已缓存资源、仅 URL、缺失实体、未选图片和可选孤儿。恢复后再用同一规则验收。

### F08 / P2 / 确认缺陷：本地同 ID 图片不比内容，直接跳过

触发：目标已有与备份相同 id、但内容不同且非空的图片。包内图片即使校验通过，local restoreImageResource 和 remote prepare 都直接 skipped。没有验证目标字节 hash/MIME/大小，也没有冲突映射。

本轮 ZIP/远程样本均为 backup='BACKUP'、target='TARGET'、id='shared-image'：恢复成功 skipped=1，仍保留 TARGET。稳定内容 hash ID 减少正常新图发生概率，不能覆盖旧 ID、损坏记录、导入数据或无 WebCrypto 的短 hash 路径；不能因此宣称一定是常见随机碰撞。

源码：[image-resource-backup.ts:201](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/image-resource-backup.ts:201)、[remote-snapshot-backup.ts:554](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:554)、[imageStorageMaintenance.ts:58](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/imageStorageMaintenance.ts:58)。

修复分组：比较目标实际内容；同 ID 异内容应拒绝、明确覆盖，或生成新 ID 并重写所有引用。

### F09 / P2 / 确认限制：偏好导出受当前实例访问历史影响

触发：同一个持久化存储上新建 PreferenceService，尚未读取 global-settings/v1 就 exportData。keys 仅返回实例 keyCache，getAll 只补固定 UI 白名单；快照未进入 cache 时遗漏，读取后则出现。单键读取损坏时 getAll 还会警告后继续导出，不把缺失升级为完整性错误。

原会话内存样本已复现，本轮确认源码；当前全局设置初始化通常读取快照，故不能扩大成“正常页面备份必漏全局设置”。七类 workspace 使用固定模式枚举，已绕开这一问题。

源码：[preference/service.ts:274](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/preference/service.ts:274)、[preference/service.ts:304](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/preference/service.ts:304)、[useGlobalSettings.ts:274](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/settings/useGlobalSettings.ts:274)、[workspace-session-transfer.ts:162](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/workspace-session-transfer.ts:162)。

修复分组：显式枚举受支持业务偏好区，使用各区类型契约和结构化导出，不依赖“页面刚好先读过”。

### F10 / P2 / 确认缺陷：未知版本、资源字段及哈希降级校验不一致

应用 JSON 用 `if (exportData.version)` 判断新格式，没有要求 version=1，未知 version=999、data={} 可成功无操作。contexts 只要求 version 是字符串；favorites.version 不参与验证。相对地，本地/远程外壳 schema 和 workspace version 有严格检查，应保留。旧扁平 JSON 可导入；旧备份缺席工作区时保留当前草稿，不存在的旧内容无法凭空恢复。

图片 manifest 条目缺少统一的严格逐项 schema；一些未知 kind / 不合规则条目被 skipped。app-data/favorites 本身没有整体摘要或记录数核对。哈希存在但当前 crypto.subtle 不可用/失败时，validateImageResourceBytes 不进行 hash 比较，也不会进入无 hash 的 size 校验分支。

本轮复现：未知顶层 app version=999 被接受；将 crypto 设为不提供 subtle，资源声明 size=1、sha256='backup-hash'，输入 20 bytes，校验仍返回 ok。这是有明确环境条件的校验绕过，不代表所有正常 HTTPS 恢复都不校验。无 hash 时现有长度容差也只能发现部分损坏。

源码：[data/manager.ts:117](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/manager.ts:117)、[context/repo.ts:601](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/context/repo.ts:601)、[favorite/manager.ts:1212](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/favorite/manager.ts:1212)、[data-manager-resource-package.ts:149](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/data-manager-resource-package.ts:149)、[remote-snapshot-backup.ts:237](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:237)、[image-resource-backup.ts:163](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/image-resource-backup.ts:163)。

修复分组：版本分派和显式迁移/拒绝；结构化内容和资源建立摘要、数量及引用契约；无法执行要求的校验时明确报告，不能静默判 ok。

## 5. 现有保护与尚未证明的边界

1. **工作区保护已存在。** 数据页导出先 saveAllSessions；恢复前检查当前活动工作区忙碌状态、暂停本窗口 store 自动保存、等待已有写入及图片 GC、保存当前草稿检查点。工作区部分严格校验七模式、JSON 安全、关键字段及每模式 1 MiB 限制，最后提交；可用 CAS 时冲突拒绝、失败尝试回滚，回滚冲突不覆盖另一窗口新值。成功后暂停旧会话自动保存直到刷新，避免旧内存写回。依据：[DataManager.vue:1878](D:/Dev/myProject/prompt-optimizer/packages/ui/src/components/DataManager.vue:1878)、[useSessionManager.ts:516](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useSessionManager.ts:516)、[workspace-session-transfer.ts:67](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/workspace-session-transfer.ts:67)。
2. **Web 并发边界。** navigator.locks 可用时恢复持有源站级排他锁，普通 session 写入/GC 协同；IndexedDB CAS 提供另一层保护。无 Web Locks 的 LAN HTTP 路径会禁用部分自动 GC 以避免误删，不应直接称为无保护。导出仍为跨服务顺序读取，没有全局一致性快照；收藏、设置、模型修改也不都参与 session 锁。因此“导出期间另一窗口编辑”“恢复期间另一窗口改收藏/设置”是待多窗口实测的混合时间点风险。依据：[sessionConcurrency.ts:1](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/sessionConcurrency.ts:1)、[imageStorageMaintenance.ts:312](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/imageStorageMaintenance.ts:312)、[data/manager.ts:70](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/data/manager.ts:70)。
3. **Desktop 并发与落盘边界。** renderer PreferenceProxy 不暴露 compareAndSet/readSnapshot，renderer 锁逻辑也排除 Electron；FileStorageProvider 本身没有 compareAndSetItem，主进程偏好服务及 workspace 导入亦走无 CAS 分支。单窗口暂停、provider 的更新锁及工作区普通回滚仍有效，但跨窗口不能等同于 Web 的锁/CAS 组合。FileStorageProvider 的 set/update 先改内存、延迟 500 ms 写盘；最终 data-import IPC 没有显式 flush，后台写失败可仅日志并清 isDirty。因此成功响应与最终磁盘持久化并非同一件事，崩溃/磁盘故障需专门验证。依据：[electron-proxy.ts:10](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/preference/electron-proxy.ts:10)、[fileStorageProvider.ts:18](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/storage/fileStorageProvider.ts:18)、[fileStorageProvider.ts:310](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/storage/fileStorageProvider.ts:310)、[fileStorageProvider.ts:414](D:/Dev/myProject/prompt-optimizer/packages/core/src/services/storage/fileStorageProvider.ts:414)、[main.js:2207](D:/Dev/myProject/prompt-optimizer/packages/desktop/main.js:2207)。本轮未启动真实 Electron、多窗口或注入真实磁盘错误。
4. **图片 GC 保护有限。** session 导入有 GC 暂停；收藏导入后的 GC 会按当前收藏引用清除孤儿。不能把 GC 本身泛称为错误，但它意味着“包里有且暂时写入”的图片并非永久保留。收藏专用导入入口没有相同的全应用 session 恢复租约，跨窗口 GC/写入竞态需实测。依据：[favorite-asset-maintenance.ts:111](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/favorite-asset-maintenance.ts:111)。
5. **远程提交保护。** 远程先上传资源与两份 JSON，最后写 manifest；没有 manifest 的未完成上传通常不列为可恢复快照。远程清理在任何已提交 manifest 读失败时拒绝继续，默认只删超过 24 小时的无引用对象。这些是已有防护；不等于业务数据自洽。远程 ID 仅毫秒时间戳，极窄同时上传碰撞及长时备份/清理并发属于额外待验证条件，未作为已发生事故。依据：[remote-snapshot-backup.ts:221](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:221)、[remote-snapshot-backup.ts:432](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:432)、[remote-snapshot-backup.ts:639](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-snapshot-backup.ts:639)。
6. **外链和连接引导属于设计边界。** 外链 URL 不等于实体已保存；session 流程对部分 HTTP 图片会下载缓存，成功落库后可随图片区备份，不能一概称所有外链只存 URL。收藏 coverUrl/urls 等未缓存外链依然只携带地址。远程备份账户配置留在 localStorage，不随包迁移；Google access token 需重新授权。须在备份清单和新设备恢复说明中讲清，但不应未经产品决策自动扩大为复制全部设备配置/账户凭据。依据：[image-asset-storage.ts:138](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/image-asset-storage.ts:138)、[useImageText2ImageSession.ts:425](D:/Dev/myProject/prompt-optimizer/packages/ui/src/stores/session/useImageText2ImageSession.ts:425)、[favorite-media.ts:31](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/favorite-media.ts:31)、[remote-backup.ts:507](D:/Dev/myProject/prompt-optimizer/packages/ui/src/utils/remote-backup.ts:507)。

## 6. 推荐修复分组

本轮仅建议，不实施。按依赖顺序安排可减少互相返工：

| 分组 | 范围 | 交付/验收条件 |
| --- | --- | --- |
| A：备份数据契约与结果可信度 | F01、F02、F09、F10；核心 JSON、ZIP、远程共用 | 全局变量独立契约、受支持键确定枚举、版本迁移、统一失败报告；任何应恢复条目丢失不得显示完整成功 |
| B：身份与引用图 | F03、F04、F07、F08；分类、收藏、资产/版本、history/template/model、图片 | 明确“恢复”与“去重导入”语义，产出完整映射；每条来源/版本/图片引用可解析，或准确标记外部/缺失 |
| C：恢复计划与提交 | F05、F06；预检容量、暂存、GC、失败恢复、Desktop flush | 预检无写入；失败可恢复到检查点或提供明确可续恢复状态；完成后实体/记录/引用验证；磁盘持久化后才确认 Desktop 成功 |
| D：跨窗口与设备验收 | Web HTTPS、LAN HTTP、PWA、Extension、Desktop | 测试并发编辑、保存、刷新、崩溃与配额；不复制缓存/PWA/更新/机器配置；连接重配路径明确 |

## 7. 必要回归与验收清单

- 空设备往返：同时填充七工作区，包含四列测试文本/图片、推理、评估、比较角色、历史链、多消息/工具/变量、模型及凭据、自定义模板、收藏分类/独立标签、多资产版本和示例。逐项比较内容/身份/关联，重启后再次比较，不能只数 JSON 字段。
- 全局变量与设置：新建 PreferenceService、不先打开相应页面即可完整导出；区别全局变量、workspace 临时变量、context 覆盖变量；快照损坏或设置写失败必须显示准确失败。
- 身份冲突：同名异 ID 分类、同 ID 异名、相同 content 不同模式/标题/版本、相同 ID 不同 content、重复导入、三个 mergeStrategy；验证 origin、assetBinding、版本 source、分类路径全部正确且恢复策略幂等。
- 图片引用闭包：metadata/实体任一缺失、两者都缺失、两库错放、同 ID 异内容、仅 URL/过期 URL/blob URL、图片区被取消；分别导出全应用 ZIP、收藏 ZIP、远程；报告必须区分未选资源与意外缺失。
- 配额：空目标和已有数据目标；100 张/50 MiB 与 1000 张/200 MiB 边界；恢复最后一次保存后重新遍历实体；不得悄悄损伤保留的目标工作区/收藏图片。
- 失败注入：各服务逐条及第 N 次写入失败、第二张资源损坏/丢失、错误 workspace、分类/标签预算失败、存储 unavailable、远程中断、摘要不能计算；验证不写入的预检与可恢复的提交状态。
- 并发：A 窗口编辑、B 导出/恢复；模型生成中、模式切换中、pagehide/自动保存、GC、应用更新；覆盖 Web Locks 有/无和 Desktop renderer 场景，确保不将另一窗口新值回滚掉。
- 兼容：旧扁平 JSON、旧无 workspace 包、无资源 hash 包、缺新字段、未知顶层/区块/资源版本、不同目标内置模板/模型；不支持时在写入前拒绝或列出明确降级。
- 真机与远程：真实手机浏览器/PWA、重启或离线打开；授权后才做真实远程账户上传/下载、列表/分页/中断和再授权验收。本轮未做，不用本地 mock 通过替代业务验收。

## 8. 本轮验证记录与交付状态

系统 Node `24.19.0`，仓库 engines 要求 `^24.22.1`；未升级环境。使用 `packages/ui` 下 `node node_modules/vitest/vitest.mjs run <指定文件>`，绕过 pnpm 的 engine 拒绝。Vite 关于 native configLoader 的现有警告仍在，未作为恢复缺陷处理。

临时审计文件 `backup-integrity-audit-temp.spec.ts` 的最终 **15/15** 样本通过（20.17 s 整体测试进程，样本执行 248 ms）；断言用于证明当前行为，不能解释为完整性已经修复。最初的断言将空目标同内容收藏边界写得过宽，实测后改为“空目标保留、已有内容目标覆盖合并”；标题顺序断言也改为实际导出迭代末项，已在本报告体现。对故意注入的 warning 做了局部捕获并验证，未屏蔽业务返回值。

| 样本 | 结果 |
| --- | --- |
| 同 content 收藏，空/已有内容目标对照 | 空目标 2 条；已有内容目标 reported imported=2、final=1 |
| merge 同 favorite ID、不同内容 | favorite ID 分离，嵌入 asset ID 仍重复 |
| 同 ID 不同图片内容，ZIP/远程 | 均 skipped=1，目标字节保持 TARGET |
| session 图片 evict 配额 | restored=3、实际=2（上限缩为 2） |
| 本地第二资源损坏 | 拒绝导入，第一张已写 |
| 远程第二资源损坏 | 拒绝导入，零图片写入 |
| ZIP/远程业务语义失败 | 失败后图片、收藏都已写 |
| 历史写入异常 | 顶层 resolve、历史从旧 1 条变 0 条 |
| 图像模型坏条目 | 顶层 resolve，出现条目失败警告 |
| 文本模型坏条目 | importData resolve，出现条目失败警告 |
| context 坏条目与未知版本 | 合法项导入、坏项丢弃、函数 resolve |
| favorite 图片 reject 配额 | 拒绝，但第一张图片保留 |
| 未知 app JSON version | version=999、data={} 被接受 |
| 有 hash、无 digest 能力 | 声明 size=1、实际 20 bytes，返回 ok |
| 收藏专用 ZIP 对缺失业务图片的对照 | 正确报告 ['gone'] |

另在本轮组合运行中，现有 `data-manager-resource-package`、`remote-snapshot-backup`、`global-settings-backup` **3 组 28 项通过**。输入背景所述原会话 5 组 81 项通过是已有证据，本轮未将其冒充重新执行。没有跑全量构建或真实设备/远程账号验收。

临时测试文件已清理，独立测试图片库在测试进程中清空并关闭；只保留本报告。现有 storage-runtime-architecture 中关于“导出不含工作区/收藏/图片”的旧描述不能再用于判断数据管理页 ZIP/远程覆盖范围，本报告以当前实现为准。

## 9. 授权后的最小修复与验证

用户要求“处理，注意避免过度设计”后，沿用既有服务、备份格式、存储 provider 和工作区保护完成修复；没有增加同步服务、恢复任务数据库或通用跨存储事务框架。未提交、推送、部署或连接真实备份账户。

| 发现 | 本轮处理 |
| --- | --- |
| F01、F09 | 全局变量沿用 userSettings 的字符串传输，明确 JSON 编解码；已知业务键固定枚举。兼容旧 UI 别名，canonical 值优先；不导出任意机器偏好或 session 缓存。已经损坏成 `[object Object]` 的旧变量包明确拒绝，无法凭空恢复原值。 |
| F02 | 模型、历史、上下文和设置先做语义校验，失败向上传递；历史整包准备后单次替换，不先清空。完整应用导入先校验所有区，再依次写入；运行时失败立即停止并说明已经成功的区。 |
| F03、F04 | 分类保留身份和 parentId；全应用备份按收藏 ID 恢复，保留同内容的不同记录及资产版本，重复覆盖恢复幂等。手动收藏导入保留内容匹配／复制，改 ID 时同步派生资产来源；不安全冲突明确拒绝。收藏提交使用现有原子更新检查目标变化，并对前序分类／标签做有条件回退，避免覆盖另一窗口编辑。 |
| F05 | 图片联合容量预检；恢复保存使用 preventEviction，超限拒绝且不触发年龄／LRU 清理，普通保存行为不变。 |
| F06 | 本地、远程、收藏包均在首张图片写入前完成业务、资源和容量预检。图片写入阶段失败时补偿清理本次新增图；开始发布业务引用后保留图片，避免盲目删除造成坏引用。继续使用工作区最后提交保护，不承诺跨存储全局回滚。 |
| F07、F08 | 沿七种工作区和收藏业务引用补查缺图；同 ID 对比实际字节，异内容拒绝。图片发布业务引用前复查。兼容旧收藏图放在 session 库的包，并尊重主动取消图片区。 |
| F10 | 未知应用／上下文／收藏版本和无效资源条目拒绝；资源身份去重，汇总数量与实际条目核对。旧包从实际资源推断图片区，不再信任可能隐去实体的计数。声明 hash 但无法执行校验时明确失败；无 hash 的旧包仍兼容长度校验。 |
| Desktop | 补齐应用及收藏的只读预检 IPC；应用和收藏导入成功响应前执行文件 flush，失败不返回成功。 |

数据管理页的完整恢复现在只提供“保留已有收藏／替换已有收藏”，并说明同内容不同收藏分别保留；“复制收藏”保留在收藏库导入入口，避免复制后工作区来源绑定含糊。三种语言同步更新。

主要实现位置：

- `packages/core/src/services/data/manager.ts`、`preference/service.ts`、`favorite/manager.ts`
- `packages/core/src/services/history/manager.ts`、`model/manager.ts`、`image-model/manager.ts`、`context/repo.ts`
- `packages/ui/src/utils/data-manager-resource-package.ts`、`remote-snapshot-backup.ts`、`favorite-resource-package.ts`
- `packages/ui/src/utils/image-resource-backup.ts`、`image-resource-references.ts`
- `packages/core/src/services/image/storage.ts`、`packages/desktop/main.js` 和相关 IPC 桥

### 回归证据

- 核心服务组合回归覆盖 23 个文件、402 项。首轮有一项旧测试期待“坏模型静默跳过、其他数据仍成功”，现已改为验证坏区使全包预检失败且原存储不变；该文件 7 项复跑通过，同时复查了收藏代理 2 项，其余 22 个文件的 395 项已在组合运行通过。
- UI 9 个文件、106 项全部通过，随后补齐 missing-only 旧包兼容边界并复跑两个相关文件 48 项（新增 4 项），共覆盖 110 项。包含两条真实服务往返：本地 ZIP／内存远程对象库分别使用真实 DataManager、模型、模板、历史、上下文、收藏、偏好服务及两个独立 fake IndexedDB 图片库，验证七工作区、全局变量、工具、示例凭据、分类层级、同内容不同 ID 收藏、资产版本及图片实体。
- Desktop 19 项检查通过，包括执行实际导入 handler 验证 flush 失败不能返回成功。
- Core 类型检查与 ESM/CJS/声明构建通过；UI 类型检查、ESM/CJS 构建通过；多语言键结构和运行时语言检查通过。
- 存储架构文档同步纠正了核心 JSON、全应用 ZIP／远程快照、Desktop `.backup` 的范围区别。

### 保留的边界

预检消除了已知格式错误导致的先写后失败；运行时断电、磁盘故障或并发冲突仍可能留下已提交区，错误会明确报告。本轮没有为此增加全局事务或统一恢复日志系统。跨窗口导出的单一时间点一致性、真实手机/PWA、真实远程网络中断及真实 Electron 崩溃恢复仍未完成业务验收。

未缓存的外链仍依赖源站，远程账户连接需新设备重新配置或授权，机器配置/PWA/更新缓存仍排除。这些边界保持明确，不通过复制全部本地存储来掩盖。
