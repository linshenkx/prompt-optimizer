# Docker 基础部署

Docker 版最值得先记住的一句话：

**它默认把 Web 页面和 MCP 服务一起打包起来。**

容器里的实际结构是：

- Nginx 提供前端页面
- MCP Server 在容器内监听 `3000`
- Nginx 把外部访问的 `/mcp` 代理到容器内的 MCP Server

所以外部通常只需要记住一个端口：

- `/` 是 Web 页面
- `/mcp` 是 MCP 服务

## 什么时候适合用 Docker

适合：

- 想在本机、局域网或服务器里自托管
- 想一次起 Web 页面和 MCP
- 想保留仓库默认的 Nginx + MCP 组合结构

不适合：

- 只想部署纯前端静态站
- 只想单独跑 MCP 而不需要 Web 页面

对应文档：

- 只要前端页面：看 [Web 版部署](web.md)
- 只要 MCP：看 [MCP 服务器](../user/mcp-server.md)

## 最简单的启动方式

直接运行官方镜像：

```bash
docker run -d -p 8081:80 --restart unless-stopped --name globalcloud-xiaoc \
  linshen/prompt-optimizer:latest
```

启动后访问：

- Web：`http://localhost:8081`
- MCP：`http://localhost:8081/mcp`

## 使用仓库自带的 Docker Compose

仓库 `docker/` 目录已经带了 `docker-compose.yml`。如果你在仓库根目录放了 `.env`，需要在命令里显式传入：

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

默认端口映射是：

```text
28081:${NGINX_PORT:-80}
```

也就是默认访问：

- Web：`http://localhost:28081`
- MCP：`http://localhost:28081/mcp`

常用命令：

```bash
docker compose --env-file .env -f docker/docker-compose.yml logs -f
docker compose --env-file .env -f docker/docker-compose.yml down
```

## 开发用 Compose

如果你要基于本地源码构建，可以使用：

```bash
docker compose -f docker/docker-compose.dev.yml up -d --build
```

这个文件的特点是：

- 从当前源码构建镜像
- 读取 `.env.local`
- 自动加入 `host.docker.internal:host-gateway`

默认端口映射是：

- Web：`http://localhost:28082`
- MCP：`http://localhost:28082/mcp`

## 最常用的环境变量

### 1. 文本模型和自定义接口

容器启动时会把所有 `VITE_*` 环境变量写进运行时的 `config.js`，前端页面会直接读取它们。

常见示例：

```bash
-e VITE_OPENAI_API_KEY=your_openai_key
-e VITE_GEMINI_API_KEY=your_gemini_key
-e VITE_DEEPSEEK_API_KEY=your_deepseek_key
-e VITE_GROK_API_KEY=your_xai_key
-e VITE_SILICONFLOW_API_KEY=your_siliconflow_key
```

自定义 OpenAI 兼容接口：

```bash
-e VITE_CUSTOM_API_KEY=your_key
-e VITE_CUSTOM_API_BASE_URL=https://api.example.com/v1
-e VITE_CUSTOM_API_MODEL=your-model-name
```

### 2. MCP 默认配置

```bash
-e MCP_LOG_LEVEL=debug
-e MCP_DEFAULT_LANGUAGE=zh
-e MCP_DEFAULT_MODEL_PROVIDER=openai
```

### 3. 页面访问密码

```bash
-e ACCESS_USERNAME=admin
-e ACCESS_PASSWORD=your_password
```

需要注意：

- 只要设置了 `ACCESS_PASSWORD`，Web 页面就会启用 Basic 认证
- `/mcp` 路径默认会绕过这层认证，便于 MCP 客户端直接访问

## 如何验证容器是否正常

最直接的检查方法：

```bash
curl http://localhost:8081/
curl http://localhost:8081/mcp
```

如果你使用的是仓库自带 compose，则把 `8081` 换成 `28081`。

要注意：

- `curl /` 可以确认 Web 页面可达
- `curl /mcp` 只能确认路由和反代链路可达
- 它不能完整模拟 MCP 初始化握手和工具调用

如果你要验证 MCP 协议本身，继续看 [MCP 服务器](../user/mcp-server.md)。

## Docker 版最容易误解的地方

### “用了 Docker，就没有浏览器限制了”

不完全对。

Docker 只是把 Web 页面和 MCP 打包部署起来。前端页面本身仍然运行在浏览器里，所以：

- 浏览器侧的 CORS / Mixed Content 语义不会凭空消失
- 如果前端要访问宿主机上的模型服务，仍然要处理地址和网络可达性

### “Docker 版只能对外暴露 Web”

不是。它默认也对外暴露 `/mcp`，只是路径和 Web 共用同一个端口。

## 下一步看哪里

- 需要更多运行时配置：看 [Docker 高级配置](docker-advanced.md)
- 要排查容器问题：看 [Docker 故障排除](docker-troubleshooting.md)
- 要理解 `/mcp` 的协议和启动方式：看 [MCP 服务器](../user/mcp-server.md)
