# PO-SHARED-STORAGE-20261115

本工作树实施第 1、2 步：SQLite provider、独立进程并发验证、桌面启动自动迁移。基线为远端 `develop` 的 `71f5151148e037dbb790fd6a8a4ff106ca75f52e`，分支 `feature/shared-storage-20261115`。不推送、合并或发布，未调用付费模型。打包验收曾误启动真实应用，影响与纠正见下方记录。

## 接入与事务

- 使用运行时内置 `node:sqlite`，无新增数据库服务、第三方原生驱动或安装依赖。仓库 Node 要求 `^24.22.1`，锁定 Electron `44.9.3`；实际 Windows x64 Electron 内嵌 Node `24.22.0`、SQLite `3.53.4`。终端默认 Node 26，验证另用隔离下载的 Node `24.22.1`，未切换全机版本。
- Node 专用入口 `@prompt-optimizer/core/node` 导出 `SQLiteStorageProvider`、`openDesktopStorage` 和文件名常量。通用入口不引用 SQLite；工厂识别 `sqlite` 类型但要求从专用入口显式创建，避免缓存错误的数据路径。构建必须保留 `node:` 前缀，tsup 默认会删除它。
- 业务仍为字符串 KV，表 `storage_kv(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT`；不改变模型、模板、历史等 JSON 内容。迁移状态在独立 `storage_metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT` 表，不占业务键；标记键为 `legacy-json-migration`，值为 JSON `{version:1,source:'json'|'backup'|'empty',itemCount:n}`。
- WAL、`synchronous=FULL`；`set/remove/clear/updateData/CAS/batch` 使用短写事务。先 `BEGIN IMMEDIATE` 再读数据。默认一次 native 锁等待 50ms，最多重试 12 次、间隔 25ms，仅重试获取事务，不重放已执行的业务回调。实际墙钟等待受运行时调度影响，不是实时保证。
- `updateData` 回调必须同步、无网络或其他 I/O。解析失败、不可序列化、回调异常或 SQL 异常均不提交；业务异常透传。批量中任何操作失败则整体回滚。失败后连接可继续使用；若回滚本身失败则禁用连接。`close()` 幂等、等待已排队操作，拒绝新增请求；`flush()` 无整文件写入或强制 checkpoint。

## 迁移状态与恢复

桌面先等待 `openDesktopStorage(userData)` 成功，再创建业务服务。固定文件为 `prompt-optimizer-data.sqlite`。

| 检测状态 | 行为 |
| --- | --- |
| 无迁移标记、业务表空、JSON 有效 | 原字符串逐字复制；旧格式非字符串值按旧 provider 的规则 JSON 序列化 |
| 主 JSON 缺失/格式无效、已有 `.json.backup` 有效 | 从已有副本导入；两份旧文件都不修改 |
| 两份旧源均不存在 | 初始化空库并标记，防止以后误导入陈旧文件 |
| 存在但无有效旧源，或读权限/I/O 错误 | 拒绝迁移，保持源不变，不创建成功标记 |
| 有版本 1 的有效完成标记 | SQLite 权威；不再读取旧源，旧源变坏或被修改也不覆盖新库 |
| 无标记但业务表非空、未知标记版本、新库损坏 | 停止启动，要求明确处理，不合并、不覆盖、不自动退回 JSON |

加载本地旧源、插入、逐项读取比对（包括键总数）、写完成标记、提交在同一事务。进程中断在提交前会回滚，重启重新导入；提交后重启直接复用新库。`clearAll` 只清业务表，保留标记，防止旧数据复活。

保留源就是恢复入口，不额外创建配置或数据备份，也不删除旧文件。迁移失败时源仍可由旧版本读取，修正阻塞条件后可重试；本版会停止启动，不在失败后继续写一套分叉的 JSON。迁移成功后旧文件是历史快照，回退旧版本不会看到新写入，不能把旧文件当作当前库备份。迁移时必须关闭仍在写旧 JSON 的旧版进程；不支持新旧版本混用同一目录。

## 业务并发边界

