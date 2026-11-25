# Docker MCP 使用指南

Prompt Optimizer 的 Docker 镜像提供 `/mcp` 服务。客户端通过 Streamable HTTP 连接，模型由容器环境变量配置。

## 🎯 功能特性

- **optimize-user-prompt**: 优化用户提示词以提升 LLM 性能
- **optimize-system-prompt**: 优化系统提示词以提升 LLM 性能
- **iterate-prompt**: 基于特定需求迭代改进成熟的提示词

## 🚀 快速开始

### 启动容器

以下命令同时启动 Web 界面和 MCP 服务。

```bash
# 基本部署
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name prompt-optimizer \
  linshen/prompt-optimizer

# 访问地址
# Web 界面：http://localhost:8081
# MCP 服务器：http://localhost:8081/mcp
```

## ⚙️ 环境变量配置

### API 密钥配置

至少需要配置一个 API 密钥：

```bash
# 选择一个或多个 API 密钥
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_DEEPSEEK_API_KEY=your-deepseek-key
VITE_GROK_API_KEY=your-xai-key
VITE_SILICONFLOW_API_KEY=your-siliconflow-key
VITE_ZHIPU_API_KEY=your-zhipu-key

# 自定义 API（如 Ollama）
VITE_CUSTOM_API_KEY=your-custom-key
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=qwen2.5:0.5b
```

### MCP 服务器配置

```bash
# 首选模型提供商（当配置了多个 API 密钥时）
# 可选值：openai, gemini, anthropic, deepseek, grok, siliconflow, zhipu, dashscope, openrouter, modelscope, custom
MCP_DEFAULT_MODEL_PROVIDER=openai

# 日志级别（可选，默认 debug）
# 可选值：debug, info, warn, error
MCP_LOG_LEVEL=info

# HTTP 端口（可选，默认 3000，Docker 部署时无需设置）
MCP_HTTP_PORT=3000

# 默认语言（可选，默认 zh）
# 可选值：zh, en
MCP_DEFAULT_LANGUAGE=zh
```

## 🔗 客户端连接

在支持 Streamable HTTP 的客户端添加服务地址。按上例在本机部署时，填 `http://localhost:8081/mcp`。远程部署时，填写客户端可访问的 HTTPS 地址并保留 `/mcp` 路径。使用 Claude 远程连接器可参阅[官方配置说明](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)。

## 🧪 测试与验证

### 使用 MCP Inspector

MCP Inspector 是官方提供的测试工具：

```bash
npx @modelcontextprotocol/inspector
```

在 Inspector Web UI 中：
1. 选择传输方式：`Streamable HTTP`
2. 服务器 URL：`http://localhost:8081/mcp`
3. 点击 "Connect" 连接服务器
4. 测试可用的工具

## 🔧 故障排除

### 常见问题

#### 1. 服务器启动失败

**错误**: `Error: listen EADDRINUSE: address already in use`
如果宿主机的 8081 端口已被占用，使用其他端口映射，例如 `-p 8082:80`，并把客户端地址改为 `http://localhost:8082/mcp`。

#### 2. API 密钥无效

**错误**: `No enabled models found`
**解决**: 检查 API 密钥配置

```bash
# 确保至少配置一个有效的 API 密钥
echo $VITE_OPENAI_API_KEY
```

#### 3. 模型提供商不匹配

**错误**: 使用了错误的模型
**解决**: 检查 `MCP_DEFAULT_MODEL_PROVIDER` 配置

```bash
# 确保提供商名称正确
MCP_DEFAULT_MODEL_PROVIDER=openai  # 不是 OpenAI
```

#### 4. Docker 部署时 401 认证错误

**问题**: 使用 Docker 部署并启用了 `ACCESS_PASSWORD` 后，MCP Inspector 连接失败，返回 401 错误

**原因**: Docker 部署启用密码保护后，Nginx 会对所有路由启用 Basic 认证，包括 `/mcp` 路由

**解决方案**:
- **已修复（v1.4.0+）**：`/mcp` 路由已配置为绕过 Basic 认证
- **旧版本临时方案**：
  1. 不设置 `ACCESS_PASSWORD` 环境变量
  2. 或使用网络隔离（如仅在内网使用）
  3. 或直接暴露 3000 端口：`docker run -p 3000:3000 ...`

**技术说明**:
- MCP 协议本身不支持 HTTP Basic 认证
- 新版本在 `docker/nginx.conf` 中为 `/mcp` 路由添加了 `auth_basic off;`
- Web 应用访问仍然受密码保护

### 日志调试

使用 `docker logs prompt-optimizer` 查看容器启动日志。

## 📚 更多资源

- [MCP 官方文档](https://modelcontextprotocol.io)
- [Docker MCP 部署说明](../deployment/docker-mcp-integration.md)
- [项目主页](../../README.md)

## 🆘 获取帮助

如果遇到问题：

1. 查看本文档的故障排除部分
2. 检查项目 Issues
3. 提交新的 Issue 描述问题
4. 联系开发团队
