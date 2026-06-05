# Docker 故障排除

这页只覆盖当前仓库 Docker 方案里最常见、最真实的问题。

如果你还没看过部署结构，先回到：

- [Docker 基础部署](docker-basic.md)
- [Docker 高级配置](docker-advanced.md)

## 先确认你用的是哪种启动方式

排查前先分清：

- `docker run -p 8081:80 ...`
- `docker compose --env-file .env -f docker/docker-compose.yml up -d` 使用仓库自带 Compose 配置
- `docker compose -f docker/docker-compose.dev.yml up -d --build`

因为三种方式默认端口不一样，很多“服务打不开”其实只是看错了端口。

## 最实用的最小排查顺序

建议先按这个顺序来：

1. `docker ps -a`
2. `docker logs globalcloud-xiaoc`
3. `curl http://localhost:<你的端口>/`
4. `curl http://localhost:<你的端口>/mcp`
5. `docker exec -it globalcloud-xiaoc cat /usr/share/nginx/html/config.js`

大多数问题到这一步就能定位。

## 常见问题 1：页面打不开

先看容器是不是起来了：

```bash
docker ps -a
docker logs globalcloud-xiaoc
```

如果你用的是仓库自带 compose，再看：

```bash
docker compose --env-file .env -f docker/docker-compose.yml ps
docker compose --env-file .env -f docker/docker-compose.yml logs -f
```

常见原因：

- 端口映射看错了
- 容器启动失败
- 外层端口被别的程序占用

端口对应关系：

- `docker run -p 8081:80` 对外一般是 `8081`
- `docker/docker-compose.yml` 默认是 `28081`
- `docker/docker-compose.dev.yml` 默认是 `28082`

## 常见问题 2：`/mcp` 访问失败

先直接测：

```bash
curl http://localhost:8081/mcp
```

如果你使用 compose，就把端口换成 `28081` 或 `28082`。

这一路的真实链路是：

- 外部访问容器端口
- 容器内 Nginx 收到 `/mcp`
- Nginx 代理到容器内 `localhost:3000`

所以任何一环有问题，`/mcp` 都会失败。

要注意：

- `curl /mcp` 只能证明路由和反代链路可达
- 它不能完整模拟 MCP 初始化握手和工具调用

如果你要验证 MCP 协议本身，继续看 [MCP 服务器](../user/mcp-server.md)。

## 常见问题 3：配了环境变量，但页面里没生效

当前 Docker 方案不是在构建时把配置写死，而是在启动时动态生成：

```text
/usr/share/nginx/html/config.js
```

可以直接检查：

```bash
docker exec -it globalcloud-xiaoc cat /usr/share/nginx/html/config.js
```

常见原因：

- 改了 `VITE_*` 变量，但没有重启容器
- 变量名没写成 `VITE_*`
- 用的是 compose，但 `.env.local` 或 shell 环境没有真正传进去

## 常见问题 4：Basic 认证挡住了页面

如果你设置了：

```text
ACCESS_PASSWORD
```

容器会自动启用 Basic 认证。

可以检查生成结果：

```bash
docker exec -it globalcloud-xiaoc cat /etc/nginx/conf.d/auth.conf
```

如果你不想启用这层认证，去掉 `ACCESS_PASSWORD` 后重启容器即可。

## 常见问题 5：自定义模型访问不到宿主机服务

这是 Docker 里最常见的问题之一。

错误写法通常是：

```text
http://localhost:11434/v1
```

因为在容器里，`localhost` 指向的是容器自己，不是宿主机。

更合适的做法：

```text
http://host.docker.internal:11434/v1
```

如果你使用 `docker/docker-compose.dev.yml`，仓库已经帮你加了：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## 常见问题 6：修改了配置却感觉还是旧的

通常先检查三件事：

1. 是否真的重启了容器
2. 是否连到正确端口
3. 浏览器是否还缓存着旧页面

可以按这个顺序试：

```bash
docker compose --env-file .env -f docker/docker-compose.yml down
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

或者：

```bash
docker restart globalcloud-xiaoc
```

然后浏览器强制刷新。

## 常见问题 7：想确认容器里 MCP 进程有没有起来

当前镜像使用 `supervisord` 同时拉起 Nginx 和 MCP Server。

可以检查：

```bash
docker logs globalcloud-xiaoc
docker exec -it globalcloud-xiaoc sh
ps aux
cat /etc/supervisor/conf.d/supervisord.conf
```

## 相关页面

- [Docker 基础部署](docker-basic.md)
- [Docker 高级配置](docker-advanced.md)
- [MCP 服务器](../user/mcp-server.md)
