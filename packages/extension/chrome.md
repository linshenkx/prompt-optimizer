# 小词 - Chrome插件上架材料

本文档包含将"小词"上架到Chrome应用商店所需的所有材料和文案。

## 基本信息

### 插件名称
- **中文**：小词
- **英文**：GlobalCloud XiaoC

### 插件简短描述（132字符以内）
- **中文**：智能提示词增强工具：一键优化、改进提示词质量，提升AI回复准确度。多模型支持(OpenAI/Gemini/DeepSeek)，纯客户端处理确保数据安全，无需中间服务器。
- **英文**：Smart prompt enhancement tool: One-click optimization to improve prompt quality and AI response accuracy. Multi-model support (OpenAI/Gemini/DeepSeek), client-side processing for data security, no intermediary servers.

### 版本号
1.0.0

### 支持语言
- 简体中文
- 英文（计划中）

## 详细描述

### 中文详细描述
小词是一款专为AI对话体验提升设计的Chrome扩展，让您能够轻松优化提示词，获得更精准的AI回复。作为纯客户端应用，它不依赖任何自有服务器，所有数据存储和处理都在您的浏览器本地完成，仅在优化提示词时直接从您的浏览器调用AI服务提供商的API。

**核心功能：**

✅ **纯客户端架构** - 无自有服务器，所有数据存储和处理在本地完成
✅ **直接API调用** - 优化请求直接从您的浏览器发送到AI服务提供商，不经过中间服务器
✅ **多模型支持** - 集成OpenAI、Gemini、DeepSeek等多个主流AI模型
✅ **个性化配置** - 自定义API密钥和模型参数，完全掌控您的AI体验
✅ **本地存储** - 安全存储历史记录和设置，保护您的隐私
✅ **操作简便** - 界面简洁直观，操作流程顺畅自然
✅ **安全可靠** - API密钥加密存储，确保数据安全

**使用场景：**

- 优化ChatGPT、Claude等AI平台的提示词
- 改进Google Gemini、Microsoft Copilot等搜索提示
- 提升AI内容生成质量
- 调整AI代码生成指令
- 优化AI绘图提示词

**如何使用：**

1. 在任意网页中选中您想优化的提示词文本
2. 点击右键，选择"小词"
3. 在弹出窗口中查看优化结果
4. 一键复制优化后的提示词

**隐私与安全：**

- 纯客户端应用，没有自有服务器收集数据
- 所有AI模型调用直接从您的浏览器发起到AI服务提供商
- 所有API密钥均在本地加密存储
- 不收集任何个人信息
- 不追踪用户行为或浏览历史
- 开源项目，代码透明可查

**注意事项：**
虽然本扩展是纯客户端应用，但优化提示词的功能需要调用第三方AI服务提供商的API。这些API调用直接从您的浏览器发起，不经过我们的服务器，但会将您的提示词内容发送到相应的AI服务提供商（如OpenAI、Google等）。

### 英文详细描述
GlobalCloud XiaoC is a Chrome extension designed to enhance your AI conversation experience, allowing you to easily optimize prompts for more accurate AI responses. As a pure client-side application, it operates without any proprietary servers, with all data storage and processing done locally in your browser, only directly calling AI service providers' APIs from your browser when optimizing prompts.

**Core Features:**

✅ **One-Click Optimization** - Select text on any webpage and optimize prompts with a right-click
✅ **Pure Client-Side Architecture** - No proprietary servers, all data storage and processing done locally
✅ **Direct API Calls** - Optimization requests sent directly from your browser to AI service providers, without passing through intermediate servers
✅ **Multi-Model Support** - Integrated with OpenAI, Gemini, DeepSeek and other mainstream AI models
✅ **Personalized Configuration** - Customize API keys and model parameters for complete control
✅ **Local Storage** - Securely store history and settings to protect your privacy
✅ **Easy Operation** - Clean and intuitive interface with smooth workflow
✅ **Security** - Encrypted storage of API keys ensuring data security

**Use Cases:**

- Optimize prompts for ChatGPT, Claude and other AI platforms
- Improve search prompts for Google Gemini and Microsoft Copilot
- Enhance AI content generation quality
- Adjust AI code generation instructions
- Optimize AI image generation prompts

**How to Use:**

1. Select the prompt text you want to optimize on any webpage
2. Right-click and select "GlobalCloud XiaoC"
3. View the optimized result in the popup window
4. Copy the optimized prompt with one click

**Privacy & Security:**

- Pure client-side app with no proprietary servers collecting data
- All AI model calls made directly from your browser to AI service providers
- All API keys are encrypted and stored locally
- No personal information is collected
- No tracking of user behavior or browsing history
- Open-source project with transparent code

**Important Note:**
While this extension is a pure client-side application, the prompt optimization feature requires calling third-party AI service providers' APIs. These API calls are made directly from your browser without passing through our servers, but they will send your prompt content to the respective AI service provider (such as OpenAI, Google, etc.).

## 分类和标签

### 主要类别
生产力工具

### 次要类别
写作工具

### 关键词标签
- AI
- 提示词
- Prompt
- ChatGPT
- 优化
- Gemini
- DeepSeek
- 生产力
- 纯客户端
- 本地存储

## 图片资源

### 图标尺寸要求
需准备以下尺寸的PNG格式图标：
- 16x16
- 32x32
- 48x48
- 128x128

### 截图要求
- 至少提供1张截图（1280x800或640x400像素）
- 推荐提供3-5张截图展示不同功能
- 确保截图清晰展示插件的主要功能
- 避免在截图中包含个人信息

### 宣传图片（可选）
- 尺寸：1400x560像素
- 格式：PNG或JPEG
- 用途：在Chrome网上应用商店详情页顶部展示

## 其他必要信息

### 网站URL
https://github.com/linshenkx/prompt-optimizer

### 支持页面URL
https://github.com/linshenkx/prompt-optimizer/issues

### 隐私政策URL
https://github.com/linshenkx/prompt-optimizer/blob/main/packages/extension/privacy-policy.md

## 提交清单

在提交到Chrome应用商店前，请确保准备以下材料：

- [ ] 完整的manifest.json文件
- [ ] ZIP格式的插件包
- [ ] 所有尺寸的图标
- [ ] 至少1张截图
- [ ] 宣传图片（可选）
- [ ] 详细描述文本
- [ ] 隐私政策页面

## 注意事项

1. 确保插件功能符合[Chrome应用商店开发者计划政策](https://developer.chrome.com/docs/webstore/program-policies/)
2. 功能描述要准确，避免夸大或误导
3. 所有图片资源要清晰、专业
4. 隐私政策必须明确说明如何处理用户数据
5. 测试所有功能，确保在不同环境下正常工作
6. 版本更新时保持递增的版本号 