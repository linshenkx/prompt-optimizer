## Cloudflare 部署说明

Cloudflare 适合部署 GlobalCloud XiaoC 的 **Web 前端**。当前 Cloudflare Dashboard 可能会把 GitHub 仓库导入到 **Workers Static Assets** 流程，而不是旧版 **Pages** 表单。两种方式都能部署静态前端，但如果你的界面出现“创建 Worker”“部署命令 `npx wrangler deploy`”，请优先按下面的 Workers 流程配置。

### 推荐方式：一键部署

公开仓库用户可以优先使用 Cloudflare 官方的一键部署按钮：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/linshenkx/prompt-optimizer)

这个流程会把源仓库克隆到你的 GitHub/GitLab 账号下，并使用 Workers Builds 创建和部署 Worker。仓库根目录已经包含 `wrangler.jsonc`，用于告诉 Cloudflare Workers 如何构建 Web 前端、发布 `packages/web/dist` 静态资源，并为单页应用启用 `index.html` 回退。

需要注意：

- Deploy to Cloudflare 按钮要求源仓库是公开的 GitHub/GitLab 仓库。
- 如果你想使用私有仓库，或想手动限制 Cloudflare GitHub App 只访问指定仓库，请使用下面的手动导入方式。

### 备选方式：手动导入仓库

手动导入适合私有仓库、组织仓库、需要精细控制 GitHub App 权限，或一键部署按钮失败的场景。

1. **Fork 项目到自己的 GitHub**
   - 访问 [prompt-optimizer 项目](https://github.com/linshenkx/prompt-optimizer)
   - 点击右上角的 "Fork"
   - 完成后，你会在自己的 GitHub 账号下拥有一份仓库副本

2. **在 Cloudflare 中导入仓库**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 **Workers & Pages**
   - 选择通过 GitHub/Git 仓库创建应用
   - 选择你 fork 后的 `globalcloud-xiaoc` 仓库

3. **确认 Worker 设置**

   如果界面显示“创建 Worker”，大多数配置可以保持默认。Worker 名称需要和根目录 `wrangler.jsonc` 中的 `name` 保持一致。

   | 配置项 | 推荐值 |
   | --- | --- |
   | Worker name | 如果自动填入 `globalcloud-xiaoc`，保持不变；否则改成 `globalcloud-xiaoc` |
   | Root directory / Path | 保持默认，通常是 `/` 或留空 |
   | Build command | 清空；如果自动填入 `pnpm run build`，请删除。`wrangler.jsonc` 已配置构建命令 |
   | Deploy command | 保持默认 `npx wrangler deploy` |
   | Non-production branch deploy command | 保持默认 `npx wrangler versions upload` |

4. **环境变量**

   通常不需要手动配置构建环境变量。Cloudflare 会根据仓库里的 `packageManager` 和 `engines` 检测 `pnpm` 和 Node.js 版本。

   如果 Cloudflare 检测到的版本不正确，再在项目的构建环境变量中添加：

   ```bash
   NODE_VERSION=22
   PNPM_VERSION=10.6.1
   ```

   不要在公开 Cloudflare 站点中预置模型 API Key。所有 `VITE_*` 变量都会进入前端构建产物，访问者可以在浏览器下载到这些值。公开站点应让用户在应用界面的模型管理中自行填写自己的 API Key。

   只有在受控的私有部署中，才考虑预置 `VITE_*` 模型配置；同时应配合 Cloudflare Access，并使用可轮换、权限受限、费用受控的密钥。

5. **部署**
   - 保存配置并开始部署
   - 部署成功后，Cloudflare Workers 会提供一个 `*.workers.dev` 域名；你也可以后续绑定自定义域名
   - 后续你的 fork 有新 commit 时，Cloudflare 会自动重新构建并部署

6. **同步上游更新**
   - 在 GitHub 打开你 fork 的仓库
   - 当页面提示落后于 `linshenkx/prompt-optimizer` 时，点击 **Sync fork**
   - 同步产生新 commit 后，Cloudflare 会自动重新部署

### 备选方式：旧版 Cloudflare Pages 表单

如果你的 Cloudflare Dashboard 仍然显示 **Create application** -> **Pages** -> **Connect to Git**，也可以继续用 Pages 表单：

| 配置项 | 推荐值 |
| --- | --- |
| Framework preset | `None` 或留空 |
| Root directory | `/` 或留空 |
| Build command | `pnpm -F @prompt-optimizer/core build && pnpm -F @prompt-optimizer/ui build && pnpm -F @prompt-optimizer/web build` |
| Build output directory | `packages/web/dist` |

### 可选：访问控制

Cloudflare 部署不使用 Vercel 的 `ACCESS_PASSWORD`、`middleware.js` 或 `api/auth.js`。如果你想限制访问，推荐使用 **Cloudflare Access**：

1. 进入 Cloudflare Zero Trust
2. 创建一个 Self-hosted application
3. 绑定你的 Workers 或 Pages 域名
4. 配置允许访问的邮箱、域名、身份提供商或其他策略

这样访问请求会先经过 Cloudflare Access，再进入静态站点，不需要修改前端代码。

### 可选：访问分析

Cloudflare Web Analytics 可以在 Cloudflare 控制台启用，不需要安装类似 `@vercel/analytics` 的前端依赖。

需要注意：GlobalCloud XiaoC 当前使用 hash 路由，因此 Cloudflare Web Analytics 可以统计站点访问和性能数据，但不会自动把 `/#/xxx` 这类 hash 内页面切换当作独立页面浏览。

### 和 Vercel 部署的区别

| 能力 | Vercel | Cloudflare Workers / Pages |
| --- | --- | --- |
| Web 前端部署 | 支持 | 支持 |
| Fork 后自动部署 | 支持 | 支持 |
| 自动同步上游更新 | 不支持，需要用户同步 fork | 不支持，需要用户同步 fork |
| 站点访问控制 | `ACCESS_PASSWORD` 密码页 | 推荐 Cloudflare Access |
| Vercel Analytics | 支持 | 不适用，推荐 Cloudflare Web Analytics |

### 常见问题

#### 修改环境变量后没有生效

Cloudflare 的构建环境变量需要重新部署后才会进入前端构建产物。保存环境变量后，请在 **Deployments** 中重新部署一次。

#### 为什么界面显示的是 Worker，不是 Pages

Cloudflare 控制台现在可能会把 GitHub 静态站点导入到 Workers Static Assets 流程。这个项目是纯前端静态站点，使用 Workers 流程时由 `wrangler.jsonc` 负责构建命令和 `packages/web/dist` 静态资源目录，和 Pages 表单中的构建命令、构建产物目录作用相同。

如果部署日志出现 `The Wrangler application detection logic has been run in the root of a workspace`，说明 Wrangler 没有读到项目根目录的 `wrangler.jsonc`，于是尝试在 monorepo 根目录自动识别应用。请确认当前部署的提交已经包含 `wrangler.jsonc`；如果仍然报错，再把部署命令改成 `npx wrangler deploy --config wrangler.jsonc`，把非生产分支部署命令改成 `npx wrangler versions upload --config wrangler.jsonc`。

#### 连接模型 API 失败怎么办

Cloudflare 部署的是纯前端页面，浏览器仍然会直接请求模型服务。如果模型服务不允许浏览器跨域访问，Web 版会失败。此时建议使用桌面版，或配置你自己的 API 中转服务。
