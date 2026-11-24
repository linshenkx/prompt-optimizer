# PO-SHARED-STORAGE-20261115

本工作树实施第 1、2 步：SQLite provider、独立进程并发验证、桌面启动自动迁移，并在第 3 轮补充既有库只读入口与当前 KV 快照导出。基线为远端 `develop` 的 `71f5151148e037dbb790fd6a8a4ff106ca75f52e`，分支 `feature/shared-storage-20261115`。不推送、合并或发布，未调用付费模型。打包验收曾误启动真实应用，影响与纠正见下方记录。

## 接入与事务

- 使用运行时内置 `node:sqlite`，无新增数据库服务、第三方原生驱动或安装依赖。仓库 Node 要求 `^24.22.1`，锁定 Electron `44.9.3`；实际 Windows x64 Electron 内嵌 Node `24.22.0`、SQLite `3.53.4`。终端默认 Node 26，验证另用隔离下载的 Node `24.22.1`，未切换全机版本。
- Node 专用入口 `@prompt-optimizer/core/node` 导出 `SQLiteStorageProvider`、`openDesktopStorage` 和文件名常量。通用入口不引用 SQLite；工厂识别 `sqlite` 类型但要求从专用入口显式创建，避免缓存错误的数据路径。构建必须保留 `node:` 前缀，tsup 默认会删除它。
- 业务仍为字符串 KV，表 `storage_kv(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT`；不改变模型、模板、历史等 JSON 内容。迁移状态在独立 `storage_metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT` 表，不占业务键；标记键为 `legacy-json-migration`，值包含 `{version:1,source:'json'|'backup'|'empty',itemCount:n}`。v2.16.0 集成线又加入内容指纹，详见下方分叉检查。
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
| 有版本 1 的有效完成标记 | 继续以 SQLite 为准。桌面启动及显式可写接入先检查本地旧源是否分叉，判断见下方 |
| 无标记但业务表非空、未知标记版本、新库损坏 | 停止启动，要求明确处理，不合并、不覆盖、不自动退回 JSON |
| 现存库缺表、结构不兼容、未知 user_version、非 WAL 或零字节文件 | 拒绝启动，不补空表、不修复、不重导旧 JSON；零字节文件仅有界等待并发冷启动写入头部 |

加载本地旧源、插入、逐项读取比对（包括键总数）、写完成标记、提交在同一事务。进程中断在迁移事务提交前会回滚，重启重新导入；提交后重启核对旧源状态，沿用新库中的内容。初始 schema 事务完整回滚、schema_version/user_version 均为 0 且没有 schema 对象时也可重试；已提交过 DDL 后将全部表删除不属于初始状态。遗留零字节文件无法区分创建中断与截断损坏，等待后仍为空则停止，不能声称所有初始化中断均可自动恢复。`clearAll` 只清业务表，保留标记，防止旧数据复活。

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
- 上项是第 1 轮的 **存储模块兼容检查**。`createRequire(app.asar/main.js)` 只建立模块解析位置，没有执行应用 `main.js`。它本身不能证明实际主入口的隔离启动、服务初始化、renderer IPC 和退出链路通过；误启动真实目录也不计为有效验收。第 2 轮另行执行实际入口的有界隔离检查，见下一节。打包目录用于入口布局和模块兼容检查，不作为最终提交的发版工件。
- `pnpm test:repo` 的 99 项及 locale/runtime-language 检查通过；UI declarations 构建、core / Web / Extension 类型检查通过。
- `.github/workflows/test.yml` 已接入进程和迁移检查，后续 CI 在 Linux 执行；本轮没有声称 Linux/macOS 或 ARM 已实际验收，也未运行图形界面完整业务回归、断电/磁盘满/真实权限失败测试。

## 第 2 轮：实际 main 启动与退出的隔离检查

2026-11-15，Windows x64、开发 Electron 44.9.3 / Node 24.22.0 / SQLite 3.53.4。复现入口为 `pnpm test:storage:desktop-main`（仍需先有本工作树 core 构建和依赖）；本次分别执行该命令包含的 guard 测试与实际入口脚本。脚本不接收可执行文件、用户目录或外部环境参数。只启动依赖中的开发 `electron.exe`，不启动打包 EXE。

隔离在加载应用入口前建立：

