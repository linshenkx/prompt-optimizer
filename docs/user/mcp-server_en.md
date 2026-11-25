# Docker MCP Server Guide

The Prompt Optimizer Docker image serves MCP at `/mcp`. Clients connect using Streamable HTTP. Set the model credentials in the container environment.

## 🎯 Features

- **optimize-user-prompt**: Optimize user prompts to improve LLM performance
- **optimize-system-prompt**: Optimize system prompts to improve LLM performance
- **iterate-prompt**: Iteratively improve mature prompts based on specific requirements

## 🚀 Quick Start

### Start the container

This command starts the web interface and the MCP service.

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

## ⚙️ Environment Variable Configuration

### API Key Configuration

At least one API key must be configured:

```bash
# Choose one or more API keys
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_DEEPSEEK_API_KEY=your-deepseek-key
VITE_GROK_API_KEY=your-xai-key
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
# Options: openai, gemini, anthropic, deepseek, grok, siliconflow, zhipu, dashscope, openrouter, modelscope, custom
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

In a client that supports Streamable HTTP, enter `http://localhost:8081/mcp` for the local deployment above. For a remote deployment, use its reachable HTTPS URL with the same `/mcp` path. To connect from Claude, see the [remote connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## 🧪 Testing and Validation

### Using MCP Inspector

MCP Inspector is the official testing tool:

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector Web UI:
1. Select transport method: `Streamable HTTP`
2. Server URL: `http://localhost:8081/mcp`
3. Click "Connect" to connect to the server
4. Test available tools

## 🔧 Troubleshooting

### Common Issues

#### 1. Server Startup Failure

**Error**: `Error: listen EADDRINUSE: address already in use`
If host port 8081 is busy, use another mapping such as `-p 8082:80` and set the client URL to `http://localhost:8082/mcp`.

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

### Logs

Run `docker logs prompt-optimizer` to read the container startup log.

## 📚 More Resources

- [MCP Official Documentation](https://modelcontextprotocol.io)
- [Docker MCP deployment](../deployment/docker-mcp-integration.md)
- [Project Homepage](../../README.md)

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section in this document
2. Check project Issues
3. Submit a new Issue describing the problem
4. Contact the development team
