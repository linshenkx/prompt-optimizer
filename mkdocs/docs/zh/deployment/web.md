# Web 版部署

先一句话说明它的定位：

**Web 版只是前端页面，不是模型代理层。**

无论你使用官方在线站还是自己部署静态站，模型请求都会由浏览器直接发往模型服务。

## 它和 Docker、MCP 是什么关系

这三者很容易混淆，可以先按下面理解：

| 方式 | 你会得到什么 | 适合什么 |
| --- | --- | --- |
| Web 版 | 一个可访问的前端页面 | 在线使用、静态托管 |
| Docker | Web 页面 + 容器内 `/mcp` 服务 | 自托管、局域网部署 |
| 独立 MCP | 只有 MCP 服务，不带 Web 页面 | 接入 MCP 客户端 |

如果你想一次起 Web 和 MCP，优先看 [Docker 基础部署](docker-basic.md)。

如果你只关心 MCP 接入方式，直接看 [MCP 服务器](../user/mcp-server.md)。

## 什么时候适合用 Web 版

适合：

- 主要连接公开 HTTPS 模型 API
- 想快速上线一个可访问的前端站点
- 不需要访问 `http://localhost` 之类的本地接口

不太适合：

- 主要连接 Ollama、LM Studio、本地网关
- 需要访问企业内网且跨域策略严格的 API
- 想靠“前端部署”来绕过浏览器限制

## 最简单的 2 种用法

### 1. 直接使用官方在线站

地址：<https://prompt.always200.com>

这是最省事的方式，但浏览器限制依然存在：

- 数据默认保存在当前浏览器本地
- 请求会直接发送给你配置的模型服务
- 如果模型服务不允许浏览器跨域访问，在线站同样无法绕过

### 2. 自己部署静态站

仓库根目录提供了 `vercel.json`，可以直接部署到 Vercel。

如果你不使用 Vercel，也可以把构建产物部署到任意静态托管平台。

## 部署到 Vercel

推荐流程：

1. Fork 本仓库
2. 在 Vercel 中导入该仓库
3. 保持仓库根目录为项目根目录
4. 配置环境变量
5. 部署

### 环境变量安全

不要在公开 Web 站点中预置模型 API Key。`VITE_*` 变量会进入前端构建产物，访问者可以在浏览器下载到这些值。公开站点应让用户在应用界面的模型管理中自行填写自己的 API Key。

只有在受控的私有部署中，才考虑预置 `VITE_*` 模型配置；同时应配合访问控制，并使用可轮换、权限受限、费用受控的密钥。

### 可选：站点密码保护

如果你在 Vercel 上设置：

```bash
ACCESS_PASSWORD=your_password
```

站点会先显示密码页。对应逻辑由根目录的 `middleware.js` 和 `api/auth.js` 提供。

## 部署到 Cloudflare

公开仓库用户可以优先使用 Cloudflare 官方的一键部署按钮：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/linshenkx/prompt-optimizer)

这个流程会把源仓库克隆到你的 GitHub/GitLab 账号下，并使用 Workers Builds 创建和部署 Worker。仓库根目录的 `wrangler.jsonc` 会配置 Web 前端构建命令，把 `packages/web/dist` 配置为 Workers Static Assets 的静态资源目录，并为单页应用启用 `index.html` 回退。

需要注意：

- Deploy to Cloudflare 按钮要求源仓库是公开的 GitHub/GitLab 仓库。
- 如果你想使用私有仓库，或想手动限制 Cloudflare GitHub App 只访问指定仓库，请使用下面的手动导入方式。

### 手动导入仓库

手动导入适合私有仓库、组织仓库、需要精细控制 GitHub App 权限，或一键部署按钮失败的场景。当前 Cloudflare Dashboard 可能会进入 **Workers Static Assets** 流程；如果界面显示“创建 Worker”“部署命令 `npx wrangler deploy`”，请使用 Workers 配置。

1. Fork 本仓库
2. 在 Cloudflare Dashboard 中进入 **Workers & Pages**
3. 选择通过 GitHub/Git 仓库创建应用
4. 选择你 fork 后的 `globalcloud-xiaoc` 仓库
5. 如果界面显示“创建 Worker”，大多数配置保持默认：