- 父进程先在本工作树 `.codex-run/po-desktop-main-r2-*` 下创建唯一目录、启动器及所需路径。只复制明确列出的 desktop JS、package metadata 和图标，逐项校验 SHA-256；源 `.env` 和用户数据不复制。实际 `main.js` / `preload.js` 与本工作树内容逐字一致。依赖目录仅作代码读取来源，经链接指向本工作树依赖；路径检查解析链接的真实目标，拒绝沿依赖链接写出隔离目录。
- 子进程只传入必要 Windows 系统定位变量、受控 PATH、生产运行模式和全部指向临时目录的 HOME/USERPROFILE/APPDATA/LOCALAPPDATA/TEMP/TMP/XDG 路径，排除继承的 provider、proxy、portable、dotenv 和 Node/Electron 启动配置。Chromium user-data/cache/crash 目录也在启动参数中预先指定，覆盖 bootstrap 执行前的初始化路径。
- bootstrap 先创建并设置、校验 `userData/sessionData/appData/home/temp/logs/crashDumps` 及其他用户目录，再安装 `getPath/setPath/setAppLogsPath`、JS 文件读写和 SQLite 打开路径检查；之后才加载实际 main、ConsoleLogger、dotenv、业务服务。目录外写入、未授权源码目录外读取和隔离目录外 `.env*` 读取会被拒绝。dotenv 只允许本轮两份空文件，bootstrap 还禁止隐式 `dotenv/config`。
- 运行前验证了父目录逃逸、同名前缀目录、依赖链接写出、外部 `.env.local` 和实际写调用拒绝；两项独立 guard 测试通过。每次 Electron 运行又执行 5 项无副作用的拒绝检查。应用调用 `setPath` 后无法改回外部用户数据路径。
- 窗口强制隐藏，只加载本轮合成 HTML，使用真实 preload。Node/Electron/Chromium 网络、子进程、shell 打开、更新检查/下载/安装和窗口显示均被拦截；系统代理解析只返回 DIRECT，不读取真实 PAC。每个进程 25 秒超时，有失败即保留证据并停止该轮。

实际执行结果：

| 检查 | 首次启动 | 同一临时目录重启 |
| --- | --- | --- |
| 退出状态 / 用时 | 0 / 7465ms | 0 / 7058ms |
| 旧 JSON / 迁移状态 | 合成单键源导入，版本 1、source=json、itemCount=1 | 沿用已提交标记与新库 |
| 真实 preload → IPC | 读取合成偏好、写新偏好、查询 SQLite 路径 | 读取上次持久化的新偏好，再写入成功 |
| 生命周期 | flush 完成、close 完成、normal-quit | flush 完成、close 完成、normal-quit |
| 退出后的数据库 | 父进程重新连接，quick_check=ok，写事务可获取并回滚 | 同左 |
| 原合成源与备份 | 源逐字相同，无新增 `.backup` | 同左 |
| 运行期 guard 违规 / 请求计数（不含预检） | 0 / 0 | 0 / 0 |

该检查发现并修正了第 1 轮新增退出钩子的真实问题：在 `will-quit` 的 Promise microtask 中立即再次 `app.quit()`，连接虽已关闭但应用未进入最终退出，两次诊断运行均在 25 秒终止。现在将重入安排到 `setImmediate`，随后上述两阶段均正常结束。这是本轮唯一生产代码修正，不扩展业务能力。通过检查的实际 main SHA-256：`97591c01bad02bebf7cd6c69b8b1319a30b23b9e67601b0e662c2fbc5769eafd`。

证据保留在本工作树 `.codex-run/po-desktop-main-r2-BXy8Tm/`：`manifest.json`（入口及复制代码哈希）、`first-report.json` / `restart-report.json`（顺序、路径、关闭和 guard 记录）、各阶段 stdout/stderr、`summary.json`。诊断证据 `.codex-run/po-desktop-main-r2-PRuWVM/first-progress.json` 显示修正前停在 close 完成、没有 normal-quit。脚本和日志仅使用合成载荷；本轮没有再访问、启动或清理此前真实目录。

