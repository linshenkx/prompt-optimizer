# Prompt Garden -> Prompt Optimizer 导入契约（External Import Contract）

本文档定义 Prompt Garden 与 Prompt Optimizer 之间的“外部导入”契约。

设计目标：

- URL 只携带最少信息（`importCode` + 可选 `subModeKey`）
- Prompt Optimizer 固定从 `VITE_PROMPT_GARDEN_BASE_URL` 拉取内容
- Garden API 返回格式在所有子模式下保持一致（这是插件契约的核心）
- 仅支持 **v1 schema** 返回（不需要兼容旧版 `{ content, title }` 回退协议）

## 1. Prompt Optimizer 侧：导入触发与参数

Prompt Optimizer 在启动后检查当前路由 query：

- 如果存在 `importCode`，则触发一次导入
- 导入成功后会清理 query（避免刷新重复导入）

### 1.1 URL 参数（最小集合）

- `importCode`（必填）
  - 外部提示词的唯一标识（例如 `NB-001`）
- `subModeKey`（可选）
  - 明确指定导入目标工作区（不再兼容 `mode`）

可选 `subModeKey` 取值：

- `basic-system`
- `basic-user`
- `pro-multi`
- `pro-variable`
- `image-text2image`
- `image-image2image`

说明：

- `subModeKey` 仅用于覆盖导入目标工作区。
- 推荐优先使用“打开对应工作区路由”的方式触发导入（见 1.2），避免依赖 query。

### 1.2 URL 示例（推荐 Garden 直接打开非根路由）

- 导入到 basic-system（最简）：
  - `https://prompt.example.com/#/basic/system?importCode=NB-001`

- 导入到 image-text2image（最简）：
  - `https://prompt.example.com/#/image/text2image?importCode=NB-001`

- 若希望由 query 指定目标工作区（可选）：
  - `https://prompt.example.com/#/basic/system?importCode=NB-001&subModeKey=basic-system`

## 2. Prompt Garden 侧：必须提供的 API

Prompt Optimizer 会调用：

`GET {gardenBaseUrl}/api/prompt-source/{encodeURIComponent(importCode)}`

其中：

- `gardenBaseUrl` 固定来自 Prompt Optimizer 的环境变量 `VITE_PROMPT_GARDEN_BASE_URL`
- `{encodeURIComponent(importCode)}` 用于安全拼接

## 3. API 返回格式（契约重点：跨子模式一致）

无论导入到哪个 `subModeKey`，API 的返回格式必须一致。

### 3.1 成功响应（HTTP 200）

推荐 `Content-Type: application/json`，返回 **v1 schema** JSON：

```json
{
  "schema": "prompt-garden.prompt.v1",
  "schemaVersion": 1,
  "optimizerTarget": {
    "subModeKey": "basic-system"
  },
  "prompt": {
    "format": "text",
    "text": "..."
  },
  "variables": [
    {
      "name": "var_name",
      "defaultValue": "optional"
    }
  ]
}
```

字段约束（v1）：

- `schema`：必填，固定为 `prompt-garden.prompt.v1`
- `schemaVersion`：必填，固定为 `1`
- `optimizerTarget`：必填
  - `optimizerTarget.subModeKey`：必填，导入目标工作区，取值见 1.1
- `prompt`：必填
  - `prompt.format`：必填，可选值：`text` / `messages`
  - `prompt.text`：当 `format=text` 时必填，且必须为非空字符串
  - `prompt.messages`：当 `format=messages` 时必填，为消息数组（见 3.2）
- `variables`：必填（允许为空数组 `[]`），用于向目标工作区注入临时变量（见 3.3）

子模式差异说明：

- `optimizerTarget.subModeKey` 只影响 **写入哪个 session store**
- API 返回不需要区分子模式（返回结构固定）
- 图像模式下：导入只写入提示词与变量；不导入 input image（image2image 的 input image 需要用户在 Optimizer 中自行选择/上传）

### 3.2 prompt.messages 定义（format=messages）

`prompt.messages` 为数组，每项为：

```json
{
  "id": "optional-but-recommended",
  "role": "system",
  "content": "...",
  "originalContent": "optional"
}
```

字段约束：

- `role`：必填，可选值：`system` / `user` / `assistant` / `tool`
- `content`：必填，非空字符串
- `id`：建议提供（字符串），用于让 Prompt Optimizer 在导入后可以稳定选中消息
- `originalContent`：可选；若不提供，可与 `content` 相同

### 3.3 variables 定义

`variables` 为数组，每项为：

```json
{
  "name": "variable_name",
  "defaultValue": "optional"
}
```

字段约束：

- `name`：必填，必须符合 Prompt Optimizer 的变量命名规则（建议：`[a-zA-Z_][a-zA-Z0-9_]*`）
- `defaultValue`：可选，字符串

说明：

- Prompt Optimizer 导入时会把 `variables` 写入对应子模式的“临时变量”（temporaryVariables）存储。
- 如果导入前该变量已经存在，导入不会覆盖既有值（避免破坏用户当前变量设置）。

### 3.4 占位符语法（强制）

Prompt Optimizer 仅支持 Mustache 变量占位符：

- ✅ `{{variable_name}}`
- ✅ `{{ variable_name }}`（允许花括号内两侧空格）
- ❌ `{variable_name}`（不支持；不会被自动转换）

约束：

- `prompt.text` / `prompt.messages[].content` 中出现的变量占位符必须使用 `{{...}}`。
- Prompt Garden 不应返回 `{var}` 风格的占位符；Prompt Optimizer 不做兼容与归一化。

### 3.5 失败响应

建议语义：

- `404`：`importCode` 不存在
- `400`：`importCode` 非法
- `500`：服务端错误

对 Prompt Optimizer 而言：

- 任意非 2xx 都会视为导入失败，并提示用户

## 4. CORS / 安全建议

由于 Prompt Optimizer（Web）是纯前端应用，跨域 fetch 需要 Prompt Garden 正确配置 CORS。

建议：

- `/api/prompt-source/*` 返回：
  - `Access-Control-Allow-Origin: https://prompt.example.com`（或你的实际部署域名）
  - 开发环境可临时使用 `*` 以便联调

## 5. 环境变量

Prompt Optimizer 侧：

- `VITE_ENABLE_PROMPT_GARDEN_IMPORT=1`（或 `true`）
  - 默认禁用；启用后才会注册导入逻辑
- `VITE_PROMPT_GARDEN_BASE_URL=http://localhost:3000`
  - Prompt Garden 的固定 base URL（不接受 URL 参数覆盖）

## 6. 可选集成（Integrations）机制

Prompt Optimizer 使用“可选集成”机制来实现低入侵扩展：

- 集成模块位于：`packages/ui/src/integrations/`
- 文件命名为：`*.integration.ts`
- 每个模块导出：`integration` 对象，并通过 `envFlag` 控制是否启用
- App 只调用一次：`registerOptionalIntegrations(...)`

Prompt Garden 是其中一个可选集成，文件为：

- `packages/ui/src/integrations/prompt-garden.integration.ts`

## 7. 参考实现

Prompt Optimizer 侧导入逻辑：

- `packages/ui/src/composables/app/useAppPromptGardenImport.ts`
