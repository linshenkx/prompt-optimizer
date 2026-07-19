# 桌面应用环境变量配置指南

## 概述
本文档说明如何通过环境变量配置桌面应用的构建和运行时行为。

## 🔧 构建时配置（electron-builder）

### 自动更新仓库配置

#### 生产环境构建
- 默认使用 `package.json` 中的配置：`linshenkx/prompt-optimizer`
- GitHub 工作流会自动检测当前仓库并更新配置
- 支持 fork 仓库的自动构建（无需额外配置）
- 使用 `GH_TOKEN_FOR_UPDATER` 发布到 GitHub Releases

#### 开发环境测试
对于本地开发时测试自动更新功能：

1. **修改 `dev-app-update.yml`**：
   ```yaml
   provider: github
   owner: your-username
   repo: your-repo-name
   private: false  # 或 true（如果是私有仓库）
   ```

2. **设置环境变量**（如果需要访问私有仓库的 Release）：
   ```bash
   export GITHUB_TOKEN=your_github_token
   ```

3. **启动开发模式**：
   ```bash
   pnpm run dev
   ```

### 配置说明
- `package.json`: 生产环境构建配置
- `dev-app-update.yml`: 开发环境测试配置
- `main.js` 中已配置 `autoUpdater.forceDevUpdateConfig = true`

### GitHub Token 说明
- **生产环境**：使用 `GH_TOKEN_FOR_UPDATER`（需要在 GitHub Secrets 中配置）
- **用途**：仅用于发布到 GitHub Releases，只支持公开仓库

## ⚡ 运行时配置（应用启动）

### API 密钥配置
应用启动时需要设置以下环境变量：

```bash
# OpenAI
export VITE_OPENAI_API_KEY=your_openai_key

# 其他 AI 服务
export VITE_GEMINI_API_KEY=your_gemini_key
export VITE_DEEPSEEK_API_KEY=your_deepseek_key
export VITE_SILICONFLOW_API_KEY=your_siliconflow_key
export VITE_ZHIPU_API_KEY=your_zhipu_key

# 自定义 API
export VITE_CUSTOM_API_KEY=your_custom_key
export VITE_CUSTOM_API_BASE_URL=https://api.example.com
export VITE_CUSTOM_API_MODEL=custom-model-name
```

### 动态更新源配置
应用支持运行时动态切换更新源：

```bash
# GitHub 仓库配置
export GITHUB_REPOSITORY=owner/repo
# 或者分别设置
export DEV_REPO_OWNER=owner
export DEV_REPO_NAME=repo

# GitHub Token（私有仓库需要）
export GH_TOKEN=your_github_token
export GITHUB_TOKEN=your_github_token  # 备用
```

## 🎯 实际使用示例

### 场景1：开发者 Fork 项目
```bash
# 1. 设置构建时配置
export REPO_OWNER=myusername
export REPO_NAME=my-prompt-optimizer
export REPO_PRIVATE=false

# 2. 构建应用
pnpm run build

# 3. 设置运行时配置
export GITHUB_REPOSITORY=myusername/my-prompt-optimizer
export VITE_OPENAI_API_KEY=sk-...

# 4. 运行应用
./dist/PromptOptimizer-1.2.0-win-x64.exe
```

### 场景2：自定义公开仓库部署
```bash
# 1. 设置构建时配置
export REPO_OWNER=company
export REPO_NAME=public-prompt-optimizer

# 2. 构建应用
pnpm run build

# 3. 设置运行时配置
export GITHUB_REPOSITORY=company/public-prompt-optimizer
export VITE_OPENAI_API_KEY=sk-...

# 4. 运行应用
./dist/PromptOptimizer-1.2.0-win-x64.exe
```

## 🔍 配置验证

### 构建时验证
构建完成后，检查生成的 `app-update.yml` 文件：
```yaml
# 应该包含正确的仓库信息
provider: github
owner: your-username
repo: your-repo-name
private: false
```

### 运行时验证
启动应用后，查看控制台日志：
```
[Updater] Using custom repository configuration: {
  owner: 'your-username',
  repo: 'your-repo-name',
  private: false,
  source: 'environment variables'
}
```

## ⚠️ 注意事项

1. **构建时 vs 运行时**：
   - `REPO_*` 变量影响构建时的 `app-update.yml` 生成
   - `GITHUB_*` 变量影响运行时的动态配置

2. **优先级**：
   - 运行时配置优先于构建时配置
   - 环境变量优先于默认值

3. **仓库要求**：
   - 只支持公开仓库
   - 不支持私有仓库

4. **兼容性**：
   - 如果不设置环境变量，使用默认的 `linshenkx/prompt-optimizer`
   - 向后兼容现有的构建流程

## 🐛 故障排除

### 构建时问题
- 确保环境变量在构建前已设置
- 检查 `app-update.yml` 文件内容
- 验证仓库名称格式正确

### 运行时问题
- 检查应用启动日志
- 确认仓库存在且为公开仓库
- 验证仓库名称格式正确

---

**更新时间**: 2025-01-12  
**版本**: v1.2.0+

## 安全说明（Desktop hardening）

- Renderer 仅接收明确 public 的 `VITE_APP_*` / `VITE_PUBLIC_*` 运行时配置；供应商 `VITE_*_API_KEY` 保留在主进程。
- 自定义模型密钥请写入应用内模型配置（如 `ls`），不要依赖把 API Key 注入 `window.runtime_config`。
- 若连接测试报 `IPC request sender is not trusted`，优先按 `README.md` 对应 FAQ 排查 Windows IPC 信任误杀。
