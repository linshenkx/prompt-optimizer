# 存储运行时架构与边界说明

## 📋 文档目的

本文档用于说明当前仓库在 **Web / Extension / Desktop** 三种运行环境下的真实存储结构，重点回答以下问题：

- 现在有哪些存储方式
- 各存储里有哪些逻辑区域
- 不同类型的内容会落到哪里
- 每个区域的大小限制、配额和清理策略是什么
- 当前已经建立了哪些防线
- 还存在哪些灰区和后续必须补齐的边界

本文档描述的是 **当前运行态事实**，不是理想设计图。

## 🎯 核心原则

当前系统必须严格区分两类数据：

1. **结构化业务数据**
   - 例如设置、会话快照、模型配置、收藏文本、上下文文档。
   - 应存入结构化主存储。

2. **图片二进制资产**
   - 例如上传图、生成图、收藏封面、收藏示例图。
   - 必须存入独立图片资产库。
   - 结构化主存储中只允许保存图片引用和轻量元数据，不允许保存大体积 inline base64。

这条边界是本轮存储事故复盘后的第一原则。

## 🧱 一、物理存储介质

### 1. Web / Extension 结构化主存储

- 介质：IndexedDB
- 实现：`DexieStorageProvider`
- 数据库名：`PromptOptimizerDB`
- 表结构：单表 `storage`
- 本质：一个共享的 KV 桶

相关文件：

- `packages/core/src/services/storage/dexieStorageProvider.ts`

### 2. Desktop 结构化主存储

- 介质：主进程 JSON 文件
- 实现：`FileStorageProvider`
- 主文件：`<userData>/prompt-optimizer-data.json`
- 备份文件：`<userData>/prompt-optimizer-data.json.backup`
- 写入方式：内存镜像 + 延迟写盘 + 原子替换 + 备份恢复
- `.backup` 只覆盖这个结构化主文件，不包含两个图片 IndexedDB 或远程连接的 localStorage，不能单独用作完整设备迁移包。

相关文件：

- `packages/core/src/services/storage/fileStorageProvider.ts`
- `packages/desktop/main.js`

### 3. Session 图片资产库

- 介质：IndexedDB
- 实现：`ImageStorageService`
- 数据库名：`PromptOptimizerImageDB`
- 目标：保存会话使用的上传图、生成图和相关图片资产

表结构分为两张表：

- `imageMetadata`
- `imageData`

相关文件：

- `packages/core/src/services/image/storage.ts`
- `packages/ui/src/composables/system/useAppInitializer.ts`

### 4. Favorite 图片资产库

- 介质：IndexedDB
- 实现：`ImageStorageService`
- 数据库名：`PromptOptimizerFavoriteImageDB`
- 目标：保存收藏项相关的封面图、示例图、引用图资产

表结构同样分为两张表：

- `imageMetadata`
- `imageData`

相关文件：

- `packages/core/src/services/image/storage.ts`
- `packages/ui/src/composables/system/useAppInitializer.ts`

### 5. 非主线路径 provider

代码里还存在两个 provider，但不是当前线上主路径：

- `LocalStorageProvider`
  - 浏览器本地存储实现
  - 代码声明能力上限约 `5MB`
- `MemoryStorageProvider`
  - 主要用于测试或临时环境

相关文件：

- `packages/core/src/services/storage/localStorageProvider.ts`
- `packages/core/src/services/storage/factory.ts`

## 🗂️ 二、结构化主存储里的逻辑分区

虽然 Web 物理上只有 `PromptOptimizerDB.storage` 一张表，Desktop 物理上只有一个 JSON 文件，但逻辑上可以拆成以下几块。

### 1. `pref:*` 命名空间

由 `PreferenceService` 统一管理。逻辑 key 会被自动加上 `pref:` 前缀后再落盘。

示例：

- `global-settings/v1` -> `pref:global-settings/v1`
- `session/v1/basic-system` -> `pref:session/v1/basic-system`
- `variableManager.storage` -> `pref:variableManager.storage`

相关文件：

- `packages/core/src/services/preference/service.ts`

### 2. Core 直接 key

这些 key 不经过 `PreferenceService`，直接写入主存储：

- `models`
- `image-models`
- `user-templates`
- `prompt_history`

