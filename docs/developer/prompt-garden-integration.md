# Prompt Garden -> GlobalCloud XiaoC 导入契约（External Import Contract）

本文档描述当前代码中已经落地的 Prompt Garden 外部导入行为，目标是让 Garden 侧和 GlobalCloud XiaoC 侧按同一套实际契约对接。

设计目标：

- URL 只携带少量路由参数，由 GlobalCloud XiaoC 自己去 Garden 拉完整内容
- GlobalCloud XiaoC 固定从 `VITE_PROMPT_GARDEN_BASE_URL` 拉取内容，不接受 URL 参数覆盖
- Garden API 返回统一的 v1 schema；普通导入会由 GlobalCloud XiaoC 按子模式写入不同 session store
- Garden 的扩展元数据和素材快照可以跟随收藏一起保存，便于后续预览和复用

## 1. GlobalCloud XiaoC 侧：导入触发与 URL 参数

GlobalCloud XiaoC 在应用初始 session 恢复完成后检查当前路由 query。

- 如果存在 `importCode`，则触发一次导入
- 导入成功后会清理导入相关 query，避免刷新重复导入
- 导入失败时不会清理 query，因此刷新后会再次尝试

### 1.1 支持的 URL 参数

- `importCode`（必填）
  - 外部提示词的唯一标识，例如 `NB-001`
  - 可在导入码后追加示例选择后缀，例如 `NB-001@ex-2`
  - 追加后缀时，GlobalCloud XiaoC 仍请求 `GET /api/public/prompt-source/NB-001`，并把 `ex-2` 当作本次导入的示例选择；旧路径 `/api/prompt-source/NB-001` 由 Garden 侧做 `307` 兼容跳转
- `subModeKey`（可选）
  - 显式指定导入目标工作区
  - 若未提供，则优先使用 Garden 返回的 `optimizerTarget.subModeKey`
  - 若 Garden 返回值无效，则退回当前路由；当前路由也无效时默认落到 `basic-system`
- `exampleId`（可选）
  - 指定使用哪一个示例
  - 若 `importCode` 同时带 `@exampleId` 后缀，显式 URL 参数 `exampleId` 优先
  - 若未提供，则默认使用 `assets.examples[0]`
  - 仅用于示例参数和 image2image 输入图回填，不改变 prompt 主体
- `saveToFavorites`（可选）
  - 控制本次导入是否进入收藏流程
  - `1` / `true` / `auto` -> 自动保存到收藏
  - `confirm` / `dialog` / `manual` -> 打开“保存收藏”对话框，并带预填数据
  - 只要启用 `saveToFavorites`，本次导入只处理收藏，不写入或覆盖当前工作区
  - 其它值或省略 -> 作为“使用”导入，写入目标工作区，不触发收藏保存

### 1.2 `subModeKey` 支持值

- `basic-system`
- `basic-user`
- `pro-multi`
- `pro-variable`
- `image-text2image`
- `image-image2image`

### 1.3 URL 示例

- 导入到 `basic-system`：
  - `https://prompt.example.com/#/basic/system?importCode=NB-001`

- 导入到 `pro-multi`，并显式指定示例：
  - `https://prompt.example.com/#/pro/multi?importCode=NB-001&exampleId=ex-2`

- 导入到 `pro-multi`，并通过导入码后缀指定示例：
  - `https://prompt.example.com/#/pro/multi?importCode=NB-001@ex-2`

- 从 `image-image2image` 类型的 Garden 提示词导入为收藏，并弹出保存收藏对话框：
  - `https://prompt.example.com/#/image/image2image?importCode=NB-001&saveToFavorites=confirm`

- 若希望 query 明确覆盖目标工作区：
  - `https://prompt.example.com/#/basic/system?importCode=NB-001&subModeKey=basic-system`

说明：

- 推荐 Garden 直接打开目标工作区路由，而不是总是打开根路由再依赖 `subModeKey`
- 不带 `saveToFavorites` 时，`subModeKey` 用于决定写入哪个工作区
- 带 `saveToFavorites` 时，`subModeKey` 只用于收藏的模式预填充，不会触发工作区写入

