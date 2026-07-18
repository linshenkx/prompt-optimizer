# 桌面应用环境变量配置指南

## 环境变量加载顺序

桌面应用会按以下顺序加载环境变量：

1. **项目根目录的 `.env.local`** (推荐) - 与测试环境保持一致
2. **桌面应用目录的 `.env`** - 桌面应用专用配置
3. **系统环境变量** - 手动设置的环境变量

## 推荐配置方法

### 方法1：使用项目根目录的 .env.local（推荐）

在项目根目录 `prompt-optimizer/.env.local` 文件中添加：

```bash
# OpenAI
VITE_OPENAI_API_KEY=your_openai_key_here

# Google Gemini
VITE_GEMINI_API_KEY=your_gemini_key_here

# DeepSeek
VITE_DEEPSEEK_API_KEY=your_deepseek_key_here

# SiliconFlow
VITE_SILICONFLOW_API_KEY=your_siliconflow_key_here

# Zhipu AI
VITE_ZHIPU_API_KEY=your_zhipu_key_here

# 自定义API
VITE_CUSTOM_API_KEY=your_custom_key_here
VITE_CUSTOM_API_BASE_URL=your_custom_base_url
VITE_CUSTOM_API_MODEL=your_custom_model
```

**优点**：
- 与Web版本和测试环境共享同一配置
- 只需维护一个配置文件
- 自动被`.gitignore`排除，不会泄露密钥

### 方法2：桌面应用专用配置

在 `packages/desktop/.env` 文件中添加相同的环境变量。

**优点**：
- 桌面应用独立配置
- 可以与Web版本使用不同的API密钥

### 方法3：系统环境变量

Windows用户：
```cmd
set VITE_OPENAI_API_KEY=your_openai_key_here
set VITE_GEMINI_API_KEY=your_gemini_key_here
npm start
```

macOS/Linux用户：
```bash
export VITE_OPENAI_API_KEY=your_openai_key_here
export VITE_GEMINI_API_KEY=your_gemini_key_here
npm start
```

## 验证配置

启动桌面应用时，主进程控制台会显示：

```
[Main Process] .env.local file loaded from project root
[Main Process] .env file loaded from desktop directory
[Main Process] Checking environment variables...
[Main Process] Found VITE_OPENAI_API_KEY: [CONFIGURED]
[Main Process] Found VITE_GEMINI_API_KEY: [CONFIGURED]
```

如果看到 `Missing VITE_XXX_API_KEY`，说明对应的环境变量未设置。

> 安全说明：API 密钥仅保留在 Electron 主进程。渲染进程不会获得 `VITE_*` 密钥、token 或自定义请求 headers；如果需要公开非敏感标识，请使用不含敏感字段的 `VITE_PUBLIC_*` 或 `VITE_APP_*` 变量。

## 常见问题

### Q: 我的.env.local文件有效吗？
A: **有效！** 桌面应用现在会自动加载项目根目录的`.env.local`文件。

### Q: 为什么UI显示有API密钥，但测试连接失败？
A: 这是因为UI进程和主进程环境隔离。确保：
1. 环境变量正确设置在`.env.local`文件中
2. 重启桌面应用以重新加载环境变量
3. 检查主进程控制台确认环境变量被正确读取

### Q: 可以同时使用多种配置方法吗？
A: 可以。dotenv会按加载顺序合并配置，后加载的不会覆盖已存在的变量。

## 安全提醒

- 永远不要将包含API密钥的文件提交到Git仓库
- `.env.local`已在`.gitignore`中排除
- 如果使用`.env`文件，请手动添加到`.gitignore`
