# Docker 高级配置

这一页只讨论当前仓库已经真实提供的 Docker 高级用法，不扩展到仓库里没有交付的整套基础设施方案。

如果你还没跑起来，先看 [Docker 基础部署](docker-basic.md)。

## 先确认容器里的真实结构

从当前仓库的 `Dockerfile` 和 Nginx 配置看，镜像会做这些事：

1. 构建前端页面
2. 构建 `packages/mcp-server`
3. 用 Nginx 托管前端
4. 用 `supervisord` 同时启动 Nginx 和 MCP Server
5. 用容器内 Nginx 把 `/mcp` 代理到 MCP Server 的 `3000`

所以 Docker 高级配置的重点，主要是：

- 运行时环境变量注入
- Basic 认证
- 容器访问宿主机服务
- `/mcp` 的反向代理链路

## 运行时环境变量是怎么生效的

容器启动时，`docker/generate-config.sh` 会扫描所有 `VITE_*` 环境变量，并把它们写入：

```text
/usr/share/nginx/html/config.js
```

这意味着：

- 前端不是在镜像构建时固定配置，而是在容器启动时注入
- 修改 `VITE_*` 后，需要重启容器
- 只要变量名是 `VITE_*`，就会进入运行时配置

## 怎么接自定义 OpenAI 兼容服务

如果你要把自建或第三方 OpenAI 兼容接口放进 Docker 运行环境，可以直接传环境变量：

```bash
docker run -d -p 8081:80 --restart unless-stopped --name globalcloud-xiaoc \
  -e VITE_CUSTOM_API_KEY=your_key \
  -e VITE_CUSTOM_API_BASE_URL=https://api.example.com/v1 \
  -e VITE_CUSTOM_API_MODEL=your-model \
  linshen/prompt-optimizer:latest
```

如果你还需要附加请求字段，建议继续使用项目里支持的 `VITE_*` 配置方式，把额外参数也写入运行时配置。

## 容器访问宿主机服务

当你的模型服务跑在宿主机，例如：

- 本地 Ollama
- LM Studio
- 本地代理或网关

容器里通常不能直接用 `localhost` 访问宿主机。

更稳的做法是：

- 在开发 Compose 中使用已经内置的 `host.docker.internal:host-gateway`
- 或者你自己在运行时补上对应 host 映射

示例：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

然后把 Base URL 指向：

```text
http://host.docker.internal:11434/v1
```

## Basic 认证和 `/mcp`

容器内的 `generate-auth.sh` 会根据 `ACCESS_PASSWORD` 决定是否启用 Basic 认证。

需要特别注意：

- Web 首页会读取认证配置
- `/mcp` 路径在 Nginx 里显式写了 `auth_basic off;`

这样做的目的是：

- 浏览器访问页面时可以受保护
- MCP 客户端访问 `/mcp` 时不被网页认证拦住

如果你在容器外层再挂一层自己的反向代理，也要保留这条语义，否则 `/mcp` 可能再次被拦住。

## 外层再套一层反向代理时怎么配

当前仓库已经在容器内有一层 Nginx，所以外部再加 Caddy、Traefik 或宿主机 Nginx 时，建议只做这几件事：

- 把根路径反代到容器的 Web 端口
- 把 `/mcp` 也原样转发到同一个容器端口
- 不要在外层把 `/mcp` 改写到别的路径
- 如果外层还启用了认证，确认不会误伤 `/mcp`

## 调整端口和镜像

### 改对外端口

容器内部默认使用 `80`，对外端口你可以自己映射：

```bash
docker run -d -p 3000:80 --name globalcloud-xiaoc linshen/prompt-optimizer:latest
```

### 从源码构建镜像

如果你不是直接用 Docker Hub 镜像，而是要在本地构建：

```bash
docker build -t globalcloud-xiaoc:local .
docker run -d -p 8081:80 --name globalcloud-xiaoc-local globalcloud-xiaoc:local
```

## 更适合放进 `.env.local` 的内容

如果你长期在本地开发，建议把这类变量放进 `.env.local`，再配合 `docker/docker-compose.dev.yml`：

- 各种 `VITE_*` 模型配置
- `ACCESS_USERNAME`
- `ACCESS_PASSWORD`
- `MCP_LOG_LEVEL`
- `MCP_DEFAULT_LANGUAGE`
- `MCP_DEFAULT_MODEL_PROVIDER`

## 什么时候该换文档去看

- 还没跑起来：看 [Docker 基础部署](docker-basic.md)
- 只是想用前端页面：看 [Web 版部署](web.md)
- 只是想独立使用 MCP：看 [MCP 服务器](../user/mcp-server.md)
- 容器启动但访问异常：看 [Docker 故障排除](docker-troubleshooting.md)