## 2. Prompt Garden 侧：必须提供的 API

GlobalCloud XiaoC 会调用：

`GET {gardenBaseUrl}/api/public/prompt-source/{encodeURIComponent(importCode)}`

其中：

- `gardenBaseUrl` 固定来自 GlobalCloud XiaoC 的环境变量 `VITE_PROMPT_GARDEN_BASE_URL`
- 请求头固定包含 `Accept: application/json`
- 当前实现使用浏览器端 `fetch`
- 当前实现不会附加自定义认证头，也不会为跨站请求显式开启 `credentials`

如果 Garden API 需要登录态、Cookie 或额外鉴权，当前 Web/Extension 导入链路通常需要额外的同源部署或服务端代理支持。

## 3. API 返回格式（v1 schema）

当前实现只接受 v1 schema：

- `schema` 必须为 `prompt-garden.prompt.v1`
- `schemaVersion` 必须为 `1`

不兼容旧版 `{ content, title }` 回退协议。

### 3.1 成功响应示例

```json
{
  "schema": "prompt-garden.prompt.v1",
  "schemaVersion": 1,
  "importCode": "NB-001",
  "optimizerTarget": {
    "subModeKey": "pro-variable"
  },
  "prompt": {
    "format": "text",
    "text": "Write a launch post for {{product_name}} aimed at {{audience}}."
  },
  "variables": [
    {
      "name": "product_name",
      "defaultValue": "GlobalCloud XiaoC",
      "description": "产品名称",
      "type": "string",
      "required": true
    },
    {
      "name": "audience",
      "defaultValue": "indie hackers",
      "type": "enum",
      "options": ["indie hackers", "founders", "designers"]
    }
  ],
  "assets": {
    "cover": {
      "url": "/prompt-assets/nb-001/cover.png"
    },
    "showcases": [
      {
        "id": "showcase-1",
        "images": ["/prompt-assets/nb-001/showcase-1.png"],
        "description": "封面图"
      }
    ],
    "examples": [
      {
        "id": "ex-1",
        "parameters": {
          "product_name": "GlobalCloud XiaoC",
          "audience": "founders"
        }
      }
    ]
  },
  "meta": {
    "title": "Launch Post Writer",
    "description": "用于生成发布帖的变量化提示词",
    "tags": ["marketing", "launch"],
    "categoryKey": "marketing"
  }
}
```

### 3.2 顶层字段约束

- `schema`：必填，固定为 `prompt-garden.prompt.v1`
- `schemaVersion`：必填，固定为 `1`
- `optimizerTarget`：必填
  - `optimizerTarget.subModeKey`：必填，且应始终返回合法值（见 1.2）
- `prompt`：必填
- `variables`：必填，允许为空数组 `[]`
- `importCode`：可选但推荐返回
  - 若返回空值，GlobalCloud XiaoC 会回退到 URL 中的 `importCode`
- `assets`：可选
  - 用于收藏快照、示例参数和素材预览
- `meta`：可选
  - 用于收藏标题、描述、标签、分类等预填充

## 4. `prompt` 字段与子模式支持矩阵

### 4.1 `prompt` 定义

`prompt` 为对象：

```json
{
  "format": "text",
  "text": "..."
}
```

或：

```json
{
  "format": "messages",
  "messages": [
    {
      "id": "msg-1",
      "role": "system",
      "content": "..."
    }
  ]
}
```

字段约束：

- `prompt.format`：必填，可选值为 `text` / `messages`
- 当 `format=text` 时，`prompt.text` 必须是非空字符串
- 当 `format=messages` 时，`prompt.messages` 必须是非空数组

### 4.2 实际支持矩阵

虽然 schema 允许 `text` 和 `messages` 两种格式，但当前代码不是所有子模式都同等支持：

- `pro-multi`
  - 支持 `messages`
  - 也支持 `text`，会被包装成一条 `system` 消息
- `basic-system`
  - 仅应返回 `text`
- `basic-user`
  - 仅应返回 `text`
- `pro-variable`
  - 仅应返回 `text`
- `image-text2image`
  - 仅应返回 `text`
- `image-image2image`
  - 仅应返回 `text`