范围仍有限：执行的是字节一致的实际源码入口及真实初始化/日志/存储/退出代码，运行环境为开发 Electron（`app.isPackaged=false`），用隐藏合成页面覆盖三个真实 IPC。没有验收完整产品 UI、其他 IPC、模型调用、图片 IndexedDB 业务、安装器、打包 EXE 的 packaged/portable 分支、更新安装退出、macOS/Linux 或系统关机。测试对路径和网络的约束是经审查入口的测试边界，不是通用操作系统沙箱。现场恢复状态继续按下一节独立记录；这些结果不单独宣布第 1/2 步整体验收完成。

## 第 3 轮：既有库只读入口、快照与启动结构校验

新增 API 均在 Node 专用入口 `@prompt-optimizer/core/node`，没有加入浏览器通用入口：

| API | 行为 |
| --- | --- |
| `SQLiteStorageProvider.openExistingReadOnly(absoluteDatabasePath, options?)` | 返回 `{ provider, migration }`；要求显式绝对路径及已存在、已完成迁移的兼容数据库 |
| `openExistingDesktopStorage(absoluteUserDataPath, options?)` | 固定打开该目录的 `prompt-optimizer-data.sqlite`，复用上述原生只读连接 |
| `provider.getAllEntries()` | 一条 `SELECT key,value … ORDER BY key` 返回完整业务 KV；不是先列键再逐项读取 |
| `exportDesktopStorageAsLegacyJSON(absoluteUserDataPath, options?)` | 只读打开既有库、取一份当前已提交的完整 KV 快照，返回旧格式外层 JSON 字符串并关闭连接 |

既有只读入口不创建目录、数据库、表、迁移标记或默认业务数据，也不读旧 JSON。缺库、未迁移、非法/未来标记、schema 或完整性异常均失败。第 3 轮只提供只读模式，后续集成新增显式可写入口，详见下方。`readOnly=true`、capabilities 的 atomic/batch=false；set/remove/clear/CAS/update/batch/initialize/flush 全部在执行回调前拒绝，native `readOnly` 也独立阻止直接 SQL 写入。`getItem/getAllKeys/getAllEntries/close` 可用，close 幂等。只读不代表文件系统完全无副作用：SQLite 的 WAL/SHM 访问及锁定仍可能涉及操作系统记账，不能承诺文件字节、时间戳或辅助文件完全不变。

结构校验要求两张 main STRICT 行表的 key/value 列、类型、主键、NOT NULL、默认值及 hidden 标志与本版一致，WAL、user_version=0、quick_check=ok；完成标记严格检查 version/source/itemCount，计数是迁移时数量，不与清空后的当前行数混淆。可写 desktop bootstrap 原先先 `CREATE TABLE IF NOT EXISTS`、后读完成标记，确有缺失业务表被补为空表后沿用旧标记的缺口。本轮改为在任何 DDL 和 journal_mode 变更前检查既有结构，取得写锁后再次检查；只为未初始化 schema 建表。已有库缺表、表变为 view、列不兼容、未知版本或全部表被删均拒绝，不作修复。

导出包含迁移后的新增/修改及未知业务键，排除内部 metadata；空键、空值、`__proto__` 和字符串内 NUL/中文均按不透明字符串保留。函数不写导出文件、不新增备份、不输出载荷，也未接入 MCP 工具。原 JSON 仍是历史快照，不能称为当前备份；即使拿到新的字符串，也没有因此承诺所有旧版业务、图片 IndexedDB 或降级流程都无损兼容。独立业务恢复与 DataManager 验证由主任务负责，不纳入本轮这两份测试的结论。

最终构建在缺表修复后执行 core TypeScript noEmit 检查及 index/node 的 ESM、CJS、声明构建，全部通过。当前 dist 对应本次提交的生产源码；其后仅修改文档/测试，没有再次改变生产代码。最终证据（均在本工作树 `.codex-run`，合成数据及最小环境，所有用户/TEMP 路径指向各自临时目录）：

