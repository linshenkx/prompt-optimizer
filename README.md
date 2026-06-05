# GlobalCloud XiaoC 🚀

<div align="center">

[English](README.md) | [中文](README.zh-CN.md)

[![GitHub stars](https://img.shields.io/github/stars/linshenkx/prompt-optimizer)](https://github.com/linshenkx/prompt-optimizer/stargazers)
![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/cakkkhboolfnadechdlgdcnjammejlna?style=flat&label=Chrome%20Users&link=https%3A%2F%2Fchromewebstore.google.com%2Fdetail%2F%25E6%258F%2590%25E7%25A4%25BA%25E8%25AF%258D%25E4%25BC%2598%25E5%258C%2596%25E5%2599%25A8%2Fcakkkhboolfnadechdlgdcnjammejlna)

<a href="https://trendshift.io/repositories/13813" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13813" alt="linshenkx%2Fprompt-optimizer | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/linshen/prompt-optimizer)](https://hub.docker.com/r/linshen/prompt-optimizer)
![GitHub forks](https://img.shields.io/github/forks/linshenkx/prompt-optimizer?style=flat)
[![Deploy with Vercel](https://img.shields.io/badge/Vercel-indigo?style=flat&logo=vercel)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinshenkx%2Fprompt-optimizer)

[Website](https://always200.com) | [Online Optimizer](https://prompt.always200.com) | [Prompt Garden](https://garden.always200.com) | [Docs](https://docs.always200.com) | [Quick Start](#quick-start) | [Chrome Extension](https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna) | [💖 Support](https://ko-fi.com/linshenkx)

[Development Docs](docs/developer/development.md) | [Vercel Deployment Guide](docs/user/deployment/vercel_en.md) | [Cloudflare Deployment Guide](docs/user/deployment/cloudflare-pages_en.md) | [MCP Deployment Guide](docs/user/mcp-server_en.md) | [DeepWiki Docs](https://deepwiki.com/linshenkx/prompt-optimizer) | [ZRead Docs](https://zread.ai/linshenkx/prompt-optimizer)

</div>

## 📖 Project Introduction

GlobalCloud XiaoC, abbreviated as XC and named 小词 in Chinese, is a prompt engineering service for Feishu and other business systems. It uses the wiki system as the source of knowledge and operating rules, then provides prompt generation, optimization, testing, and evaluation capabilities to application systems.

XC can serve embedded prompt engineering capabilities through MCP for Feishu, XGD, GPC, Hermes, OpenClaw, and other systems. It can also be used directly through the Web or desktop clients. Prompts can start from wiki content, manual writing, templates, local imports, or sources such as [Prompt Garden](https://garden.always200.com). GlobalCloud XiaoC is where those prompts are generated, optimized, tested, evaluated, and saved as reusable prompt assets.

### 🎥 Feature Demonstration

<div align="center">
  <p><b>1. Hard-Nosed Reviewer: Turn Agreement into Useful Critique</b></p>
  <p>Starting from a minimal English role prompt, optimization pushes a small model away from generic pushback and toward a clearer, more structured review that surfaces weak assumptions, evidence gaps, and concrete revision advice.</p>
  <img src="images/demo/hard-nosed-reviewer-fullpage-en.png" alt="Hard-nosed reviewer full-page demo" width="85%">
  <br>
  <p><b>2. Marketplace Bargaining Reply: Let Variables Change the Strategy</b></p>
  <p>With a single reusable prompt template, you can swap in item details, price anchors, buyer offers, tone, and negotiation goals for different marketplace conversations. After optimization, the same small model does a better job turning those variables into a clearer, more transaction-ready reply instead of a generic helper-style response.</p>
  <img src="images/demo/pro-variable-bargaining-reply-en.png" alt="Marketplace bargaining reply variable-mode demo" width="85%">
  <br>
  <p><b>3. Text-to-Image: Optimize a One-Line Idea into a More Directable Key Visual Prompt</b></p>
  <p>This is not just prompt expansion. Starting from a vague one-line idea, GlobalCloud XiaoC adds clearer subject cues, spatial relationships, and mood anchors. The left side is simply “a floating library in the night sky,” while the optimized version gives the model a more directed fantasy composition that feels closer to a reusable key visual than a lucky generic image.</p>
  <img src="images/demo/text2image-floating-library-creative-en.png" alt="Floating library text-to-image demo" width="85%">
</div>

## ✨ Core Features

- 🎯 **Intelligent Optimization**: One-click prompt optimization with multi-round iterative improvements to enhance AI response accuracy
- 📝 **Dual Mode Optimization**: Support for both system prompt optimization and user prompt optimization to meet different usage scenarios
- 🔄 **Analysis and Compare Evaluation**: Supports analysis, single-result evaluation, and multi-result compare evaluation to help determine whether a prompt has truly improved
- 🤖 **Multi-model Integration**: Support for mainstream AI models including OpenAI, Gemini, DeepSeek, Grok, Zhipu AI, SiliconFlow, MiniMax, etc.
- 🖼️ **Image Generation**: Support for Text-to-Image (T2I), Image-to-Image (I2I), and Multi-Image generation with models like Gemini, Seedream, Grok
- 🌱 **Prompt Sources**: Start from manual writing, templates, local imports, or Prompt Garden import codes
- 📚 **Wiki-driven Prompting**: Generate usable prompts from wiki knowledge, workflows, roles, and operating rules
- 🧩 **Embedded System Service**: Provide prompt engineering services to Feishu, XGD, GPC, Hermes, OpenClaw, and other systems through MCP
- ⭐ **Smart Favorites**: Resource-aware prompt assets with version history, reproducible examples, media support, source binding, and workspace application
- 📊 **Advanced Testing Mode**: Context variable management, multi-turn conversation testing, Function Calling support
- 🔒 **Secure Architecture**: Pure client-side processing with direct data interaction with AI service providers, bypassing intermediate servers
- 📱 **Multi-platform Support**: Available as web application, desktop application, Chrome extension, and Docker deployment
- 🔐 **Access Control**: Password protection feature for secure deployment
- 🧩 **MCP Protocol Support**: Supports Model Context Protocol (MCP), enabling integration with Feishu, XGD, GPC, Hermes, OpenClaw, Claude Desktop, and other MCP-compatible applications

## 🚀 Advanced Features

### Image Generation Mode
- 🖼️ **Text-to-Image (T2I)**: Generate images from text prompts
- 🎨 **Image-to-Image (I2I)**: Transform and optimize images based on local files
- 🖼️ **Multi-Image Generation**: Use multiple input images to constrain subject relationships, sequential semantics, and final generation goals
- 🔌 **Multi-model Support**: Integrated with mainstream image generation models like Gemini, Seedream, Grok
- ⚙️ **Model Parameters**: Support model-specific parameter configuration (size, style, etc.)
- 📥 **Preview & Download**: Real-time preview of generated results with download support
- 🔄 **Style Transfer**: Learn style, composition, and color from reference images

### Prompt Sources & Smart Favorites
- 🌱 **Optional Prompt Sources**: Bring prompts from manual writing, templates, local files, or [Prompt Garden](https://garden.always200.com)
- 📥 **Import & Collect**: Import prompts with metadata, media, examples, and source binding when available
- ⭐ **Resource-aware Assets**: Save stable prompts as reusable favorites with version history
- 🔗 **Source Binding**: Track prompt origins and maintain reproducible examples without requiring a specific source
- 📦 **Complete Backup**: Export and import favorites with all referenced resources

### Advanced Testing Mode
- 📊 **Context Variable Management**: Custom variables, batch replacement, variable preview
- 💬 **Multi-turn Conversation Testing**: Simulate real conversation scenarios to test prompt performance in multi-turn interactions
- 🛠️ **Function Calling Support**: Function Calling integration with support for OpenAI and Gemini tool calling
- 🔍 **Analysis and Evaluation Pipeline**: Supports analysis, evaluation, compare evaluation, and evaluation-driven smart rewrite in text modes

For detailed usage instructions, please refer to the [Image Mode Documentation](docs/image-mode.md)

## Quick Start

### 1. Use Online Version (Recommended)

Direct access: [https://prompt.always200.com](https://prompt.always200.com)

This is a pure frontend project with all data stored locally in your browser and never uploaded to any server, making the online version both safe and reliable to use.

### 2. Web Deployment

#### Vercel Deployment
Method 1: One-click deployment to your own Vercel:
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flinshenkx%2Fprompt-optimizer)

Method 2: Fork the project and import to Vercel (Recommended):
   - First fork the project to your GitHub account
   - Then import the project to Vercel
   - This allows tracking of source project updates for easy syncing of new features and fixes
- Configure environment variables:
  - `ACCESS_PASSWORD`: Set access password to enable access restriction
  - `VITE_OPENAI_API_KEY` etc.: Optional private-deployment model settings. Do not preconfigure API keys on public frontend deployments because `VITE_*` values are exposed in browser assets.

For more detailed deployment steps and important notes, please check:
- [Vercel Deployment Guide](docs/user/deployment/vercel_en.md)
- [Cloudflare Deployment Guide](docs/user/deployment/cloudflare-pages_en.md)

#### Cloudflare Deployment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/linshenkx/prompt-optimizer)

Use the Deploy to Cloudflare button for the quickest public-repository setup. It creates a repository under your GitHub/GitLab account and deploys with Workers Builds. For private repositories or stricter repository-access control, import your own repository manually; keep the default deploy commands and clear the build command if Cloudflare auto-fills `pnpm run build`, because `wrangler.jsonc` builds the Web frontend and publishes `packages/web/dist` as static assets.

For access control and analytics on Cloudflare, configure Cloudflare Access and Cloudflare Web Analytics in the Cloudflare dashboard. No frontend dependency or application-code change is required.

### 3. Download Desktop Application
Download the latest version from [GitHub Releases](https://github.com/linshenkx/prompt-optimizer/releases). We provide both **installer** and **archive** formats for each platform.

- **Installer (Recommended)**: Such as `*.exe`, `*.dmg`, `*.AppImage`, etc. **Strongly recommended as it supports automatic updates**.
- **Archive**: Such as `*.zip`. Extract and use, but cannot auto-update.

**Core Advantages of Desktop Application**:
- ✅ **No CORS Limitations**: As a native desktop application, it completely eliminates browser Cross-Origin Resource Sharing (CORS) issues. This means you can directly connect to any AI service provider's API, including locally deployed Ollama or commercial APIs with strict security policies, for the most complete and stable functional experience.
- ✅ **Automatic Updates**: Versions installed through installers (like `.exe`, `.dmg`) can automatically check and update to the latest version.
- ✅ **Independent Operation**: No browser dependency, providing faster response and better performance.

### 4. Install Chrome Extension
1. Install from Chrome Web Store (may not be the latest version due to approval delays): [Chrome Web Store](https://chromewebstore.google.com/detail/prompt-optimizer/cakkkhboolfnadechdlgdcnjammejlna)
2. Click the icon to open the GlobalCloud XiaoC

### 5. Docker Deployment
<details>
<summary>Click to view Docker deployment commands</summary>
```bash
# Run container (default configuration)
docker run -d -p 8081:80 --restart unless-stopped --name globalcloud-xiaoc linshen/prompt-optimizer

# Run container (with API key configuration and password protection)
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your_key \
  -e ACCESS_USERNAME=your_username \  # Optional, defaults to "admin"
  -e ACCESS_PASSWORD=your_password \  # Set access password
  --restart unless-stopped \
  --name globalcloud-xiaoc \
  linshen/prompt-optimizer
```
</details>

### 6. Docker Compose Deployment
<details>
<summary>Click to view Docker Compose deployment steps</summary>
```bash
# 1. Clone the repository
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. Create .env file for API keys and authentication
cat > .env << EOF
# API Key Configuration
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key
VITE_GROK_API_KEY=your_xai_api_key
VITE_ZHIPU_API_KEY=your_zhipu_api_key
VITE_SILICONFLOW_API_KEY=your_siliconflow_api_key

# Basic Authentication (Password Protection)
ACCESS_USERNAME=your_username  # Optional, defaults to "admin"
ACCESS_PASSWORD=your_password  # Set access password
EOF

# Because the compose file is under docker/, pass the root .env explicitly.

# 3. Start the service
docker compose --env-file .env -f docker/docker-compose.yml up -d

# 4. View logs
docker compose --env-file .env -f docker/docker-compose.yml logs -f

# 5. Access the service
Web Interface: http://localhost:8081
MCP Server: http://localhost:8081/mcp
```
</details>

You can also directly edit the docker/docker-compose.yml file to customize your configuration:
<details>
<summary>Click to view docker/docker-compose.yml example</summary>

```yaml
services:
  globalcloud-xiaoc:
    # Use Docker Hub image
    image: linshen/prompt-optimizer:latest
    container_name: globalcloud-xiaoc
    restart: unless-stopped
    ports:
      - "8081:80"  # Web application port (MCP server accessible via /mcp path)
    environment:
      - VITE_OPENAI_API_KEY=your_openai_key
      - VITE_GEMINI_API_KEY=your_gemini_key
      - VITE_GROK_API_KEY=your_xai_key
      # Access Control (Optional)
      - ACCESS_USERNAME=admin
      - ACCESS_PASSWORD=your_password
```
</details>

### 7. MCP Server Usage Instructions
<details>
<summary>Click to view MCP Server usage instructions</summary>

GlobalCloud XiaoC now supports the Model Context Protocol (MCP), enabling integration with AI applications that support MCP such as Claude Desktop.

When running via Docker, the MCP Server automatically starts and can be accessed via `http://ip:port/mcp`.

#### Environment Variable Configuration

MCP Server requires API key configuration to function properly. Main MCP-specific configurations:

```bash
# MCP Server Configuration
MCP_DEFAULT_MODEL_PROVIDER=openai  # Options: openai, gemini, anthropic, deepseek, grok, siliconflow, zhipu, dashscope, openrouter, modelscope, custom
MCP_LOG_LEVEL=info                 # Log level
```

#### Using MCP in Docker Environment

In a Docker environment, the MCP Server runs alongside the web application. You can access the MCP service through the same port as the web application at the `/mcp` path.

For example, if you map the container's port 80 to port 8081 on the host:
```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name globalcloud-xiaoc \
  linshen/prompt-optimizer
```

The MCP Server will then be accessible at `http://localhost:8081/mcp`.

#### Claude Desktop Integration Example

To use GlobalCloud XiaoC in Claude Desktop, you need to add the service configuration to Claude Desktop's configuration file.

1. Find Claude Desktop's configuration directory:
   - Windows: `%APPDATA%\Claude\services`
   - macOS: `~/Library/Application Support/Claude/services`
   - Linux: `~/.config/Claude/services`

2. Edit or create the `services.json` file, adding the following content:

```json
{
  "services": [
    {
      "name": "GlobalCloud XiaoC",
      "url": "http://localhost:8081/mcp"
    }
  ]
}
```

Make sure to replace `localhost:8081` with the actual address and port where you've deployed GlobalCloud XiaoC.

#### Available Tools

- **optimize-user-prompt**: Optimize user prompts to improve LLM performance
- **optimize-system-prompt**: Optimize system prompts to improve LLM performance
- **iterate-prompt**: Iteratively improve mature prompts based on specific requirements

For more detailed information, please refer to the [MCP Server User Guide](docs/user/mcp-server_en.md).
</details>

## ⚙️ API Key Configuration

<details>
<summary>Click to view API key configuration methods</summary>

### Method 1: Via Interface (Recommended)
1. Click the "⚙️Settings" button in the upper right corner
2. Select the "Model Management" tab
3. Click on the model you need to configure (such as OpenAI, Gemini, DeepSeek, Grok, etc.)
4. Enter the corresponding API key in the configuration box
5. Click "Save"

Supported models: OpenAI, Gemini, DeepSeek, Grok, Zhipu AI, SiliconFlow, Custom API (OpenAI compatible interface)

In addition to API keys, you can configure advanced LLM parameters for each model individually. These parameters are configured through a field called `llmParams`, which allows you to specify any parameters supported by the LLM SDK in key-value pairs for fine-grained control over model behavior.

**Advanced LLM Parameter Configuration Examples:**
- **OpenAI/Compatible APIs**: `{"temperature": 0.7, "max_tokens": 4096, "timeout": 60000}`
- **Gemini**: `{"temperature": 0.8, "maxOutputTokens": 2048, "topP": 0.95}`
- **DeepSeek**: `{"temperature": 0.5, "top_p": 0.9, "frequency_penalty": 0.1}`

For more detailed information about `llmParams` configuration, please refer to the [LLM Parameters Configuration Guide](docs/developer/llm-params-guide.md).

### Method 2: Via Environment Variables
Configure environment variables through the `-e` parameter when deploying with Docker:

```bash
-e VITE_OPENAI_API_KEY=your_key
-e VITE_GEMINI_API_KEY=your_key
-e VITE_DEEPSEEK_API_KEY=your_key
-e VITE_GROK_API_KEY=your_key
-e VITE_ZHIPU_API_KEY=your_key
-e VITE_SILICONFLOW_API_KEY=your_key

# Multiple Custom Models Configuration (Unlimited Quantity)
-e VITE_CUSTOM_API_KEY_ollama=dummy_key
-e VITE_CUSTOM_API_BASE_URL_ollama=http://localhost:11434/v1
-e VITE_CUSTOM_API_MODEL_ollama=qwen2.5:7b
```

> 📖 **Detailed Configuration Guide**: See [Multiple Custom Models Documentation](./docs/user/multi-custom-models_en.md) for complete configuration methods and advanced usage

</details>

## Local Development
For detailed documentation, see [Development Documentation](docs/developer/development.md)

<details>
<summary>Click to view local development commands</summary>

```bash
# 1. Clone the project
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. Install dependencies
pnpm install

# 3. Start development server
pnpm dev               # Main development command: build core/ui and run web app
pnpm dev:web          # Run web app only
pnpm dev:fresh        # Complete reset and restart development environment
```
</details>

## 🗺️ Roadmap

- [x] Basic feature development
- [x] Web application release
- [x] Chrome extension release
- [x] Internationalization support
- [x] Support for system prompt optimization and user prompt optimization
- [x] Desktop application release
- [x] MCP service release
- [x] Advanced mode: Variable management, context testing, function calling
- [x] Image generation: Text-to-Image (T2I) and Image-to-Image (I2I) support
- [x] Prompt favorites and template management
- [ ] Support for workspace/project management

For detailed project status, see [Project Status Document](docs/project/project-status.md)

## 📖 Related Documentation

- [Documentation Index](docs/README.md) - Index of all documentation
- [Technical Development Guide](docs/developer/technical-development-guide.md) - Technology stack and development specifications
- [LLM Parameters Configuration Guide](docs/developer/llm-params-guide.md) - Detailed guide for advanced LLM parameter configuration
- [Project Structure](docs/developer/project-structure.md) - Detailed project structure description
- [Project Status](docs/project/project-status.md) - Current progress and plans
- [Product Requirements](docs/project/prd.md) - Product requirements document
- [Vercel Deployment Guide](docs/user/deployment/vercel_en.md) - Detailed instructions for Vercel deployment
- [Cloudflare Deployment Guide](docs/user/deployment/cloudflare-pages_en.md) - Web frontend deployment on Cloudflare Workers / Pages

## Star History

<a href="https://star-history.com/#linshenkx/prompt-optimizer&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=linshenkx/prompt-optimizer&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=linshenkx/prompt-optimizer&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=linshenkx/prompt-optimizer&type=Date" />
 </picture>
</a>

## FAQ

<details>
<summary>Click to view frequently asked questions</summary>

### API Connection Issues

#### Q1: Why can't I connect to the model service after configuring the API key?
**A**: Most connection failures are caused by **Cross-Origin Resource Sharing (CORS)** issues. As this project is a pure frontend application, browsers block direct access to API services from different origins for security reasons. Model services will reject direct requests from browsers if CORS policies are not correctly configured.

#### Q2: How to solve Ollama connection issues?
**A**: Ollama fully supports the OpenAI standard interface, just configure the correct CORS policy:
1. Set environment variable `OLLAMA_ORIGINS=*` to allow requests from any origin
2. If issues persist, set `OLLAMA_HOST=0.0.0.0:11434` to listen on any IP address

#### Q3: How to solve CORS issues with commercial APIs (such as Nvidia's DS API, ByteDance's Volcano API)?
**A**: These platforms typically have strict CORS restrictions. Recommended solutions:

1. **Use Desktop Application** (Most Recommended)
   - Desktop app has no CORS restrictions as a native application
   - Can directly connect to any API service, including locally deployed models
   - Provides the most complete and stable feature experience
   - Download from [GitHub Releases](https://github.com/linshenkx/prompt-optimizer/releases)

2. **Use Self-deployed API Proxy Service** (Professional solution)
   - Deploy open-source API aggregation/proxy tools like OneAPI, NewAPI
   - Configure as custom API endpoint in settings
   - Request flow: Browser → Proxy service → Model service provider
   - Full control over security policies and access permissions

**Note**: All web versions (including online version, Vercel deployment, Docker deployment) are pure frontend applications and subject to browser CORS restrictions. Only the desktop version or using an API proxy service can solve CORS issues.

#### Q4: I have correctly configured CORS policies for my local model (like Ollama), why can't I still connect using the online version?
**A**: This is caused by the browser's **Mixed Content security policy**. For security reasons, browsers block secure HTTPS pages (like the online version) from sending requests to insecure HTTP addresses (like your local Ollama service).

**Solutions**:
To bypass this limitation, you need to have the application and API under the same protocol (e.g., both HTTP). We recommend the following approaches:
1. **Use the desktop version**: Desktop applications have no browser restrictions and are the most stable and reliable way to connect to local models
2. **Use Docker deployment (HTTP)**: Access via `http://localhost:8081`, both the app and local Ollama use HTTP
3. **Use Chrome extension**: Extensions can bypass some security restrictions in certain situations

### macOS Desktop Application Issues

#### Q5: macOS shows "damaged" or "unverified developer" when opening the app?
**A**: This is because the application has not been signed with an Apple Developer certificate. Due to the high cost of Apple Developer accounts, the desktop application is currently unsigned.

**Solution**:
Run the following command in Terminal to remove the quarantine attribute:

```bash
# For installed applications
xattr -rd com.apple.quarantine "/Applications/GlobalCloud XiaoC.app"

# For downloaded .dmg files (run before installation)
xattr -rd com.apple.quarantine ~/Downloads/GlobalCloud\ XiaoC-*.dmg
```

After running the command, you can open the application normally.

</details>


## 🤝 Contributing

<details>
<summary>Click to view contribution guidelines</summary>

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Tip: When developing with Cursor tool, it is recommended to do the following before committing:
1. Use the "CodeReview" rule for review
2. Check according to the review report format:
   - Overall consistency of changes
   - Code quality and implementation method
   - Test coverage
   - Documentation completeness
3. Optimize based on review results before submitting

</details>

## 👏 Contributors

Thanks to all the developers who have contributed to this project!

<a href="https://github.com/linshenkx/prompt-optimizer/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=linshenkx/prompt-optimizer" alt="Contributors" />
</a>

## 🙏 Acknowledgements

This project was partly inspired by [LangGPT](https://github.com/langgptai/LangGPT) in prompt engineering and structured prompt design. Thanks to the LangGPT project and community for their open-source sharing and continued exploration.

## 📄 License

This project is licensed under [AGPL-3.0](LICENSE).

**In simple terms**: You can freely use, modify, and commercialize this project, but if you turn it into a website or service for others, you must share your source code.

<details>
<summary>👉 Click for detailed explanation</summary>

**What you can do:**
- ✅ Personal use, learning, and research
- ✅ Internal company use (not offering public services)
- ✅ Modify code for commercial projects
- ✅ Charge for products or services

**What you must do:**
- 📖 If distributing software or offering network services, disclose source code
- 📝 Preserve original author's copyright notices

**Core principle**: Commercial use is allowed, but not closed-source.

</details>

---

If this project is helpful to you, please consider giving it a Star ⭐️

## 👥 Contact Us

- Submit an Issue
- Create a Pull Request
- Join the discussion group 
