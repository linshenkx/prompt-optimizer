# 竞技场工作区

竞技场通过一份提示词和可选参考图片，同时测试多个文本或图像模型。入口为 `#/arena`，沿用现有工作区组件、模型服务、输出文档和会话存储。

## 使用行为

- 默认两个测试栏，可以持续增加；每栏独立选择连接配置和实际模型，并保留稳定 ID 与对应结果。
- 桌面各栏均分可用宽度，最小栏宽 280px；手机保持双栏同屏。更多测试栏在同一区域横向滚动，溢出时显示 8px 滚动条。
- 输入框下方合并「增加测试栏」、参考图片、展开和「测试全部」。追加后完整显示新栏并聚焦模型选择器。
- 各栏提供「测试」与直接「删除测试栏」按钮，最后一栏和运行中的栏禁止删除。
- 菜单同时支持文本生成与图像生成，使用既有分组样式显示类型名称和图标；已选模型保留类型图标。支持看图的文本模型仍归文本生成。
- 每个请求继承已有模型配置，不提供列参数覆盖、独立输出类型开关或竞技场专用并发上限。「测试全部」立即并行启动请求。
- 停止入口沿用共享结果工具条。支持停止的请求可以立即重试，旧请求的迟到回调不能覆盖新结果；尚未结束的传输仍参与忙碌检查。
- 图片生成和桌面视觉传输遵循底层取消能力，不提供无效停止操作。

## 共享组件

| 区域 | 复用方式 |
|---|---|
| 输入与全屏编辑 | `TestInputSection`；关闭独立标题行，通过 footer 复用原展开回调 |
| 公共操作 | `TestWorkspaceToolbar` 的可选 embedded 模式及 leading/actions 插槽 |
| 模型选择 | `TextModelSelector`、`ModelSelector` 和共享模型目录；可选 additionalGroups 接入图像模型 |
| 类型辨识 | `ModelSelectorGroup.kind` 与默认关闭的 showModelTypes，仅竞技场开启 |
| 结果 | `OutputDisplay`、`OutputDocument`；沿用预览、原文、复制、展开、加载和停止，思考内容默认折叠 |
| 图片 | `AppPreviewImageGroup`、`AppPreviewImage` 与现有图片资产存储；`ArenaImage` 仅负责资产引用解析 |
| 容器和滚动 | `NCard`、`NScrollbar` 与现有主题；窄栏模型操作和结果工具条允许换行 |

未测试时直接使用共享结果空态，图像请求等待时使用共享加载态。真实请求错误仍在所属结果区显示，其他动作失败使用既有消息组件。

共享模型菜单统一移除作用范围说明及废弃的 scope/scopeText 属性，保留配置管理与清除操作。结果区统一移除「配置已变更，显示上次回答；重新测试后可保存」常驻说明及对应翻译和样式；旧结果、保存有效性检查和比较候选筛选继续保留。

## 请求与会话

- `useArenaSession` 管理任务，切换页面后请求继续执行；每次运行捕获当时的输入和模型配置。
- `resolveRuntimeTextModel`、`resolveRuntimeImageModel` 解析请求级模型选择，不修改共享模型配置。桌面 IPC 转发同一份运行选择。
- 完整配置快照仅存在于请求内存中。持久化的生效配置描述排除凭证、授权请求头，以及 URL 中的认证信息、查询参数和片段。
- 会话保存在 `session/v1/arena`，通过现有 Session Manager 接入恢复、备份导入导出和忙碌检查。
- 输入和生成图片保存为资产引用，接入现有图片维护队列及 GC 保护；历史结果继续引用原图片。
- 恢复旧会话时移除 concurrency 和列 parameters 字段，保留输入、列 ID 和历史输出。遗留的排队、运行状态恢复为中断。
- 会话损坏时报告错误，不覆盖原始快照。

## 本地验证

使用仓库声明的 Node 24 和 pnpm。核心验证入口：

```powershell
pnpm -F @prompt-optimizer/core test tests/unit/arena/arena.test.ts tests/unit/data/workspace-session-transfer.test.ts --maxWorkers=1
pnpm -F @prompt-optimizer/ui test tests/unit/stores/session/arena-session.spec.ts tests/unit/components/ArenaWorkspace.spec.ts tests/unit/components/ModelSelector.spec.ts tests/unit/components/TextModelSelector.spec.ts tests/unit/components/SaveTestResultExampleButton.spec.ts --maxWorkers=1
node --test scripts/desktop-ipc-handlers.test.mjs
pnpm -F @prompt-optimizer/ui typecheck
pnpm check:locale
pnpm check:no-chinese-runtime
pnpm -F @prompt-optimizer/ui build:bundle
pnpm -F @prompt-optimizer/web build
```

定向回归覆盖多栏独立选择、12 个请求立即并行启动、停止后立即重试、迟到回调隔离、运行快照、旧会话规范化、图片引用与备份、共享结果加载和错误反馈、同名配置的类型辨识，以及桌面流式选择透传。

需要无需上游模型的浏览器验证时，可使用本地确定性服务：

```powershell
node tests/e2e/fixtures/arena-mock-provider.mjs
```

服务仅绑定 `127.0.0.1`，默认端口 18383，可通过 `ARENA_FIXTURE_PORT` 调整。配置 OpenAI 兼容连接，地址为 `http://127.0.0.1:18383/v1`；`gpt-4o`、`gpt-4o-mini` 返回固定流式输出，`arena-fail` 返回失败，`/records` 可检查调用及同时运行数量。该服务用于文本链路验收，不模拟真实图像生成。

## 验证范围

浏览器已检查桌面六栏／八栏铺满、手机双栏与横向滚动、中文及英文窄屏菜单、深色主题、输入展开同步、复制、结果全屏、参考图片预览和下载、并行运行、失败、停止重试及刷新恢复。移除常驻说明后，修改输入不会清空旧结果，结果区不保留提示占位。

已验证相关定向回归、类型和语言检查，以及 Core、UI、Web/PWA、Extension 和 Desktop 页面构建。桌面运行证据来自 IPC 与服务测试；未完成原生 Electron、手机实机或真实图像提供商的端到端验收。

扩展 ESLint 检查发现基础系统、上下文系统及上下文用户工作区原有的未使用定义，共 10 项；此次仅清理这些页面的共享说明属性，未修改其余业务逻辑。