相关文件：

- `packages/core/src/constants/storage-keys.ts`

### 3. Context 单文档区

上下文不是按多个 key 分散存，而是集中在一个文档里：

- `ctx:store`

这个文档同时保存：

- 所有 context 数据
- 当前激活的 context id
- 文档版本号

相关文件：

- `packages/core/src/services/context/constants.ts`
- `packages/core/src/services/context/repo.ts`

### 4. Favorites 直接 key 区

收藏系统也是独立 key，不经过 `PreferenceService`：

- `favorites`
- `favorite_categories`
- `favorite_stats`
- `favorite_tags`
- `favorite_categories_initialized`

相关文件：

- `packages/core/src/services/favorite/manager.ts`

### 5. 旧 UI key / 混合态 key

当前仓库仍存在一批历史 key 和新快照并存的情况，包括但不限于：

- `global-settings/v1`
- `app:settings:ui:function-mode`
- `app:settings:ui:basic-sub-mode`
- `app:settings:ui:pro-sub-mode`
- `app:settings:ui:builtin-template-language`

需要特别注意：

- `imageSubMode` 现在以路由为真源，不再直接依赖 preference 持久化
- 但应用外壳仍会把当前路由状态镜像回 `global-settings/v1`

相关文件：

- `packages/ui/src/stores/settings/useGlobalSettings.ts`
- `packages/ui/src/composables/mode/useFunctionMode.ts`
- `packages/ui/src/composables/mode/useBasicSubMode.ts`
- `packages/ui/src/composables/mode/useProSubMode.ts`
- `packages/ui/src/composables/mode/useImageSubMode.ts`
- `packages/ui/src/components/app-layout/PromptOptimizerApp.vue`

## 📦 三、不同内容现在实际存到哪里

### 1. 会话快照

各功能区会话存储在 `pref:session/v1/*` 下，包括：

- basic-system
- basic-user
- pro-multi
- pro-variable
- image-text2image
- image-image2image
- image-multiimage

这些快照保存的是结构化 JSON，例如：

- 原始 prompt
- 优化后 prompt
- 模型选择
- 模板选择
- 评测结果
- 变量值
- 图片引用 id

相关文件：

- `packages/ui/src/stores/session/useSessionManager.ts`
- `packages/ui/src/stores/session/useBasicSystemSession.ts`
- `packages/ui/src/stores/session/useBasicUserSession.ts`
- `packages/ui/src/stores/session/useProMultiMessageSession.ts`
- `packages/ui/src/stores/session/useProVariableSession.ts`
- `packages/ui/src/stores/session/useImageText2ImageSession.ts`
- `packages/ui/src/stores/session/useImageImage2ImageSession.ts`
- `packages/ui/src/stores/session/useImageMultiImageSession.ts`

### 2. Session 图片

会话中真正的图片字节不应该放进 session 快照，而是写入 `PromptOptimizerImageDB`。

session 快照里应该只保留：

- `assetId`
- `image-ref`
- 轻量 metadata

图片写入和引用转换相关文件：

- `packages/ui/src/utils/image-asset-storage.ts`
- `packages/ui/src/stores/session/imageStorageMaintenance.ts`

### 3. 收藏文本和收藏元数据

收藏项本体仍保存在结构化主存储中的 `favorites` key 下。

其中包含：

- 标题
- 正文内容
- 标签
- 分类
- functionMode
- optimizationMode
- imageSubMode
- metadata

注意：

- `favorites` 不是 `pref:*` 命名空间的一部分
- 因此它不受 `PreferenceService` 针对 session 的大小防线保护

相关文件：

- `packages/core/src/services/favorite/manager.ts`

### 4. 收藏图片资产

收藏相关图片应该写入 `PromptOptimizerFavoriteImageDB`，然后在收藏 metadata 中保存引用信息：

- `coverAssetId`
- `assetIds`
- `imageAssetIds`
- `inputImageAssetIds`

相关文件：

- `packages/ui/src/utils/favorite-media.ts`
- `packages/ui/src/components/SaveFavoriteDialog.vue`
- `packages/ui/src/composables/app/useAppPromptGardenImport.ts`

### 5. 收藏图片 fallback

