# Prompt Optimizer 🚀

<div align="center">

[English](README_EN.md) | [中文](README.md)
[Русский](README_RU.md) 
[![GitHub stars](https://img.shields.io/github/stars/linshenkx/prompt-optimizer)](https://github.com/linshenkx/prompt-optimizer/stargazers)
![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/cakkkhboolfnadechdlgdcnjammejlna?style=flat&label=Chrome%20Users&link=https%3A%2F%2Fchromewebstore.google.com%2Fdetail%2F%25E6%258F%2590%25E7%25A4%25BA%25E8%25AF%258D%25E4%25BC%2598%25E5%258C%2596%25E5%2599%25A8%2Fcakkkhboolfnadechdlgdcnjammejlna)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/linshen/prompt-optimizer)](https://hub.docker.com/r/linshen/prompt-optimizer)
![GitHub forks](https://img.shields.io/github/forks/linshenkx/prompt-optimizer?style=flat)
[![Deploy with Vercel](https://img.shields.io/badge/Vercel-indigo?style=flat&logo=vercel)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinshenkx%2Fprompt-optimizer) 

[在线体验](https://prompt.always200.com) | [快速开始](#快速开始) | [常见问题](#常见问题) | [Chrome插件](https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna)

[开发文档](dev.md) | [Vercel部署指南](docs/user/deployment/vercel.md) | [MCP部署使用说明](docs/user/mcp-server.md) | [DeepWiki文档](https://deepwiki.com/linshenkx/prompt-optimizer) | [ZRead文档](https://zread.ai/linshenkx/prompt-optimizer)

</div>

## 📖 Project Introduction

Prompt Optimizer is a powerful AI prompt optimization tool that helps you write better AI prompts and improve the quality of AI outputs. It supports four usage methods: web application, desktop application, Chrome extension, and Docker deployment.

### 🎥 Feature Demonstration

<div align="center">
  <p><b>1. Role-playing Dialogue: Unleashing the Potential of Small Models</b></p>
  <p>In cost-effective production scenarios or privacy-focused local deployments, structured prompts enable small models to consistently enter character roles, providing immersive and highly consistent role-playing experiences that effectively unleash their potential.</p>
  <img src="images/demo/cat-maid-roleplay.png" alt="猫女仆角色扮演演示" width="85%">
  <br>
  <p><b>2. Knowledge Graph Extraction: Ensuring Production Environment Stability</b></p>
  <p>In production environments requiring programmatic processing, high-quality prompts can significantly reduce requirements for model intelligence, enabling more economical small models to stably output reliable specified formats. This tool aims to assist developers in quickly achieving this goal, thereby accelerating development, ensuring stability, and achieving cost reduction and efficiency improvement.</p>
  <img src="images/demo/knowledge-graph-extractor.png" alt="知识图谱提取演示" width="85%">
  <br>
  <p><b>3. Poetry Writing: Assisting Creative Exploration and Requirement Customization</b></p>
  <p>When facing a powerful AI, our goal is not just to get a "good" answer, but to get a "desired" unique answer. This tool can help users refine vague inspiration (like "write a poem") into specific requirements (about what theme, what imagery, what emotions), assisting you in exploring, discovering, and precisely expressing your creativity to co-create unique works with AI.</p>
  <img src="images/demo/poetry-writing.png" alt="诗歌创作演示" width="85%">
</div>

## ✨ 核心特性

- 🎯 **智能优化**：一键优化提示词，支持多轮迭代改进，提升AI回复准确度
- 📝 **双模式优化**：支持系统提示词优化和用户提示词优化，满足不同使用场景
- 🔄 **对比测试**：支持原始提示词和优化后提示词的实时对比，直观展示优化效果
- 🤖 **多模型集成**：支持OpenAI、Gemini、DeepSeek、智谱AI、SiliconFlow等主流AI模型
- 🔒 **安全架构**：纯客户端处理，数据直接与AI服务商交互，不经过中间服务器
- 📱 **多端支持**：同时提供Web应用、桌面应用、Chrome插件和Docker部署四种使用方式
- 🔐 **访问控制**：支持密码保护功能，保障部署安全
- 🧩 **MCP协议支持**：支持Model Context Protocol (MCP) 协议，可与Claude Desktop等MCP兼容应用集成

## 快速开始

## Quick Start

### 1. Use Online Version (Recommended)

直接访问：[https://prompt.always200.com](https://prompt.always200.com)

This is a pure frontend project with all data stored locally in your browser and never uploaded to any server, making the online version both safe and reliable to use.

### 2. Vercel Deployment
Method 1: One-click deployment to your own Vercel:
方式2: Fork项目后在Vercel中导入（推荐，但需参考部署文档进行手动设置）：
   - 先Fork项目到自己的GitHub
   - 然后在Vercel中导入该项目
   - 可跟踪源项目更新，便于同步最新功能和修复
- 配置环境变量：
  - `ACCESS_PASSWORD`：设置访问密码，启用访问限制
  - `VITE_OPENAI_API_KEY`等：配置各AI服务商的API密钥

更多详细的部署步骤和注意事项，请查看：
- [Vercel Deployment Guide](docs/user/deployment/vercel_en.md)

### 3. Download Desktop Application
从 [GitHub Releases](https://github.com/linshenkx/prompt-optimizer/releases) 下载最新版本。我们为各平台提供**安装程序**和**压缩包**两种格式。
- **Installer (Recommended)**: Such as `*.exe`, `*.dmg`, `*.AppImage`, etc. **Strongly recommended as it supports automatic updates**.\n
- **压缩包**: 如 `*.zip`。解压即用，但无法自动更新。

**桌面应用核心优势**:
- ✅ **无跨域限制**：作为原生桌面应用，它能彻底摆脱浏览器跨域（CORS）问题的困扰。这意味着您可以直接连接任何AI服务提供商的API，包括本地部署的Ollama或有严格安全策略的商业API，获得最完整、最稳定的功能体验。
- ✅ **自动更新**：通过安装程序（如 `.exe`, `.dmg`）安装的版本，能够自动检查并更新到最新版。
- ✅ **独立运行**：无需依赖浏览器，提供更快的响应和更佳的性能。

### 4. 安装Chrome插件
1. 从Chrome商店安装（由于审批较慢，可能不是最新的）：[Chrome商店地址](https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna)
2. Click the icon to open the Prompt Optimizer

### 5. Docker Deployment
<details>
<summary>点击查看 Docker 部署命令</summary>

```bash
# 运行容器（默认配置）
docker run -d -p 8081:80 --restart unless-stopped --name prompt-optimizer linshen/prompt-optimizer

# 运行容器（配置API密钥和访问密码）
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your_key \
  -e ACCESS_USERNAME=your_username \  # 可选，默认为"admin"
  -e ACCESS_PASSWORD=your_password \  # 设置访问密码
  --restart unless-stopped \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```
</details>

> **国内镜像**: 如果Docker Hub访问较慢，可以将上述命令中的 `linshen/prompt-optimizer` 替换为 `registry.cn-guangzhou.aliyuncs.com/prompt-optimizer/prompt-optimizer`

### 6. Docker Compose部署
<details>
<summary>点击查看 Docker Compose 部署步骤</summary>

```bash
# 1. 克隆仓库
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. 可选：创建.env文件配置API密钥和访问认证
cp env.local.example .env
# 编辑 .env 文件，填入实际的 API 密钥和配置

# 3. 启动服务
docker compose up -d

# 4. 查看日志
docker compose logs -f

# 5. 访问服务
Web 界面：http://localhost:8081
MCP 服务器：http://localhost:8081/mcp
```
</details>

你还可以直接编辑docker-compose.yml文件，自定义配置：
<details>
<summary>点击查看 docker-compose.yml 示例</summary>

```yaml
services:
  prompt-optimizer:
    # 使用Docker Hub镜像
    image: linshen/prompt-optimizer:latest
    # 或使用阿里云镜像（国内用户推荐）
    # image: registry.cn-guangzhou.aliyuncs.com/prompt-optimizer/prompt-optimizer:latest
    container_name: prompt-optimizer
    restart: unless-stopped
    ports:
      - "8081:80"  # Web应用端口（包含MCP服务器，通过/mcp路径访问）
    environment:
      # API密钥配置
      - VITE_OPENAI_API_KEY=your_openai_key
      - VITE_GEMINI_API_KEY=your_gemini_key
      # 访问控制（可选）
      - ACCESS_USERNAME=admin
      - ACCESS_PASSWORD=your_password
```
</details>

### 7. MCP Server 使用说明
<details>
<summary>点击查看 MCP Server 使用说明</summary>

Prompt Optimizer 现在支持 Model Context Protocol (MCP) 协议，可以与 Claude Desktop 等支持 MCP 的 AI 应用集成。

当通过 Docker 运行时，MCP Server 会自动启动，并可通过 `http://ip:port/mcp` 访问。

#### 环境变量配置

MCP Server 需要配置 API 密钥才能正常工作。主要的 MCP 专属配置：

```bash
# MCP 服务器配置
MCP_DEFAULT_MODEL_PROVIDER=openai  # 可选值：openai, gemini, deepseek, siliconflow, zhipu, custom
MCP_LOG_LEVEL=info                 # 日志级别
```

#### Docker 环境下使用 MCP

在 Docker 环境中，MCP Server 会与 Web 应用一起运行，您可以通过 Web 应用的相同端口访问 MCP 服务，路径为 `/mcp`。

例如，如果您将容器的 80 端口映射到主机的 8081 端口：
```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

那么 MCP Server 将可以通过 `http://localhost:8081/mcp` 访问。

#### Claude Desktop 集成示例

要在 Claude Desktop 中使用 Prompt Optimizer，您需要在 Claude Desktop 的配置文件中添加服务配置。

1. 找到 Claude Desktop 的配置目录：
   - Windows: `%APPDATA%\Claude\services`
   - macOS: `~/Library/Application Support/Claude/services`
   - Linux: `~/.config/Claude/services`

2. 编辑或创建 `services.json` 文件，添加以下内容：

```json
{
  "services": [
    {
      "name": "Prompt Optimizer",
      "url": "http://localhost:8081/mcp"
    }
  ]
}
```

请确保将 `localhost:8081` 替换为您实际部署 Prompt Optimizer 的地址和端口。

#### 可用工具

- **optimize-user-prompt**: 优化用户提示词以提高 LLM 性能
- **optimize-system-prompt**: 优化系统提示词以提高 LLM 性能
- **iterate-prompt**: 对已经成熟/完善的提示词进行定向迭代优化

更多详细信息，请查看 [MCP 服务器用户指南](docs/user/mcp-server.md)。
</details>

## ⚙️ API密钥配置

<details>
<summary>点击查看API密钥配置方法</summary>

### 方式一：通过界面配置（推荐）
1. 点击界面右上角的"⚙️设置"按钮
2. 选择"模型管理"选项卡
3. 点击需要配置的模型（如OpenAI、Gemini、DeepSeek等）
4. 在弹出的配置框中输入对应的API密钥
5. 点击"保存"即可

支持的模型：OpenAI、Gemini、DeepSeek、Zhipu智谱、SiliconFlow、自定义API（OpenAI兼容接口）

除了API密钥，您还可以在模型配置界面为每个模型单独设置高级LLM参数。这些参数通过一个名为 `llmParams` 的字段进行配置，它允许您以键值对的形式指定LLM SDK支持的任何参数，从而更精细地控制模型行为。

**高级LLM参数配置示例：**
- **OpenAI/兼容API**: `{"temperature": 0.7, "max_tokens": 4096, "timeout": 60000}`
- **Gemini**: `{"temperature": 0.8, "maxOutputTokens": 2048, "topP": 0.95}`
- **DeepSeek**: `{"temperature": 0.5, "top_p": 0.9, "frequency_penalty": 0.1}`

有关 `llmParams` 的更详细说明和配置指南，请参阅 [LLM参数配置指南](docs/developer/llm-params-guide.md)。

### 方式二：通过环境变量配置
Docker部署时通过 `-e` 参数配置环境变量：

```bash
-e VITE_OPENAI_API_KEY=your_key
-e VITE_GEMINI_API_KEY=your_key
-e VITE_DEEPSEEK_API_KEY=your_key
-e VITE_ZHIPU_API_KEY=your_key
-e VITE_SILICONFLOW_API_KEY=your_key
-e VITE_CUSTOM_API_KEY=your_custom_api_key
-e VITE_CUSTOM_API_BASE_URL=your_custom_api_base_url
-e VITE_CUSTOM_API_MODEL=your_custom_model_name
```

</details>

## 本地开发
详细文档可查看 [开发文档](dev.md)

<details>
<summary>点击查看本地开发命令</summary>

```bash
# 1. 克隆项目
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. 安装依赖
pnpm install

# 3. 启动开发服务
pnpm dev               # 主开发命令：构建core/ui并运行web应用
pnpm dev:web          # 仅运行web应用
pnpm dev:fresh        # 完整重置并重新启动开发环境
```
</details>

## 🗺️ 开发路线

- [x] 基础功能开发
- [x] Web应用发布 
- [x] Chrome插件发布
- [x] 国际化支持
- [x] 支持系统提示词优化和用户提示词优化
- [x] 桌面应用发布
- [x] mcp服务发布

详细的项目状态可查看 [项目状态文档](docs/project-status.md)

## 📖 相关文档

- [文档索引](docs/README.md) - 所有文档的索引
- [技术开发指南](docs/developer/technical-development-guide.md) - 技术栈和开发规范
- [LLM参数配置指南](docs/developer/llm-params-guide.md) - 高级LLM参数配置详细说明
- [项目结构](docs/developer/project-structure.md) - 详细的项目结构说明
- [项目状态](docs/project/project-status.md) - 当前进度和计划
- [产品需求](docs/project/prd.md) - 产品需求文档
- [Vercel部署指南](docs/user/deployment/vercel.md) - Vercel部署详细说明


## Star History

<a href="https://star-history.com/#linshenkx/prompt-optimizer&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=linshenkx/prompt-optimizer&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=linshenkx/prompt-optimizer&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=linshenkx/prompt-optimizer&type=Date" />
 </picture>
</a>

## 常见问题

<details>
<summary>点击查看常见问题解答</summary>

### API连接问题

#### Q1: 为什么配置好API密钥后仍然无法连接到模型服务？
**A**: 大多数连接失败是由**跨域问题**（CORS）导致的。由于本项目是纯前端应用，浏览器出于安全考虑会阻止直接访问不同源的API服务。模型服务如未正确配置CORS策略，会拒绝来自浏览器的直接请求。

#### Q2: 如何解决本地Ollama的连接问题？
**A**: Ollama完全支持OpenAI标准接口，只需配置正确的跨域策略：
1. 设置环境变量 `OLLAMA_ORIGINS=*` 允许任意来源的请求
2. 如仍有问题，设置 `OLLAMA_HOST=0.0.0.0:11434` 监听任意IP地址

#### Q3: 如何解决商业API（如Nvidia的DS API、字节跳动的火山API）的跨域问题？
**A**: 这些平台通常有严格的跨域限制，推荐以下解决方案：

1. **使用Vercel代理**（便捷方案）
   - 使用在线版本：[prompt.always200.com](https://prompt.always200.com)
   - 或自行部署到Vercel平台
   - 在模型设置中勾选"使用Vercel代理"选项
   - 请求流向：浏览器→Vercel→模型服务提供商
   - 详细步骤请参考 [Vercel部署指南](docs/user/deployment/vercel.md)

2. **使用自部署的API中转服务**（可靠方案）
   - 部署如OneAPI等开源API聚合/代理工具
   - 在设置中配置为自定义API端点
   - 请求流向：浏览器→中转服务→模型服务提供商

#### Q4: Vercel代理有什么缺点或风险？
**A**: 使用Vercel代理可能会触发某些模型服务提供商的风控机制。部分厂商可能会将来自Vercel的请求判定为代理行为，从而限制或拒绝服务。如遇此问题，建议使用自部署的中转服务。

#### Q5: 我已正确配置本地模型（如Ollama）的跨域策略，为什么使用在线版依然无法连接？
**A**: 这是由浏览器的**混合内容（Mixed Content）安全策略**导致的。出于安全考虑，浏览器会阻止安全的HTTPS页面（如在线版）向不安全的HTTP地址（如您的本地Ollama服务）发送请求。

**解决方案**：
为了绕过此限制，您需要让应用和API处于同一种协议下（例如，都是HTTP）。推荐以下几种方式：
1. **使用桌面版**：桌面应用没有浏览器限制，是连接本地模型最稳定可靠的方式。
2. **docker部署**：docker部署也是http
3. **使用Chrome插件**：插件在某些情况下也可以绕过部分安全限制。

</details>


## 🤝 参与贡献

<details>
<summary>点击查看贡献指南</summary>

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m '添加某个特性'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

提示：使用cursor工具开发时，建议在提交前:
1. 使用"code_review"规则进行代码审查
2. 按照审查报告格式检查:
   - 变更的整体一致性
   - 代码质量和实现方式
   - 测试覆盖情况
   - 文档完善程度
3. 根据审查结果进行优化后再提交

</details>

## 👏 贡献者名单

感谢所有为项目做出贡献的开发者！

<a href="https://github.com/linshenkx/prompt-optimizer/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=linshenkx/prompt-optimizer" alt="贡献者" />
</a>

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议开源。

---

如果这个项目对你有帮助，请考虑给它一个 Star ⭐️

## 👥 联系我们

- 提交 Issue
- 发起 Pull Request
- 加入讨论组