- Windows x64 Node **24.22.1**：`po-storage-r3-final-VwBv6W/node-tests.tap`，`sqlite-storage.test.mjs` + `sqlite-migration.test.mjs` 共 **29 项通过、0 失败，14257ms**。两个进程递增合计 500；跨进程批次 SQL 快照 41689 次/247 个代数，provider 完整 KV 快照 18917 次/230 个代数均一致；锁超时 264ms 后恢复，原有 CAS/批量失败回滚/杀进程/manager 并发检查仍通过。
- Windows x64 开发 Electron **44.9.3**、内嵌 Node **24.22.0** / SQLite **3.53.4**：`po-storage-r3-final-electron-4bKPUw/electron-tests.tap`，`ELECTRON_RUN_AS_NODE` 下迁移/既有库测试共 **23 项通过、0 失败，4218ms**。未启动窗口或打包 EXE。
- 两种运行时都覆盖：只读全部写入口和原生写 SQL 拒绝、共享桌面已提交新值、当前全量导出、缺库不建目录/库/表、迁移状态异常、8 类结构故障下只读入口及可写 bootstrap 均拒绝且 schema/KV/metadata/旧源保持、已删全部表拒绝、初始 DDL 回滚可重试、清空不复活旧 JSON。
- `EACCES/EIO` 在合成源文件的读取边界注入；即使有有效旧备份，也不读取备份、不生成成功标记，原两份源不变，解除注入后可重试。不是实际 Windows ACL 或物理磁盘故障测试。

本轮未访问或清理真实用户目录，保留主库/WAL/SHM 的现场约束不变。未新增完整 UI/打包主入口验收，也没有声称 Linux/macOS/ARM、跨用户权限、磁盘满、文件被外部替换/截断或运行期间 schema 被外部修改已验证。

## 第 4 轮：统筹独立业务与真实 IPC 回归

2026-11-15，统筹在接受 `2d6e04f9` 的源代码和原始测试证据后，新增 `scripts/sqlite-business-regression.test.mjs`，扩展实际 main 的隔离检查。没有再访问、打开、复制或修改用户真实数据，所有载荷均在本工作树新建的 `.codex-run` 合成目录内。`test:storage` 和现有 CI 存储步骤已包含新增业务回归。

- **Node 24.22.1 / SQLite 3.53.4**：用真实 FileStorageProvider 和业务 manager 生成旧格式数据，迁移前后逐项比较全部 22 个 KV；模型、图片模型配置、自定义参数、模板、历史链、上下文、收藏/分类/独立标签、偏好/变量以及 8 种工作区草稿和结果保持。迁移后新增/修改数据，关闭并重开仍可读取；原合成 JSON 字节不变。
- 调用 `exportDesktopStorageAsLegacyJSON()` 得到**当前**完整业务 KV，写入另一个全新合成目录，再用未修改的 FileStorageProvider 逐键读取，保留未知键和升级后的新增键。该回退数据由新库导出；没有把迁移前 JSON 当作升级后数据的回退来源。
- 分别调用现有 DataManager 和收藏导出/导入接口，在第三个空 JSON 目录恢复真实业务查询。严格对照所有内容、ID、版本、配置及会话，单独检查既有导入逻辑的时间戳刷新、默认设置规范化和空自定义参数映射省略。此路径本来不包含未知 KV，与完整 KV 恢复路径区分。定向删除收藏、历史和模板不影响模型或其他数据。
- 新业务测试、既有隔离边界测试和 package-script 检查合计 **16/16** 通过，日志 `po-business-r3-accepted.log`；业务证据 `po-storage-business-r3-J0qCGZ/summary.json`。未为这些新验证重跑已通过且无新增影响的全仓测试。
- **开发 Electron 44.9.3 / Node 24.22.0 / SQLite 3.53.4**：执行字节一致的实际 main、真实 preload、主进程服务和隐藏合成 renderer。首次启动及重启都验证模型新增/修改、模板、历史、上下文选择、收藏/分类/独立标签、变量工作区 A/B 草稿、两类导出导入、非法导入不覆盖已有模型/草稿，以及单项删除。两阶段均正常 flush/close/quit，网络请求和隔离违规均为 0；首启 12099ms、重启 6634ms。
- 实际 main 的 SHA-256 仍为 `97591c01bad02bebf7cd6c69b8b1319a30b23b9e67601b0e662c2fbc5769eafd`，未以修改过的生产入口绕过初始化或退出逻辑。证据 `po-desktop-main-r2-XnEWao/summary.json`、各阶段报告与日志。

首次将两个读取大型 SDK 的回归进程同时运行时，桌面隔离进程在存储打开前触及 25 秒上限，证据保留于 `po-desktop-main-r2-qojJvk/`；随后改为串行执行，在同一 25 秒上限内完成上述两阶段。没有通过增加超时、放开路径/网络边界或启动打包 EXE 获得通过。

