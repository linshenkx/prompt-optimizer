# API Key 快速跳转功能实现

## 功能说明

在模型管理页面的 API Key 配置字段旁边添加了一个链接图标，点击后可以直接跳转到对应服务商的 API Key 获取页面。

## 实现内容

### 1. 核心类型扩展

#### BaseProvider 类型 (`packages/core/src/services/shared/types.ts`)
- 添加了可选的 `apiKeyUrl?: string` 字段

#### TextProvider 类型 (`packages/core/src/services/llm/types.ts`)
- 添加了可选的 `apiKeyUrl?: string` 字段

### 2. 文本模型 Adapter 更新

为以下文本模型 adapter 添加了 `apiKeyUrl`：

- **OpenAI** (`openai-adapter.ts`)
  - URL: `https://platform.openai.com/api-keys`
  
- **DeepSeek** (`deepseek-adapter.ts`)
  - URL: `https://platform.deepseek.com/api_keys`
  
- **Google Gemini** (`gemini-adapter.ts`)
  - URL: `https://aistudio.google.com/apikey`
  
- **Anthropic (Claude)** (`anthropic-adapter.ts`)
  - URL: `https://console.anthropic.com/settings/keys`
  
- **智谱AI** (`zhipu-adapter.ts`)
  - URL: `https://open.bigmodel.cn/usercenter/apikeys`
  
- **SiliconFlow** (`siliconflow-adapter.ts`)
  - URL: `https://cloud.siliconflow.cn/account/ak`
  
- **阿里百炼 (DashScope)** (`dashscope-adapter.ts`)
  - URL: `https://bailian.console.aliyun.com/?apiKey=1#/api-key`
  
- **OpenRouter** (`openrouter-adapter.ts`)
  - URL: `https://openrouter.ai/settings/keys`
  
- **ModelScope** (`modelscope-adapter.ts`)
  - URL: `https://modelscope.cn/my/myaccesstoken`

### 3. 图像模型 Adapter 更新

为以下图像模型 adapter 添加了 `apiKeyUrl`：

- **OpenAI Image** (`openai.ts`)
  - URL: `https://platform.openai.com/api-keys`
  
- **Google Gemini Image** (`gemini.ts`)
  - URL: `https://aistudio.google.com/apikey`
  
- **阿里百炼图像 (DashScope)** (`dashscope.ts`)
  - URL: `https://bailian.console.aliyun.com/?apiKey=1#/api-key`

### 4. UI 组件更新

#### TextModelEditModal.vue
- 在 API Key 字段的 label 中添加了链接按钮
- 添加了 `currentProviderApiKeyUrl` 计算属性来获取当前 provider 的 apiKeyUrl
- 链接图标使用外部跳转 SVG 图标
- 链接在新标签页打开（`target="_blank"`，`rel="noopener noreferrer"`）

#### ImageModelEditModal.vue
- 同样在 API Key 字段添加了链接按钮
- 添加了 `currentProviderApiKeyUrl` 计算属性
- 使用相同的外部跳转图标样式

### 5. 国际化文本

添加了新的翻译键：`modelManager.getApiKey`

- **简体中文** (`zh-CN.ts`): "获取API密钥"
- **英文** (`en-US.ts`): "Get API Key"
- **繁体中文** (`zh-TW.ts`): "獲取API金鑰"

## 用户体验

1. **无侵入性**：链接图标仅在支持的 provider 上显示
2. **视觉清晰**：使用小巧的外部链接图标，不占用太多空间
3. **一键跳转**：点击即可在新标签页打开对应的 API Key 管理页面
4. **无卡顿**：链接直接跳转，不会影响页面性能
5. **适配深色模式**：使用 Naive UI 的主题色系，自动适配深色/浅色主题

## 技术细节

- 使用 Naive UI 的 `NButton` 组件渲染为 `<a>` 标签
- 通过 `tag="a"` 和 `href` 属性实现原生链接行为
- 使用 SVG 内联图标，避免额外的图标库依赖
- 图标大小：14x14px，视觉上与文本协调
- 按钮样式：`text` 类型，`tiny` 大小，`primary` 颜色

## 安全性

- 使用 `rel="noopener noreferrer"` 防止新窗口访问原窗口的 `window.opener`
- 所有 URL 都是硬编码的官方链接，不接受用户输入

## 扩展性

要为新的 provider 添加 API Key URL 支持：

1. 在对应的 adapter 的 `getProvider()` 方法中添加 `apiKeyUrl` 字段
2. UI 会自动显示链接图标，无需额外配置