当前收藏元数据 schema 仍允许 URL 型 fallback：

- `coverUrl`
- `urls`

这意味着当前系统允许：

- 远程 URL fallback

但现在已经明确禁止：

- `data:image/...;base64,...` 这种 inline 数据 URL 被写入 favorite metadata

相关文件：

- `packages/ui/src/utils/favorite-media.ts`
- `packages/core/src/services/favorite/manager.ts`

### 6. Prompt Garden 导入收藏

Prompt Garden 导入链路已经改成严格模式：

- 优先把图片落到图片资产库
- 不再允许把 inline 图片内容回退进收藏 metadata
- 自动收藏路径在图片落盘失败时会跳过收藏保存
- 确认弹窗路径在图片落盘失败时不再附带 `media` fallback

相关文件：

- `packages/ui/src/composables/app/useAppPromptGardenImport.ts`

### 7. 模型、模板、历史、上下文

这几类数据都属于结构化主存储：

- 模型配置 -> `models`
- 图像模型配置 -> `image-models`
- 用户模板 -> `user-templates`
- 历史记录 -> `prompt_history`
- 上下文文档 -> `ctx:store`

相关文件：

- `packages/core/src/services/model/manager.ts`
- `packages/core/src/services/template/manager.ts`
- `packages/core/src/services/history/manager.ts`
- `packages/core/src/services/context/repo.ts`

## 📏 四、大小限制、配额和清理策略

### 1. Session 快照大小限制

`PreferenceService` 现在对 `session/*` key 建立了硬限制：

- 单条 session 快照最大 `1 MiB`

限制覆盖：

- 写入时校验
- 读取时校验

超限行为：

- 写入失败，抛出结构化存储错误
- 读取失败时，`SessionManager` 会清理超限的单个 session key，而不是清空整库

相关文件：

- `packages/core/src/services/preference/service.ts`
- `packages/ui/src/stores/session/useSessionManager.ts`

### 2. Session 图片库配额

`PromptOptimizerImageDB` 默认配额：

- `maxCacheSize = 50 MB`
- `maxAge = 7 天`
- `maxCount = 100`
- `autoCleanupThreshold = 0.8`

清理顺序：

1. 清理过期图片
2. 超过数量上限时按最旧访问时间删除
3. 超过总容量时继续按最旧访问时间删除，直到降到目标阈值

相关文件：

- `packages/core/src/services/image/storage.ts`
- `packages/ui/src/composables/system/useAppInitializer.ts`

### 3. Favorite 图片库配额

`PromptOptimizerFavoriteImageDB` 默认配额：

- `maxCacheSize = 200 MB`
- `maxAge = 365 天`
- `maxCount = 1000`
- `autoCleanupThreshold = 0.9`

这套配置比 session 图片库更宽松，因为收藏被视为长期保留资产。

相关文件：

- `packages/core/src/services/image/storage.ts`
- `packages/ui/src/composables/system/useAppInitializer.ts`

### 4. 历史记录限制

`prompt_history` 最多保留：

- `50` 条记录

相关文件：

- `packages/core/src/services/history/manager.ts`

### 5. Desktop 文件存储运行特性

Desktop 主存储没有应用层固定大小上限，但有运行时写盘策略：

- 延迟写入：`500ms`
- 最大 flush 超时：`3s`
- 自动备份恢复：主文件失败时尝试 backup

这意味着 Desktop 不是“无限安全”，只是没有像 session 那样的显式 size cap。

相关文件：

- `packages/core/src/services/storage/fileStorageProvider.ts`

### 6. LocalStorage provider 能力上限

`LocalStorageProvider` 报告的能力上限约为：

- `5MB`

但它不是当前主线路径。

相关文件：

- `packages/core/src/services/storage/localStorageProvider.ts`

## 🔄 五、导入导出边界

导出范围取决于入口，不能把核心 JSON、数据管理页备份包和 Desktop 文件副本混为一谈。

### 1. 核心 DataManager JSON

`DataManager.exportAllData()` 包含：

- `history`
- `models`
- `imageModels`（图像模型服务可用时）
- `userTemplates`
- `userSettings`
- `contexts`
- `workspaceSessions`（七种工作区的草稿、选择、测试/评估结果及图片引用）