这些证据覆盖存储切换和真实业务调用，**不是完整产品 UI、真实模型、图片二进制/IndexedDB、安装器、打包 EXE、自动更新或跨平台验收**。JSON 恢复验证使用本工作树未修改的 FileStorageProvider 和当前同版业务服务，不能据此保证任意更旧版本可理解未来新增功能。原用户目录的内容核对及偏好/缓存影响仍是独立未验收事项；本轮不清理其 SQLite/WAL/SHM。

## 验收误启动与现场文件保留

2026-11-15 12:26（北京时间），首次打包验收错误地将 `PromptOptimizer.exe` 当作 Electron 解释器传入脚本。打包应用忽略该脚本参数，启动了自身 main，在已有 `%APPDATA%\@prompt-optimizer\desktop` 上执行了迁移。该次启动已终止；没有打印业务数据或密钥，但违反了本轮不访问真实数据目录的要求。

本次元数据检查记录（北京时间，未读取或打印业务载荷）：

| 文件 | 长度 | 最后修改时间 |
| --- | --- | --- |
| `prompt-optimizer-data.json` | 865717 字节 | 2026-10-22 11:47:26.4608683 |
| `prompt-optimizer-data.json.backup` | 865717 字节 | 2026-10-22 11:46:56.4646799 |

源文件修改时间早于误启动，迁移实现也只读旧源；没有启动前内容哈希，不能将元数据记录描述成前后逐字比对。本次新建 SQLite 主文件的创建时间为 12:26:14.7943294，WAL/SHM 为 12:26:14.8186549。

可确认 `Preferences` 修改时间变为 12:26:24.9633976，`Code Cache`、`Session Storage` 等部分缓存目录元数据在本次启动期间更新，并新建了部分 GPU/着色器缓存。未审计具体偏好字段、图片 IndexedDB 记录或所有缓存文件的内容差异，因此不能确认每一项业务影响，也不能声称整个目录恢复到了启动前。既有偏好、缓存和图片库均未被清理或回写。

事故发生后，用户曾授权仅删除上述三份新建 SQLite 文件。自动审批在授权后仍拒绝清理，只返回 `blocked by policy`，本会话没有执行删除或换工具绕过审批。**后续统筹已收回手动删除建议；最新约束是 SQLite 主文件、WAL、SHM 全部保留，在完成内容核对前不移除任何一份。**原 JSON、原备份及所有既有目录同样保留。本轮不读取、打开、复制或修改真实目录来重新核对现场。

按最新约束需保留的三份文件路径：

- `C:\Users\15588\AppData\Roaming\@prompt-optimizer\desktop\prompt-optimizer-data.sqlite`
- `C:\Users\15588\AppData\Roaming\@prompt-optimizer\desktop\prompt-optimizer-data.sqlite-wal`
- `C:\Users\15588\AppData\Roaming\@prompt-optimizer\desktop\prompt-optimizer-data.sqlite-shm`

测试已改为只允许已安装的开发 Electron 解释器；可选参数只能是 `.asar` 文件，EXE 参数在启动进程前即拒绝。对应回归检查覆盖单个 EXE 参数与 EXE + ASAR 两种误用，均已通过。helper 先断言目录属于本轮临时目录，再设置 `app.setPath('userData', directory)` / `sessionData` 并核对 userData；之后才在 `whenReady` 回调里加载存储模块、读取测试源并调用 `openDesktopStorage`，所以应用存储初始化在隔离路径设置后发生。后续打包模块检查采用此路径并已通过。脚本及验证入口分别为 `scripts/sqlite-electron-smoke.mjs`、`scripts/helpers/sqlite-electron-smoke.cjs` 和 `scripts/sqlite-migration.test.mjs`，无需为文档收尾重跑已通过检查。

## v2.16.0 集成中的迁移分叉检查

SQLite 的迁移标记保留版本 1 和原始迁移来源与数量。新标记追加按键排序的实际迁移 KV 的 SHA-256 指纹。迁移来源是主 JSON 时，同时尽力记录已存在、可读备份的指纹，供主文件缺失或损坏时识别历史备份。表和业务值沿用旧结构，标记的公开读取结果仍只有版本、来源和迁移数量。

