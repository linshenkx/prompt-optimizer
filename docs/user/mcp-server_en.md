# MCP Server User Guide

Prompt Optimizer supports the Model Context Protocol (MCP), enabling integration with AI applications such as OpenCode and Claude Desktop.

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

Use Node.js 24.x and the repository's pnpm 10.6.1. Run these commands from the repository root. The built CLI can also run as a local stdio server for OpenCode.

```bash
# 1. Clone the project
git clone https://github.com/linshenkx/prompt-optimizer.git
cd prompt-optimizer

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Configure environment variables (copy and edit .env.local)
cp env.local.example .env.local

# 4. Build Core before the MCP server
pnpm build:core
pnpm mcp:build

# 5. Start the HTTP server (loads .env.local)
pnpm mcp:start
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

# Built-in template language (optional, default: en-US)
# Options: zh-CN, en-US; aliases zh and en are also accepted
MCP_DEFAULT_LANGUAGE=en-US
```

## 🔗 Client Connections

### OpenCode Integration

Merge one of the following configurations into `opencode.json` in your OpenCode project root, or `~/.config/opencode/opencode.json` for your user. OpenCode uses the top-level `mcp` field; see the [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/). Choose one transport.

#### Local stdio

Complete the installation and builds above, replace the path with your checkout's absolute path, and make `VITE_OPENAI_API_KEY` available in the environment that starts OpenCode:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "prompt_optimizer": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/prompt-optimizer/packages/mcp-server/bin/prompt-optimizer-mcp.cjs",
        "--transport=stdio"
      ],
      "environment": {
        "VITE_OPENAI_API_KEY": "{env:VITE_OPENAI_API_KEY}",
        "MCP_DEFAULT_MODEL_PROVIDER": "openai"
      },
      "enabled": true
    }
  }
}
```

OpenCode starts this process; a separate HTTP server is unnecessary. Use the CLI entry point to keep stdout reserved for MCP messages. `pnpm mcp:start` starts an HTTP server and is unsuitable for this `command`.

`{env:NAME}` is [OpenCode's environment substitution syntax](https://opencode.ai/docs/config/#env-vars); unset variables become empty strings. This example supplies model credentials explicitly and does not rely on OpenCode loading this checkout's `.env.local`. OpenCode's own model login and the MCP server's model credentials are configured separately. Never commit real keys in configuration files.

#### HTTP server

Start the server with Docker or `pnpm mcp:start`, then use:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "prompt_optimizer": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "oauth": false,
      "enabled": true
    }
  }
}
```

For the Docker example, use `http://localhost:8081/mcp`. `remote` selects an HTTP connection, including one to a local server. Configure model credentials on the server; `oauth: false` disables OpenCode's OAuth discovery and is unrelated to the model API key.

Run `opencode mcp list` from the OpenCode project to check connection status. Then try a prompt such as:

> Use prompt_optimizer's optimize-user-prompt to improve "Write a README for this TypeScript project". Return only the improved prompt.

OpenCode prefixes tool names with the server name, for example `prompt_optimizer_optimize-user-prompt`. The underlying MCP tool name remains `optimize-user-prompt`.

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

## Tool Inputs and Results

Use MCP `tools/list` to discover each tool's current `inputSchema`:

| Tool | Required arguments | Optional arguments |
| --- | --- | --- |
| `optimize-user-prompt` | `prompt` | `template` |
| `optimize-system-prompt` | `prompt` | `template` |
| `iterate-prompt` | `prompt`, `requirements` | `template` |

`prompt` must be a nonblank string of at most 50,000 characters; `requirements` must be a nonblank string of at most 10,000 characters. These limits are validated at runtime using JavaScript string `length`. Available `template` IDs, their `enum`, and the `default` are generated from the built-in templates. Read the schema returned by `tools/list` for that tool; omit `template` to use its default instead of hard-coding IDs from another version.

A successful result contains `content: [{ "type": "text", "text": "the optimized prompt" }]`. Tool execution errors return `isError: true` with explanatory text; check `isError` before using the result. The tools currently have no `outputSchema`, `structuredContent`, or token-streaming option. Streamable HTTP transport does not make tool results a token stream.

The caller saves and passes each result into the next call. This example assumes `client` is an already-connected MCP SDK `Client`:

```javascript
const optimized = await client.callTool({
  name: "optimize-user-prompt",
  arguments: { prompt: "Write a README for this TypeScript project" }
});
if (optimized.isError) throw new Error(JSON.stringify(optimized.content));
const prompt = optimized.content
  .filter(item => item.type === "text")
  .map(item => item.text)
  .join("\n");

const refined = await client.callTool({
  name: "iterate-prompt",
  arguments: { prompt, requirements: "Require installation steps and a minimal usage example" }
});
if (refined.isError) throw new Error(JSON.stringify(refined.content));
// Use the text in refined.content as the prompt for another iteration.
```

The service uses in-memory storage and does not automatically read model settings or optimization history saved in the Web/desktop app. Iteration does not implicitly select a previous result. This is separate from transport state: HTTP MCP creates a session and requires its session ID on subsequent requests, which the MCP SDK client handles.

## 🧪 Testing and Validation

### Local Protocol Smoke Tests

Run `pnpm mcp:test` from the repository root; the command builds Core and MCP first. The protocol tests use MCP SDK clients and a local mock provider to check stdio, HTTP, and tool calls without real API keys or paid models. They verify the transport and tool contract, not optimization quality.

The OpenCode configuration was checked against its official documentation. Protocol smoke tests are not OpenCode end-to-end tests; the validation environment did not have the OpenCode CLI installed.

### Using MCP Inspector

MCP Inspector is the official testing tool:

```bash
# 1. Start MCP server
pnpm mcp:start

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

---

**Last updated**: 2026-09-30