`userSettings` 使用明确的受支持键集合，包含 `global-settings/v1` 和结构化的全局变量快照；工作区临时变量随对应 session 保存。导入会先检查版本和各区数据，再依次写入，工作区最后提交。历史先准备完整替换再单次写入；各服务失败会向上报告，不能当作完整恢复成功。

这个 JSON 不包含独立收藏区和图片二进制，不能只靠它还原图片引用。

### 2. 数据管理页的本地 ZIP 与远程快照

默认备份范围为应用数据、收藏、会话图片和收藏图片四区；用户可以选择部分区。收藏区包括分类、标签、提示词资产、版本及示例元数据。本地 ZIP 将 JSON、资源清单和图片打包；远程快照分开保存这些对象，最后上传 manifest。

- 导出同时检查业务图片引用，缺失实体会进入缺失清单；未缓存外链仍只保留 URL。
- 恢复先校验所选业务数据、图片内容/同 ID 冲突和联合容量，再写入图片、收藏及应用数据；全应用备份按收藏 ID 匹配恢复，分类身份与层级一并处理。
- 会话图片和收藏图片仍受各自既有配额约束，恢复不能通过静默淘汰图片绕过配额。
- 不选择图片区的包不保证图片可离线恢复；不选择收藏区也不会自动补齐工作区指向收藏资产的引用。
- 远程连接参数/凭据、PWA/更新缓存及机器网络配置不在这些业务备份中，新设备需重配或重建。

### 3. Desktop 主文件副本与失败边界

`prompt-optimizer-data.json.backup` 是主进程结构化 KV 文件的恢复副本，包含该文件内的收藏和 session 等键，但不包含渲染进程的两个图片库。它与上述 ZIP/远程快照的范围不同。

恢复预检和工作区局部回滚不等于全局事务：图片、收藏、模型、历史、设置等跨存储没有统一提交/回滚。预检通过后若发生运行时存储错误，仍可能留下部分写入；恢复会报错，不能承诺整个目标回到导入前。Desktop 完整应用导入成功响应前会执行文件 flush，但这也不把多个存储变成同一事务。

**导入导出边界仍不等于整个运行环境的克隆；包中字段或资源存在，也不单独证明干净设备上的完整业务恢复。**

相关文件：

- `packages/core/src/services/data/manager.ts`
- `packages/core/src/services/preference/service.ts`
- `packages/core/src/services/data/workspace-session-transfer.ts`
- `packages/ui/src/utils/data-manager-resource-package.ts`
- `packages/ui/src/utils/remote-snapshot-backup.ts`
- `packages/ui/src/utils/image-resource-backup.ts`

## 🚨 六、当前已经建立的防线

### 1. Session 超限防线

- `session/*` 超过 `1 MiB` 直接拒绝
- 恢复时只清理超限单 key，不再整库清空

### 2. Favorite inline 图片防线

- FavoriteManager 现在拒绝 `data:image/...` inline data URL 进入 metadata

### 3. Prompt Garden 收藏严格落盘策略

- 图片资产落盘失败时不再用 inline 图片兜底

### 4. Session 图片与结构化快照分层

- 图片二进制进入独立图片库
- session 快照只保留引用

## ⚠️ 七、当前仍存在的灰区和风险

### 1. 结构化主存储物理上仍是共享桶

无论在 Web 还是 Desktop，本质上都还是单一主存储容器：

- Web 是一张 Dexie 表
- Desktop 是一个 JSON 文件

这意味着只要某条链路把大对象写错位置，影响范围就不是单个业务模块，而是整个主存储。

### 2. Favorites 不经过 PreferenceService

`favorites` 是直接 key，不走 `PreferenceService`，因此：

- session 的 `1 MiB` 防线不覆盖 favorites
- favorites 必须在自身 manager 和调用方建立独立边界

### 3. Favorite 图片资产目前更像“配额库”，不是“强引用回收库”

已确认：

- session 图片库会根据 session 快照引用做 GC
- 收藏删除链路当前只删除 `favorites` 文本记录
- 没有看到收藏删除后同步清理 `PromptOptimizerFavoriteImageDB` 孤儿资产的强引用回收逻辑

