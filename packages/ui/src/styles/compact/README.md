# 移动呈现样式归属

`../compact-workspace.css` 是有序入口。业务组件的默认桌面样式仍在各自 SFC 中；这里的规则只在移动根类、明确的 compact 呈现类或 `fitContent` 流式阅读类下生效。

| 模块 | 维护者 / 适用范围 |
| --- | --- |
| `foundation.css` | `MainLayout`、`useWorkspaceLayout` 的主题 token、可用视口及公共控件表面 |
| `overlay.css` | `AdaptiveModal` 与公共 dialog/page/picker/sheet 容器，不承接业务表单布局 |
| `workspace.css` | `OptimizeWorkspaceLayout` 和七工作区 shell 的 pane、源稿/结果卡片及公共阅读间距 |
| `navigation.css` | `CompactNavigation`、`WorkspaceRegionSwitch` 的导航和两区选择 |
| `input.css` | `InputPanel` 和共享编辑器的字段、标题、提交区与文本排版 |
| `prompt.css` | `PromptPanel` 的标题、版本、继续优化和差异比较；工作区折叠摘要 |
| `output.css` | `OutputDisplayCore` 的工具栏、正文和流式高度 |
| `context.css` | `ConversationManager`、临时变量及多消息优化配置 |
| `image.css` | 图片模式的配置、参考图与生成结果 |
| `test-result.css` | `TestWorkspaceLayout` 与测试 slot 的配置、并排卡片和窄列阅读变体 |
| `management.css` | 收藏页面壳、既有模型选择器与模板弹层的兼容规则；旧变量行规则已删除，新业务列表/详情/表单的 compact 样式由所属 SFC 维护 |

## 修改约束

- 同一选择器的基础规则只有一处，宽/高响应变体集中在所属模块尾部；跨组件比较列变体由 `test-result.css` 统一管理。不要通过在入口末尾追加覆盖来修页面。
- 通过组件自有类表达角色，不根据 `nth-child`、行内字号或 Naive UI 多层 flex/space 树推断角色。
- `NSpace` 隐式 item 使用公开的 `item-class`，必要时通过 `:has(> .语义类)` 识别其直接子内容。更换 `NSpace` 时只需更新所属组件与这个模块的契约。
- Naive UI 的 card header/content/footer、selection/input token、按钮 loading/icon 和图像预览 toolbar 仍是明确保留的框架适配边界。它们不承担业务数据判断；升级 Naive UI 时应回归。
- 不以通用 `.n-text`、`.n-button` 或 DOM 顺序隐藏业务操作。隐藏标签、紧凑次要操作、会话标题等必须使用对应的组件角色类。
- 业务列表、详情和表单的移动设计复用原有校验、服务、controller 和单份草稿；不在此目录编排业务状态或复制表单。组件自有 compact 样式留在 SFC，公共文件只承接明确的跨组件契约。
- Teleport 弹层需要业务根类时，显式传入 `AdaptiveModal.compactClass`。该类仅在 compact 生效，不依赖普通 `class` 透传或父 SFC 的作用域属性到达弹层根节点。
- 键盘遮挡的选择菜单位置和高度由 `useSelectMenuViewport` / `useCompactSelectMenu` 按可见视口计算，桌面不附加约束；不要通过全局 `.n-select` 高度、固定像素或关闭搜索补偿键盘问题。

具体状态和失败路径边界见 [业务组件设计](../../../../../docs/architecture/mobile-business-components-design.md) 与 [验收记录](../../../../../docs/architecture/mobile-business-components-acceptance.md)。