- 已最小修复模板 `saveTemplate/deleteTemplate` 和历史 `deleteRecord/deleteChain`：整份文档读改写移入 `updateData`。模板和历史的真实 manager 已用独立进程验证。
- 同一个模板/模型的全量编辑仍是后提交覆盖前提交；导入整份数据和清空也是显式替换，不提供业务冲突合并。
- 模型及图片模型初始化仍有事务外读取、异步升级、整份 `setItem` 的路径；上下文 `getStoreDoc` 的首次创建/旧格式回写、启动修复检查也有相同边界。收藏分类/标签/版本等跨键流程不等于一个事务。多区域导入、图片 IndexedDB 与结构化存储之间没有统一事务。
- SQLite provider 无数据缓存；页面会话状态、PreferenceService 的键缓存、manager 初始化状态仍可能过期。没有实现跨进程变更通知或界面自动刷新。

## 验证与证据范围

- 12 项存储与迁移测试在 Windows x64、Node 24.22.1 全部通过。两个独立进程各递增 250 次结果为 500；CAS 只有一个成功；250 批写入与单语句快照读取并行（最后一轮 48464 次快照、246 个不同已提交代数）；SQL trigger 中途失败整体回滚；写锁耗尽约 254ms 后报错，释放后恢复；正常等待锁后成功；关闭、重开及业务回调失败；实际模板和历史 manager 的并发增删。包含拒绝将打包 EXE 作为测试解释器启动的回归检查。
- 同套独立进程用 Electron 44.9.3 的 `ELECTRON_RUN_AS_NODE` 执行通过；迁移 worker 使用 CJS 构建，provider worker 使用 ESM 构建。迁移覆盖真实旧 KV 格式、已有副本、空目录、损坏输入、注入的 SQL 写入故障、双进程冷启动、插入第一条后杀进程、幂等重启、清空后不复活、歧义/未来状态/损坏新库/锁等待失败后重试。
- 核心类型检查及核心测试通过：142 文件、1488 测试通过，18 文件/141 测试按仓库设置跳过。桌面配置测试 56 项、桌面 IPC 检查 20 项通过。未用模拟的两个 Promise 代替进程并发。
- UI bundle、Web 和 Electron renderer 构建通过；产物检索无 `node:sqlite`、`SQLiteStorageProvider` 或迁移状态实现。原有 FileStorage 导出的 `fs/promises` / `path` 浏览器外部化警告及体积警告仍存在。
- `pnpm test:storage:electron`：无窗口的真实 Electron main 进程、隔离 userData、CJS package 子路径解析、首次迁移/写入/关闭通过。Windows x64 `electron-builder --dir --publish never` 通过；用开发 Electron 加载实际 `app.asar` 内的 Node 子入口、在临时目录迁移/写入/关闭通过（`node scripts/sqlite-electron-smoke.mjs packages/desktop/dist/win-unpacked/resources/app.asar`）。不启动打包 EXE。未签名，也未制作安装包或发布。
- 上项是 Electron 主进程环境中的 **存储模块兼容检查**。`createRequire(app.asar/main.js)` 只建立模块解析位置，没有执行应用 `main.js`。它不能证明实际主入口的隔离启动、服务初始化、renderer IPC 和退出链路完整通过；误启动真实目录也不计为这些链路的有效验收。打包目录用于入口布局和模块兼容检查，不作为最终提交的发版工件。
- `pnpm test:repo` 的 99 项及 locale/runtime-language 检查通过；UI declarations 构建、core / Web / Extension 类型检查通过。
- `.github/workflows/test.yml` 已接入进程和迁移检查，后续 CI 在 Linux 执行；本轮没有声称 Linux/macOS 或 ARM 已实际验收，也未运行图形界面完整业务回归、断电/磁盘满/真实权限失败测试。

## 验收误启动及尚待清理

2026-11-15 12:26（北京时间），首次打包验收错误地将 `PromptOptimizer.exe` 当作 Electron 解释器传入脚本。打包应用忽略该脚本参数，启动了自身 main，在已有 `%APPDATA%\@prompt-optimizer\desktop` 上执行了迁移。该次启动已终止；没有打印业务数据或密钥，但违反了本轮不访问真实数据目录的要求。

本次元数据检查记录（北京时间，未读取或打印业务载荷）：

| 文件 | 长度 | 最后修改时间 |
| --- | --- | --- |
| `prompt-optimizer-data.json` | 865717 字节 | 2026-10-22 11:47:26.4608683 |
| `prompt-optimizer-data.json.backup` | 865717 字节 | 2026-10-22 11:46:56.4646799 |