这意味着当前 favorite 图片库仍存在孤儿资产积累风险，更多依赖配额清理，而不是引用级删除。

相关文件：

- `packages/ui/src/stores/session/imageStorageMaintenance.ts`
- `packages/ui/src/components/FavoriteButton.vue`
- `packages/ui/src/components/FavoriteManager.vue`
- `packages/core/src/services/favorite/manager.ts`

### 4. UI 设置仍处于混合态

当前存在：

- 新的 `global-settings/v1`
- 旧的 `app:settings:ui:*`
- 路由真源与持久化镜像并存

这不一定立即导致数据损坏，但会提高认知成本，也会增加后续修改时误写双真源的风险。

### 5. 图片恢复取决于备份入口、资源范围与实际实体

核心 DataManager JSON 和 Desktop 主文件 `.backup` 不包含图片二进制；数据管理页完整 ZIP/远程快照已经支持两个图片库，不能再统称“导出不覆盖图片”。

完整恢复仍要求选中对应图片区、资源无缺失/冲突、目标容量足够，且未缓存的外链在新设备仍可访问。跨存储运行时失败也可能留下部分状态，须保留源备份并按具体错误处理。

因此仍需分别验证备份内容、导入结果、重启持久化与真实设备业务行为，不能仅以导出成功或资源计数作为完整恢复验收。

## 🛡️ 八、必须遵守的存储红线

后续所有功能开发必须遵守以下规则：

### 红线 1：结构化主存储禁止承载大体积二进制内容

禁止把以下内容直接写入主存储：

- 图片 base64
- data URL
- 大型二进制序列化字符串

### 红线 2：图片只能进入图片资产库

所有图片相关能力都必须遵循：

- 先落图片资产库
- 再把 `assetId` 写入业务对象

### 红线 3：任何 fallback 都不能回退到 inline 图片

允许的 fallback：

- 外部 URL
- 跳过保存
- 显式失败

禁止的 fallback：

- 将 `data:image/...` 写回 favorites 或 session metadata

### 红线 4：删除业务对象必须考虑资产回收

如果一个对象持有图片 `assetId`，那么删除该对象时必须明确以下策略之一：

- 立即删除资产
- 标记引用减少后异步 GC
- 周期性按引用扫描清理

不能只删文本记录，不考虑资产生命周期。

### 红线 5：provider 级测试必须覆盖真实请求体和真实落盘结果

仅验证“调用链路经过某个 adapter”是不够的。

必须补齐：

- provider 级 payload 断言
- 存储层实际写入结果断言
- 大对象拒绝与回退行为断言

## 🧭 九、建议的后续治理方向

### 1. Favorite 图片库补引用级 GC

目标：

- 删除收藏时同步处理收藏图片资产
- 或建立 favorites 专属的引用扫描 + 清理任务

### 2. 为 favorites 建立独立 size guard

建议：

- 不依赖 `PreferenceService`
- 在 `FavoriteManager` 或更底层 provider 边界增加单项和总量限制

### 3. 收口 UI 设置双真源

建议逐步统一：

- 哪些由路由主导
- 哪些由 `global-settings/v1` 主导
- 哪些旧 key 只保留迁移读，不再写入

### 4. 补齐“结构化存储禁止 inline 图片”的系统性测试

建议至少覆盖：

- session
- favorites
- Prompt Garden import
- SaveFavoriteDialog
- 未来任何带图片快照的新功能

## ✅ 十、结论

当前系统的真实运行时存储结构可以总结为：

1. **结构化主存储**
   - 保存设置、会话快照、模型、模板、历史、上下文、收藏文本等结构化数据。

2. **Session 图片资产库**
   - 保存会话期间使用的图片字节。

3. **Favorite 图片资产库**
   - 保存收藏相关的图片资产。

当前已经建立了两条关键防线：

- `session/*` 的 `1 MiB` 硬限制
- favorites metadata 禁止 inline 图片 data URL

但要彻底避免同类事故再次发生，还需要继续补齐：

- favorite 图片资产回收
- favorites 的独立容量防线
- 旧 UI key 的收口
- provider / storage 边界的强测试

只有当“结构化数据”和“图片资产”在架构、代码、测试、删除回收四个层面都被强制分层后，这类问题才算真正从根上解决。
