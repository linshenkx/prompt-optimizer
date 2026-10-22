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
| `management.css` | 现有收藏、变量和管理弹窗的兼容样式；不代表业务页移动设计已完成 |

## 修改约束

- 同一选择器的基础规则只有一处，宽/高响应变体集中在所属模块尾部；跨组件比较列变体由 `test-result.css` 统一管理。不要通过在入口末尾追加覆盖来修页面。
- 通过组件自有类表达角色，不根据 `nth-child`、行内字号或 Naive UI 多层 flex/space 树推断角色。
- `NSpace` 隐式 item 使用公开的 `item-class`，必要时通过 `:has(> .语义类)` 识别其直接子内容。更换 `NSpace` 时只需更新所属组件与这个模块的契约。
- Naive UI 的 card header/content/footer、selection/input token、按钮 loading/icon 和图像预览 toolbar 仍是明确保留的框架适配边界。它们不承担业务数据判断；升级 Naive UI 时应回归。
- 不以通用 `.n-text`、`.n-button` 或 DOM 顺序隐藏业务操作。隐藏标签、紧凑次要操作、会话标题等必须使用对应的组件角色类。
- 此阶段只整理归属及已生效规则。业务列表、详情和表单的移动端重设计另行实施，继续复用校验、服务及会话。