| 迁移后旧源状态 | 决策 |
| --- | --- |
| 可读主 JSON 与已迁移指纹相同 | 启动或接入已有 SQLite，保留其中的新增数据。JSON 外层顺序、缩进和换行可以变化 |
| 主 JSON 缺失或损坏，现有备份匹配原迁移源或当时已记录的备份 | 启动或接入已有 SQLite |
| 主 JSON 和备份均缺失或格式无效 | 沿用 SQLite 的已提交数据 |
| 现有可读旧源与 SQLite 的全部业务 KV 相同，包括旧标记缺少指纹的情况 | 在事务内更新来源指纹，保留原业务 KV |
| 有可读旧源，无法通过指纹确认其历史来源，且与当前 SQLite 的业务 KV 不同 | 报出 `StorageError.params.reason = 'DESKTOP_STORAGE_DIVERGED'`，两个存储均保留，供明确核对 |
| 当前需要读取的旧文件出现权限或 I/O 错误 | 拒绝继续。读取有效主文件后的历史备份指纹采集失败时，仍可使用已确认的主文件 |

`openExistingDesktopStorageForWriting(absoluteUserDataPath, options?)` 只允许打开已有、通过校验的桌面 SQLite。原生 SQLite 的 `mode=rw` 会在文件消失时拒绝打开。连接在打开和获取写锁后检查文件标识，并在写事务内核对旧 JSON 分叉。旧会话持有的文件被替换时应重开来源。文件标识用于本机连接期间的替换检查。旧版 JSON 进程不会协调 SQLite 的事务，因此使用同一目录前仍须退出旧版。若需要核对现场，可使用现有只读入口导出 SQLite 的当前 KV，原 JSON 和原有备份仍提供另一份来源。

`withWriteTransaction` 提供在单个同步回调内读写多条 KV 的接口。回调抛错或返回异步结果会回滚，回调返回后该事务对象失效。该接口用于把一份比较记录与其索引一起提交。 `getEntriesByPrefix` 从同一个 SQL 读快照获取匹配前缀的业务 KV，按实际字符串匹配。

用隔离的合成目录验证了 27 项迁移与既有库用例。覆盖新版指纹、历史备份、旧标记兼容、分叉后两个存储保留、已经打开的可写连接拒绝后续分叉，以及同步事务的回滚与只读约束。

## 下一阶段约束

调用约定：`new SQLiteStorageProvider(databasePath, options?)` 是底层可写 KV 接口，可创建新库，不检查桌面迁移状态；`await openDesktopStorage(userDataPath, options?)` 返回 `{ provider, migration }`，会建目录、建 schema、必要时导入旧源。第 3 轮新增的 `openExistingDesktopStorage(absoluteUserDataPath, options?)` 也返回 `{ provider, migration }`，但固定使用原生只读连接，只接受已存在、已迁移且结构兼容的库。连接均通过 `await provider.close()` 关闭；不能把底层构造器当作 existing-only 入口。

第 3 步 MCP 复用同一 SQLite provider、业务数据格式和用户明确选择的桌面 userData，但默认接入不能调用会创建和迁移数据的 `openDesktopStorage` bootstrap。默认只读访问可使用第 3 轮新增的 existing-only 入口，或使用受控桌面桥接；缺库、未迁移或状态异常时明确报错，不静默建库、建 schema、迁移或创建默认业务数据。集成版本将显式可写入口用于比较记录。可写入口检查已完成的迁移和分叉，普通业务仍由产品和各自服务控制。缓存刷新和业务并发按对应服务的边界处理。不得在数据库事务里运行模型请求，也不能把 SQLite 文件放在网络共享目录上。

第 4 步浏览器仍是 Dexie/IndexedDB，需要另行研究经过授权的 Chrome 数据桥接。桌面的 `PromptOptimizerImageDB` 和 `PromptOptimizerFavoriteImageDB` 也仍在 renderer IndexedDB，本次没有迁移图片。第 5 步已提前与第 3 步并行设计，按工具已有的多模型测试、比较、评估能力梳理 MCP；设计并行不表示共享数据接入或业务写入已经验收。第 6 步最后考虑 Skill，不引入项目管理服务。

运行时依据：[Node 24 SQLite 文档](https://nodejs.org/download/release/v24.22.1/docs/api/sqlite.html)、[SQLite WAL](https://sqlite.org/wal.html)、[SQLite 事务](https://sqlite.org/lang_transaction.html)。