强烈建议：

- 只有在目标为 `pro-multi` 时才返回 `format=messages`
- 其它子模式统一返回 `format=text`

如果向非 `pro-multi` 子模式返回 `messages`，当前实现会在写入工作区时报错。

### 4.3 `prompt.messages` 项定义

`prompt.messages` 每项为：

```json
{
  "id": "optional-but-recommended",
  "role": "system",
  "content": "...",
  "originalContent": "optional"
}
```

字段约束：

- `role`：必填，可选值为 `system` / `user` / `assistant` / `tool`
- `content`：必填，非空字符串
- `id`：建议提供，便于导入后稳定选中消息
- `originalContent`：可选；若未提供，会回退为 `content`

## 5. `variables` 字段

`variables` 为数组，每项为：

```json
{
  "name": "variable_name",
  "defaultValue": "optional",
  "description": "optional",
  "type": "string",
  "required": true,
  "options": ["a", "b"],
  "source": "optional"
}
```

字段约束：

- `name`：必填，必须符合 GlobalCloud XiaoC 的变量命名规则
  - 推荐：`[a-zA-Z_][a-zA-Z0-9_]*`
- `defaultValue`：可选，字符串
- `description`：可选，字符串
- `type`：可选，支持 `string` / `number` / `boolean` / `enum`
- `required`：可选，布尔值
- `options`：可选，字符串数组
- `source`：可选，字符串

当前实现行为：

- `variables` 在 API 中是必填字段，即使没有变量也要返回 `[]`
- 非法变量名会被直接忽略
- 变量会写入对应子模式的 temporary variables
- 仅以下子模式支持 temporary variables：
  - `pro-multi`
  - `pro-variable`
  - `image-text2image`
  - `image-image2image`
- `basic-system` 和 `basic-user` 不会接收 temporary variables

### 5.1 导入时的变量覆盖规则

当前实现会先把 temporary variables 重置为 Garden 返回的变量列表，但对“同名变量”的值使用保留策略：

- 如果用户当前已经有同名 temporary variable，则保留现有值
- 如果当前没有同名值，则使用 `defaultValue`
- 如果 Garden 返回的是空数组 `[]`，则会清空该子模式当前的 temporary variables

## 6. `assets` 与 `meta` 扩展字段

`assets` 和 `meta` 不是工作区 prompt 写入的必需字段，但当前实现已经支持它们，并会在“保存到收藏”场景中使用。

### 6.1 `assets` 结构

```json
{
  "assets": {
    "cover": {
      "url": "/prompt-assets/nb-001/cover.png"
    },
    "showcases": [
      {
        "id": "showcase-1",
        "url": "/prompt-assets/nb-001/showcase-1.png",
        "images": ["/prompt-assets/nb-001/showcase-1.png"],
        "description": "optional"
      }
    ],
    "examples": [
      {
        "id": "ex-1",
        "parameters": {
          "var_name": "value"
        },
        "inputImages": ["/prompt-assets/nb-001/input-1.png"],
        "description": "optional"
      }
    ]
  }
}
```

当前实现支持的含义：

- `assets.cover`
  - 收藏预览中的封面图
- `assets.showcases`
  - 收藏预览中的展示图
- `assets.examples`
  - 可用于示例参数回填
  - 对 `image-image2image`，还可用于示例输入图回填

素材 URL 可以是绝对地址，也可以是相对地址。

- 相对地址会基于 `gardenBaseUrl` 归一化为绝对 URL
- 当前实现会尝试把素材持久化为本地 asset id，用于收藏预览和离线引用

### 6.2 `meta` 结构

`meta` 中当前有实际用途的字段包括：

- `title`
  - 收藏标题预填充
- `description`
  - 收藏描述预填充
- `tags`
  - 收藏标签预填充
- `categoryPath`
  - 收藏分类树导入的首选字段
  - GlobalCloud XiaoC 会按路径逐级复用或创建分类节点，并将收藏挂到最后一个叶子节点
- `categoryPathKey`
  - `categoryPath` 的兼容回退
  - 用法与 `categoryPath` 一致