| 配置项 | 推荐值 |
| --- | --- |
| Worker name | 如果自动填入 `globalcloud-xiaoc`，保持不变；否则改成 `globalcloud-xiaoc` |
| Root directory / Path | 保持默认，通常是 `/` 或留空 |
| Build command | 清空；如果自动填入 `pnpm run build`，请删除。`wrangler.jsonc` 已配置构建命令 |
| Deploy command | 保持默认 `npx wrangler deploy` |
| Non-production branch deploy command | 保持默认 `npx wrangler versions upload` |

如果部署日志出现 `The Wrangler application detection logic has been run in the root of a workspace`，说明 Wrangler 没有读到项目根目录的 `wrangler.jsonc`，于是尝试在 monorepo 根目录自动识别应用。请确认当前部署的提交已经包含 `wrangler.jsonc`；如果仍然报错，再把部署命令改成 `npx wrangler deploy --config wrangler.jsonc`，把非生产分支部署命令改成 `npx wrangler versions upload --config wrangler.jsonc`。

如果你的 Cloudflare Dashboard 仍然显示 **Create application** -> **Pages** -> **Connect to Git**，也可以继续使用 Pages 表单：

| 配置项 | 推荐值 |
| --- | --- |
| Framework preset | `None` 或留空 |
| Root directory | `/` 或留空 |
| Build command | `pnpm -F @prompt-optimizer/core build && pnpm -F @prompt-optimizer/ui build && pnpm -F @prompt-optimizer/web build` |
| Build output directory | `packages/web/dist` |

通常不需要手动配置构建环境变量。Cloudflare 会根据仓库里的 `packageManager` 和 `engines` 检测 `pnpm` 和 Node.js 版本。

如果 Cloudflare 检测到的版本不正确，再在构建环境变量中设置：

```bash
NODE_VERSION=22
PNPM_VERSION=10.6.1
```

不要在公开 Cloudflare 站点中预置模型 API Key。所有 `VITE_*` 变量都会进入前端构建产物，访问者可以在浏览器下载到这些值。公开站点应让用户在应用界面的模型管理中自行填写自己的 API Key。

只有在受控的私有部署中，才考虑预置 `VITE_*` 模型配置；同时应配合 Cloudflare Access，并使用可轮换、权限受限、费用受控的密钥。

### 可选：Cloudflare Access 和 Web Analytics

Cloudflare 部署不会使用 Vercel 的 `ACCESS_PASSWORD`、`middleware.js` 或 `/api/auth`。如果你需要限制访问，推荐在 Cloudflare Zero Trust 中为 Workers 或 Pages 域名配置 Cloudflare Access。

Cloudflare Web Analytics 可以在 Cloudflare 控制台启用，不需要安装 `@vercel/analytics` 之类的前端依赖。

!!! note
    当前 Web 版使用 hash 路由。Cloudflare Web Analytics 可以统计站点访问和性能数据，但不会自动把 `/#/xxx` 这类 hash 内页面切换当作独立页面浏览。

## 部署到其他静态托管

本地构建：

```bash
pnpm install
pnpm build
```

构建完成后，Web 前端产物位于：

```text
packages/web/dist
```

把这个目录部署到 Nginx、OSS、S3、Cloudflare Pages 或其他静态托管平台即可。

!!! note
    如果你不用 Vercel，自行部署静态文件时，`ACCESS_PASSWORD` 密码页和 `/api/auth` 不会自动存在；那是 Vercel 方案里的能力。

## Web 版最大的限制在哪里

问题通常不在“页面能不能打开”，而在“浏览器能不能连上模型服务”。

### CORS

如果模型服务没有返回允许浏览器跨域的响应头，Web 版会直接失败。

### Mixed Content

如果你的站点是 `https://...`，但模型接口是 `http://localhost:...`，浏览器通常会拦截。

### 企业网络策略

如果公司网络拦截未知 API 域名、限制自签名证书或要求代理，前端站点本身并不能自动解决这些问题。

## 什么时候该改用别的方案

如果你遇到下面这些需求，通常应该换到别的方式：

- 连接 Ollama / LM Studio：优先 [桌面应用](desktop.md)
- 连接局域网 HTTP 接口：优先 [桌面应用](desktop.md)
- 想同时提供 Web 和 MCP：优先 [Docker 基础部署](docker-basic.md)
- 只想对外提供 MCP：看 [MCP 服务器](../user/mcp-server.md)

## 相关页面

- [桌面应用](desktop.md)
- [Docker 基础部署](docker-basic.md)
- [MCP 服务器](../user/mcp-server.md)
- [连接问题](../help/connection-issues.md)
