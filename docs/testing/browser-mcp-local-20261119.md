# 网页 MCP 本机验收（2026-11-19）

## 范围与环境

工作区 `C:/Users/15588/.codex/worktrees/0b78/prompt-optimizer`，当前分支 `feature/mcp-chrome-bridge`，桌面能力基线 `a6cbff83`。本次仅本地实现和验证，未提交/推送、未发布线上网页、未改用户 Codex MCP 配置、未扫描或复制浏览器资料、未建立数据备份。

- Node `24.22.1`，pnpm `10.6.1`；真实 Playwright Chromium `153.0.8010.12`、Firefox `155.0`。
- 页面是 `packages/web/dist` 的完整产品生产构建，正常初始化 Dexie 及业务服务；不是实验 fixture，也不注入 bridge 替身。
- 客户端通过实际 MCP SDK stdio 启动构建的 `packages/mcp-server/dist/start.js --mode=browser`。临时回环监听器属于该进程。
- 每组使用全新隔离浏览器 context。仅测试前使用浏览器 IndexedDB API 写入两个合成已保存模型配置，不访问 profile 文件。收藏通过真正的 `po_desktop_mutate` 创建。
- 模型采用本地确定性 OpenAI-compatible SSE 端点；由实际产品 LLMService 发出两个不同 temperature 的 HTTP 请求并解析流。完整七组共 **14 次真实本地模型 HTTP 请求**，不使用付费凭据，不代表外部模型提供商验收。

## 浏览器矩阵

各次端口动态分配，以 [acceptance.json](../../experiments/mcp-chrome-bridge/evidence/20261119/acceptance.json) 中精确 origin 为准。

| 浏览器 / 数据上下文 | 来源地址 | 业务链路 |
| --- | --- | --- |
| Chromium 第一个独立资料 | `http://127.0.0.1:<port>` | 通过 |
| Chromium 第二个独立资料 | 与上行完全相同 URL | 通过，contextId 不同且只见自己的收藏 |
| Chromium | `http://po-bridge.localhost:<port>` | 通过 |
| Chromium | `http://192.168.31.2:<port>` | 通过，非安全 HTTP 页面 |
| Firefox 独立资料 | 与 Chromium 相同 loopback URL | 通过，contextId 不同且只见自己的收藏 |
| Firefox | `http://po-bridge.localhost:<port>` | 通过 |
| Firefox | `http://192.168.31.2:<port>` | 通过 |

未添加浏览器禁用安全检查参数，未更改系统 hosts、证书信任或防火墙。自定义域名是本机 `.localhost` 别名，不等同公网 HTTPS 域名部署。

## 每组实际操作

1. 完整产品启动后申请一次性链接；确认显式点击前 `po_sources_list` 没有该来源，链接令牌已从页面地址清除。
2. 真实授权面板填写来源标签、授权 compare。列表核对精确 origin、browserContextId、pageId，显式 open 指定来源。
3. 用共用 favorites query 获取 revision，实际 FavoriteManager 创建收藏，经资产 reader 精确读取 `Summarize {{subject}}.` 版本；模型列表不泄露合成 key。
4. prepare 冻结两个模型配置和变量；execute 由实际页面服务调用本地 HTTP/SSE，get 得到两份 success 输出，temperature 分别 0.2/0.8。
5. 保存并读取比较，再用相同 saveKey 重试确认同一 comparisonId。原收藏页可见新标题；原变量工作区的「已保存比较」按 ID 打开，两份完整输出可见，逐组截图保存。
6. 同 URL 的三个独立数据上下文同时在线时逐一读取，验证 context UUID 不同、无跨来源收藏混入。
7. 原页面撤销后旧 connectionId 失败、来源消失；重新加载页面、用新链接授权 read，同 context UUID 可重读持久比较。拒绝 compare 升级和收藏删除。关页后新连接也失效，其他来源不被误用。

Firefox 的原始 console 可能在刻意关页时记录回环 WebSocket interrupted；该日志保留在证据中，不是模型或保存失败。异常错误不包含授权链接或 API key。所有浏览器和临时服务在 finally 中关闭。

证据目录中的 `chromium-loopback-failed.png` 是最初“已打开页面内导航到授权链接”未被捕获的失败现场；已通过 hashchange 捕获修复，并加入冷启动/同页导航回归。它不计入最终通过截图。最终七组结果以 `acceptance.json`（2026-11-19 11:23:57，上海时间）及同名非 failed 截图为准，包含重载持久化、只读拒写和幂等保存检查。

## 开发回归入口

```powershell
pnpm -F @prompt-optimizer/core test:browser-bridge
pnpm -F @prompt-optimizer/mcp-server test:browser
pnpm -F @prompt-optimizer/ui exec vitest run tests/unit/browser-bridge-authorization.spec.ts
pnpm -F @prompt-optimizer/mcp-server test:desktop-readonly
pnpm -F @prompt-optimizer/mcp-server test:desktop-stdio
pnpm -F @prompt-optimizer/ui typecheck
pnpm -F @prompt-optimizer/mcp-server type-check
```

Core 测试使用真实 Dexie + fake-indexeddb 和真实 FavoriteManager 验证事务回滚、旧 revision、准确幂等、只读边界、context 改变与无初始化读取；这是补充单元证据，不替代上述真实页面。Node WebSocket 单元测试覆盖精确路由、撤销、权限升级/并发 open、一次性票据、写入结果不确定及 owner 退出，不冒充浏览器权限测试。

本次开发回归结果：Core reader/runner/bridge **32 项**、bridge transport **7 项**、网页授权解析 **3 项**、既有桌面只读 **14 项**、构建后桌面/legacy stdio **5 项**、仓库脚本 **99 项**通过，共 160 项。Core/UI/MCP 类型检查、MCP lint、新增网页连接代码 lint、locale parity、无中文运行时字面量和 `git diff --check` 均通过；core、UI、web、MCP 构建通过。UI 测试保留既有 Vite native config loader 关于 `__dirname` 的非阻断提示，未为此修改无关配置。

## 限制与交接

- 还未验收公网 HTTPS → 回环、部署 CSP/企业策略、浏览器本地网络权限拒绝、安装版 PWA、扩展页、移动浏览器和真实收费模型。普通 HTTP LAN IP 已实测，但不因此承诺所有部署和浏览器版本可用。
- 发现范围只有已打开、服务就绪并授权的网页，不尝试列举尚未打开的系统浏览器资料。普通 close/revoke 通过事件立即失效；崩溃/断网/冻结按心跳和调用前探活失效，不自动重连。
- API key 留在页面存储和既有 LLMService；授权页本身仍是受信任执行端。本机恶意进程或产品 XSS 不属于回环授权能防御的边界。
- browser 当前只接受 stdio，桌面比较仍使用自己的显式模式。favorites 是完整桌面业务合同的子集；不要把浏览器 catalog 宣称为已实现全部桌面业务。
- 数据仍属于原 origin/浏览器资料；MCP 不维护镜像库。业务 close 不清空持久数据；修改来源或重启授权不保证内存 prepared/run 对象保留，持久结果应按 comparisonId 核对。