- `categoryKey`
  - 旧版单分类兼容字段
  - 当 `categoryPath/categoryPathKey` 都缺失时，退化为单节点分类
- `category`
  - 旧版单分类兼容字段，作为 `categoryKey` 的回退

GlobalCloud XiaoC 当前的分类提取优先级为：

1. `meta.categoryPath`
2. `meta.categoryPathKey`
3. 旧字段组合 `[meta.category, meta.subcategory]`
4. `meta.categoryKey`

如果 `meta.title` 缺失，GlobalCloud XiaoC 会退回到 prompt 内容首行生成收藏标题。

## 7. 示例选择与 image2image 输入图

### 7.1 `exampleId` 行为

导入时，GlobalCloud XiaoC 会从 `assets.examples` 中选择一个示例：

- 若 URL 提供了 `exampleId`，优先按 `id` 精确匹配
- 若未提供或未匹配到，则回退到第一个示例

### 7.2 示例参数回填

当选中的示例包含 `parameters` 时：

- 只会给“已在 `variables` 中声明过”的变量赋值
- 示例参数会覆盖该次导入中对应变量的默认值
- 不会凭空创建未声明变量

### 7.3 `image-image2image` 的输入图行为

当前实现和旧文档不同：

- 如果目标子模式是 `image-image2image`
- 且选中的示例包含 `inputImages`
- GlobalCloud XiaoC 会尝试读取第一个 `inputImages[0]`，并加载为当前工作区的输入图

如果图片读取失败：

- 整体导入仍然成功
- 用户会看到一个 warning toast
- 常见原因是 Garden 静态素材的 CORS 配置不正确

因此，若要支持 image2image 的“可复现实例导入”，Garden 不仅要开放 `/api/public/prompt-source/*`，也要开放示例图片地址。旧路径 `/api/prompt-source/*` 只需要保留 `307` 兼容跳转即可。

## 8. 收藏联动（`saveToFavorites`）

### 8.1 自动保存

当 `saveToFavorites=1|true|auto` 时：

- GlobalCloud XiaoC 会尝试自动保存到收藏
- 收藏内容来自 Garden 返回的 prompt
- `meta` 和 `assets` 会作为 `gardenSnapshot` 一起写入收藏 metadata
- 如果 `meta.categoryPath/categoryPathKey` 存在，会自动创建或复用分类树，并保存到叶子分类
- 不会写入或覆盖当前工作区

### 8.2 确认保存

当 `saveToFavorites=confirm|dialog|manual` 时：

- GlobalCloud XiaoC 会打开“保存收藏”对话框
- 自动带入标题、描述、标签、分类、模式信息和 `gardenSnapshot`
- 若分类树节点尚不存在，不会在弹窗打开时提前创建；只有用户真正点击保存时才会补建缺失节点
- 不会写入或覆盖当前工作区

### 8.3 去重与更新规则

Garden 联动保存收藏时，不按收藏内容去重，而按下面的组合键做 upsert：

- `gardenSnapshot.importCode`
- `gardenSnapshot.gardenBaseUrl`

这意味着：

- 同一个 Garden 提示词重复导入会更新原收藏
- 不同 Garden 站点即使 `importCode` 相同，也会被视为不同来源

## 9. 工作区写入时会被重置的状态

当 URL 不带 `saveToFavorites` 时，导入成功后 GlobalCloud XiaoC 不只是更新 prompt，还会清理与旧工作区状态绑定的内容。

例如：

- `basic-system` / `basic-user`
  - 清空测试内容、测试变体状态、优化结果、评估结果、当前版本列表
- `pro-multi`
  - 清空 message chain map、测试变体状态、优化结果、评估结果
- `pro-variable`
  - 清空测试内容、测试变体状态、优化结果、评估结果
- `image-text2image`
  - 清空原始图结果和优化图结果
- `image-image2image`
  - 清空当前输入图、原始图结果和优化图结果
  - 若示例带输入图，会在清空后再尝试加载示例输入图

## 10. 占位符语法（强制）

GlobalCloud XiaoC 仅支持 Mustache 风格变量占位符：

- `{{variable_name}}`
- `{{ variable_name }}`

不支持：

- `{variable_name}`

