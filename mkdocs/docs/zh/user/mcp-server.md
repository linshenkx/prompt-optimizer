# Docker MCP 服务

Docker 镜像同时提供 Web 页面和 `/mcp` 服务。客户端通过 Streamable HTTP 连接容器中的模型服务。[Docker 基础部署](../deployment/docker-basic.md)

## 当前提供的工具

当前可以确认 MCP 端暴露了 3 个工具：

- `optimize-user-prompt`
- `optimize-system-prompt`
- `iterate-prompt`

它们直接复用 Prompt Optimizer 的核心提示词处理能力。

### 工具分别适合什么

#### `optimize-user-prompt`

适合优化直接发给模型的任务型提示词。

主要输入：

- `prompt`
- 可选 `template`

#### `optimize-system-prompt`

适合优化角色设定、行为边界、规则约束这类 system prompt。

主要输入：

- `prompt`
- 可选 `template`

#### `iterate-prompt`

适合在已有提示词基础上，按具体问题继续改。

主要输入：

- `prompt`
- `requirements`
- 可选 `template`

## 启动 Docker 容器

```bash
docker run -d -p 8081:80 \
  -e VITE_OPENAI_API_KEY=your-openai-key \
  -e MCP_DEFAULT_MODEL_PROVIDER=openai \
  --name prompt-optimizer \
  linshen/prompt-optimizer
```

启动后：

- Web：`http://localhost:8081`
- MCP：`http://localhost:8081/mcp`

## MCP 默认模型是怎么选的

MCP 服务会从当前可用的文本模型里选择一个 `mcp-default` 作为工具调用的默认模型。

你可以通过两步控制它：

1. 先提供至少一个可用的文本模型环境变量
2. 再用 `MCP_DEFAULT_MODEL_PROVIDER` 指定优先 provider

例如：

```bash
VITE_OPENAI_API_KEY=...
VITE_GEMINI_API_KEY=...
VITE_DEEPSEEK_API_KEY=...
VITE_GROK_API_KEY=...
VITE_SILICONFLOW_API_KEY=...
VITE_ZHIPU_API_KEY=...
```

自定义 OpenAI 兼容接口：

```bash
VITE_CUSTOM_API_KEY=...
VITE_CUSTOM_API_BASE_URL=http://localhost:11434/v1
VITE_CUSTOM_API_MODEL=qwen2.5:7b
```

MCP 自身配置：

```bash
MCP_DEFAULT_MODEL_PROVIDER=openai
MCP_LOG_LEVEL=info
MCP_HTTP_PORT=3000
MCP_DEFAULT_LANGUAGE=zh
```

### `MCP_DEFAULT_MODEL_PROVIDER` 不是在做什么

它不是在“新建一套模型配置”。

它的作用只是：

- 当当前环境里有多个可用模型时，优先选哪个 provider 作为 `mcp-default`

如果没有命中，它会退回到“当前可用模型里的第一个”。

## 怎么验证 MCP 服务

推荐直接用 MCP Inspector：

```bash
npx @modelcontextprotocol/inspector
```

在 Inspector 中：

1. 选择 `Streamable HTTP`
2. 填入 `http://localhost:8081/mcp`
3. 连接后查看工具列表

### `curl /mcp` 能说明什么

`curl` 只能帮助你确认：

- 路由是不是通的
- 反向代理是不是把 `/mcp` 转发到了 MCP 服务

它**不能**完整模拟 MCP 的初始化握手和工具调用。

所以：

- 部署排障时，用 `curl` 看路由可达性是有意义的
- 真正验证协议和工具，还是优先用 MCP Inspector 或真实 MCP 客户端

## Docker + 密码保护时要注意什么

如果你在 Docker 部署里还设置了 `ACCESS_PASSWORD`，当前 Nginx 配置会让 `/mcp` 路由绕过 Web 密码页，这样 MCP 客户端才能正常连接。

也就是说：

- Web 页面仍可受密码保护
- `/mcp` 不应再被 Basic Auth 拦住

## 常见问题

### 连接不上 `/mcp`

优先检查：

1. 服务是否真的启动
2. 端口是否正确
3. 客户端是否支持 Streamable HTTP
4. 防火墙是否放行对应端口

### 工具报“默认模型未配置或未启用”

这通常说明：

- 当前环境里没有可用的文本模型
- 或者你指定的 `MCP_DEFAULT_MODEL_PROVIDER` 没有匹配到可用模型

最稳的做法是先保证至少一套文本模型环境变量可用，再决定要不要指定默认 provider。

### 端口被占用

将 Docker 宿主机端口改为可用端口，例如 `-p 8082:80`，并将客户端地址改为 `http://localhost:8082/mcp`。

## 相关页面

- [Web 版部署](../deployment/web.md)
- [Docker 基础部署](../deployment/docker-basic.md)
- [Docker 高级配置](../deployment/docker-advanced.md)
- [连接问题](../help/connection-issues.md)