源文件修改时间早于误启动，迁移实现也只读旧源；没有启动前内容哈希，不能将元数据记录描述成前后逐字比对。本次新建 SQLite 主文件的创建时间为 12:26:14.7943294，WAL/SHM 为 12:26:14.8186549。

可确认 `Preferences` 修改时间变为 12:26:24.9633976，`Code Cache`、`Session Storage` 等部分缓存目录元数据在本次启动期间更新，并新建了部分 GPU/着色器缓存。未审计具体偏好字段、图片 IndexedDB 记录或所有缓存文件的内容差异，因此不能确认每一项业务影响，也不能声称整个目录恢复到了启动前。既有偏好、缓存和图片库均未被清理或回写。

用户已明确授权仅删除上述三份本次新建 SQLite 文件。自动审批在授权后仍拒绝清理，只返回 `blocked by policy`，所以三份文件目前仍在，需用户手动移除（先确保该测试程序已关闭）。原 JSON、原备份及所有既有目录不可删除；本轮没有绕过审批换工具执行删除。

待清理文件的实际路径：

- `C:\Users\15588\AppData\Roaming\@prompt-optimizer\desktop\prompt-optimizer-data.sqlite`
- `C:\Users\15588\AppData\Roaming\@prompt-optimizer\desktop\prompt-optimizer-data.sqlite-wal`
- `C:\Users\15588\AppData\Roaming\@prompt-optimizer\desktop\prompt-optimizer-data.sqlite-shm`

测试已改为只允许已安装的开发 Electron 解释器；可选参数只能是 `.asar` 文件，EXE 参数在启动进程前即拒绝。对应回归检查覆盖单个 EXE 参数与 EXE + ASAR 两种误用，均已通过。helper 先断言目录属于本轮临时目录，再设置 `app.setPath('userData', directory)` / `sessionData` 并核对 userData；之后才在 `whenReady` 回调里加载存储模块、读取测试源并调用 `openDesktopStorage`，所以应用存储初始化在隔离路径设置后发生。后续打包模块检查采用此路径并已通过。脚本及验证入口分别为 `scripts/sqlite-electron-smoke.mjs`、`scripts/helpers/sqlite-electron-smoke.cjs` 和 `scripts/sqlite-migration.test.mjs`，无需为文档收尾重跑已通过检查。

## 下一阶段约束

调用约定：`new SQLiteStorageProvider(databasePath, options?)` 是底层 KV 接口，可创建新库，不检查桌面迁移状态；`await openDesktopStorage(userDataPath, options?)` 返回 `{ provider, migration }`，会建目录、建 schema、必要时导入旧源。两者均有 `await provider.close()`。本轮没有提供“仅打开已有且已完成迁移的库”的无副作用 API，MCP 接入前必须补齐或通过桌面受控桥接，不能把底层构造器当成只读查询入口。

第 3 步 MCP 复用同一 SQLite provider、业务数据格式和用户明确选择的桌面 userData，但默认接入不能调用会创建和迁移数据的 `openDesktopStorage` bootstrap。接入前需新增“仅打开已有且已完成迁移的库”的连接入口，或使用受控桌面桥接；缺库、未迁移或状态异常时明确报错，不静默建库、建 schema、迁移或创建默认业务数据。先解决上述初始化读改写及页面刷新边界，再允许并发业务写入。MCP 当前仍用独立内存，本轮未改。不得在数据库事务里运行模型请求，也不能把 SQLite 文件放在网络共享目录上。

第 4 步浏览器仍是 Dexie/IndexedDB，需要另行研究经过授权的 Chrome 数据桥接。桌面的 `PromptOptimizerImageDB` 和 `PromptOptimizerFavoriteImageDB` 也仍在 renderer IndexedDB，本次没有迁移图片。第 5 步已提前与第 3 步并行设计，按工具已有的多模型测试、比较、评估能力梳理 MCP；设计并行不表示共享数据接入或业务写入已经验收。第 6 步最后考虑 Skill，不引入项目管理服务。

运行时依据：[Node 24 SQLite 文档](https://nodejs.org/download/release/v24.22.1/docs/api/sqlite.html)、[SQLite WAL](https://sqlite.org/wal.html)、[SQLite 事务](https://sqlite.org/lang_transaction.html)。