约束：

- `prompt.text` 和 `prompt.messages[].content` 中出现的变量占位符都必须使用 `{{...}}`
- Prompt Garden 不应返回 `{var}` 风格占位符
- GlobalCloud XiaoC 不会在导入时做占位符归一化

## 11. 失败语义

### 11.1 HTTP 失败

建议 Garden 使用以下语义：

- `400`：`importCode` 非法
- `404`：`importCode` 不存在
- `500`：服务端错误

对 GlobalCloud XiaoC 而言：

- 任意非 2xx 都会视为导入失败
- 用户侧只会看到通用失败提示
- 详细原因主要记录在浏览器 console

### 11.2 schema 校验失败

以下情况会直接失败：

- 缺少 `VITE_PROMPT_GARDEN_BASE_URL`
- `schema` 不是 `prompt-garden.prompt.v1`
- `schemaVersion` 不是 `1`
- 缺少 `optimizerTarget.subModeKey`
- 缺少 `prompt.format`
- `format=text` 但 `prompt.text` 为空
- `format=messages` 但 `prompt.messages` 为空
- 缺少 `variables`

## 12. CORS / 静态素材建议

由于 GlobalCloud XiaoC（Web/Extension）是纯前端应用，Garden 侧必须正确配置跨域。

至少需要覆盖两类资源：

- `/api/public/prompt-source/*`
- `assets.cover.url`、`assets.showcases[*].url/images[*]`、`assets.examples[*].images[*]`、`assets.examples[*].inputImages[*]` 指向的静态资源地址

建议：

- `/api/public/prompt-source/*` 返回：
  - `Access-Control-Allow-Origin: https://prompt.example.com`，或你的实际部署域名
- 静态素材地址也返回相同的 `Access-Control-Allow-Origin`
- 开发环境可临时使用 `*` 联调

如果 image2image 示例输入图需要可用，`inputImages` 的 URL 也必须允许被浏览器跨域 `fetch`。

## 13. 环境变量

GlobalCloud XiaoC 侧：

- `VITE_ENABLE_PROMPT_GARDEN_IMPORT=1` 或 `true`
  - 产品内建默认值为 `1`
  - 启用后会注册 Prompt Garden 导入逻辑
  - 同时也会启用 Garden 收藏快照预览插件
- `VITE_PROMPT_GARDEN_BASE_URL=https://garden.always200.com`
  - Prompt Garden 的固定 base URL
  - 不接受 URL 参数覆盖

说明：

- Web、浏览器扩展和桌面端打包时都会带上上述默认值
- 运行时配置仍可覆盖默认值
  - Docker / Web `window.runtime_config` 推荐使用无前缀键：`ENABLE_PROMPT_GARDEN_IMPORT`、`PROMPT_GARDEN_BASE_URL`
  - 也兼容带前缀键：`VITE_ENABLE_PROMPT_GARDEN_IMPORT`、`VITE_PROMPT_GARDEN_BASE_URL`

## 14. 可选集成（Integrations）机制

GlobalCloud XiaoC 使用“可选集成”机制来实现低入侵扩展：

- 集成模块位于 `packages/ui/src/integrations/`
- 文件命名为 `*.integration.ts`
- 每个模块导出 `integration` 对象，并通过 `envFlag` 控制是否启用
- App 启动后统一调用 `registerOptionalIntegrations(...)`

Prompt Garden 相关文件：

- `packages/ui/src/integrations/prompt-garden.integration.ts`
- `packages/ui/src/integrations/prompt-garden.favorite-preview.ts`

## 15. 参考实现

GlobalCloud XiaoC 侧核心实现：

- `packages/ui/src/composables/app/useAppPromptGardenImport.ts`
- `packages/ui/src/components/PromptGardenFavoritePreviewPanel.vue`
- `packages/ui/src/utils/garden-snapshot-preview.ts`

主要测试：

- `packages/ui/tests/unit/composables/useAppPromptGardenImport.spec.ts`
- `packages/ui/tests/unit/components/GardenSnapshotPreview.spec.ts`
- `packages/ui/tests/unit/utils/garden-snapshot-preview.spec.ts`
