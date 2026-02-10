# MCP Server User Guide

Prompt Optimizer supports the Model Context Protocol (MCP), enabling integration with AI applications that support MCP such as Claude Desktop.

## 🎯 Features

- **optimize-user-prompt**: Optimize user prompts to improve LLM performance
- **optimize-system-prompt**: Optimize system prompts to improve LLM performance
- **iterate-prompt**: Iteratively improve mature prompts based on specific requirements

## 🚀 Quick Start

### Docker Deployment (Recommended)

Docker is the simplest deployment method, with both Web interface and MCP server starting together:

```bash
# Basic deployment
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name prompt-optimizer \
  linshen/prompt-optimizer

# Access URLs
# Web Interface: http://localhost:8081
# MCP Server: http://localhost:8081/mcp
```

### Developer Local Deployment

> **Note**: This method is only for developers for development and debugging. Regular users should use Docker deployment.

```bash
# 1. Clone the project
git clone https://github.com/your-repo/prompt-optimizer.git
cd prompt-optimizer

# 2. Install dependencies
pnpm install

# 3. Configure environment variables (copy and edit .env.local)
cp env.local.example .env.local

# 4. Start MCP server
pnpm mcp:dev
```

The server will start at `http://localhost:3000/mcp`. Developers can refer to the [Developer Documentation](../../packages/mcp-server/README.md) for more development-related information.

## ⚙️ Environment Variable Configuration

### API Key Configuration

At least one API key must be configured:

```bash
# Choose one or more API keys
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_DEEPSEEK_API_KEY=your-deepseek-key
VITE_SILICONFLOW_API_KEY=your-siliconflow-key
VITE_ZHIPU_API_KEY=your-zhipu-key

# Custom API (e.g., Ollama)
VITE_CUSTOM_API_KEY=your-custom-key
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=qwen2.5:0.5b
```

### MCP Server Configuration

```bash
# Preferred model provider (when multiple API keys are configured)
# Options: openai, gemini, anthropic, deepseek, siliconflow, zhipu, dashscope, openrouter, modelscope, custom
MCP_DEFAULT_MODEL_PROVIDER=openai

# Log level (optional, default: debug)
# Options: debug, info, warn, error
MCP_LOG_LEVEL=info

# HTTP port (optional, default: 3000, not needed for Docker deployment)
MCP_HTTP_PORT=3000

# Default language (optional, default: zh)
# Options: zh, en
MCP_DEFAULT_LANGUAGE=zh
```

## 🔗 Client Connections

### Claude Desktop Integration

#### 1. Find Configuration Directory

- **Windows**: `%APPDATA%\Claude\services`
- **macOS**: `~/Library/Application Support/Claude/services`
- **Linux**: `~/.config/Claude/services`

#### 2. Edit Configuration File

Create or edit the `services.json` file:

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

> **Note**: If you are using developer local deployment (port 3000), please change the URL to `http://localhost:3000/mcp`.



### Other MCP Clients

The MCP server supports the standard MCP protocol and can be used by any compatible client:

- **Connection URLs**:
  - Docker deployment: `http://localhost:8081/mcp`
  - Local deployment: `http://localhost:3000/mcp`
- **Protocol**: HTTP Streamable
- **Transport**: HTTP or stdio

## 🧪 Testing and Validation

### Using MCP Inspector

MCP Inspector is the official testing tool:

```bash
# 1. Start MCP server
pnpm mcp:dev

# 2. Start Inspector in another terminal
npx @modelcontextprotocol/inspector
```

In the Inspector Web UI:
1. Select transport method: `Streamable HTTP`
2. Server URL: `http://localhost:3000/mcp`
3. Click "Connect" to connect to the server
4. Test available tools

## 🔧 Troubleshooting

### Common Issues

#### 1. Server Startup Failure

**Error**: `Error: listen EADDRINUSE: address already in use`
**Solution**: Port is occupied, change port or stop the occupying process

```bash
# Check port usage
netstat -ano | findstr :3000

# Change port
MCP_HTTP_PORT=3001 pnpm mcp:dev
```

#### 2. Invalid API Key

**Error**: `No enabled models found`
**Solution**: Check API key configuration

```bash
# Ensure at least one valid API key is configured
echo $VITE_OPENAI_API_KEY
```

#### 3. Model Provider Mismatch

**Error**: Using wrong model
**Solution**: Check `MCP_DEFAULT_MODEL_PROVIDER` configuration

```bash
# Ensure provider name is correct
MCP_DEFAULT_MODEL_PROVIDER=openai  # not OpenAI
```

#### 4. Docker Deployment 401 Authentication Error

**Issue**: After enabling `ACCESS_PASSWORD` in Docker deployment, MCP Inspector connection fails with 401 error

**Cause**: When password protection is enabled in Docker deployment, Nginx enables Basic authentication for all routes, including the `/mcp` route

**Solutions**:
- **Fixed (v1.4.0+)**: The `/mcp` route is now configured to bypass Basic authentication
- **Workarounds for older versions**:
  1. Don't set the `ACCESS_PASSWORD` environment variable
  2. Use network isolation (e.g., internal network only)
  3. Expose port 3000 directly: `docker run -p 3000:3000 ...`

**Technical Details**:
- The MCP protocol itself doesn't support HTTP Basic authentication
- The new version adds `auth_basic off;` for the `/mcp` route in `docker/nginx.conf`
- Web application access remains password-protected

#### 5. Claude Desktop Connection Failure

**Solution Steps**:
1. Confirm MCP server is running
2. Check if URL is correct
3. Confirm firewall settings
4. Check Claude Desktop logs

### Debug Logging

Enable verbose logging:

```bash
# Development environment
MCP_LOG_LEVEL=debug pnpm mcp:dev

# Docker environment
docker run -e MCP_LOG_LEVEL=debug ...
```

## 📚 More Resources

- [MCP Official Documentation](https://modelcontextprotocol.io)
- [Developer Documentation](../../packages/mcp-server/README.md)
- [Project Homepage](../../README.md)

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section in this document
2. Check project Issues
3. Submit a new Issue describing the problem
4. Contact the development team
