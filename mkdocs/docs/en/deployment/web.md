# Web Deployment

The Web version is a frontend page, not a model proxy layer.

Whether you use the official online site or deploy your own static site, model requests are sent directly from the browser to the model provider.

## How it relates to Docker and MCP

These options are easy to confuse:

| Method | What you get | Best for |
| --- | --- | --- |
| Web | A reachable frontend page | Online use, static hosting |
| Docker | Web page + `/mcp` service inside the container | Self-hosting and LAN deployments |
| Standalone MCP | MCP service only, without the Web page | MCP clients |

If you want Web and MCP together, start with [Docker Basics](docker-basic.md).

If you only care about MCP integration, see [MCP Server](../user/mcp-server.md).

## When the Web version is a good fit

Good fit:

- You mainly connect to public HTTPS model APIs
- You want to quickly publish a reachable frontend site
- You do not need to access local interfaces such as `http://localhost`

Not a good fit:

- You mainly connect to Ollama, LM Studio, or local gateways
- You need to access enterprise intranet APIs with strict CORS policies
- You expect frontend deployment to bypass browser restrictions

## Two simple ways to use it

### 1. Use the official online site

URL: <https://prompt.always200.com>

This is the easiest option, but browser restrictions still apply:

- Data is stored locally in the current browser by default
- Requests are sent directly to the model service you configure
- If the model service does not allow browser CORS access, the online site cannot bypass that restriction

### 2. Deploy your own static site

The repository root includes `vercel.json`, so it can be deployed to Vercel directly.

You can also deploy the build output to Cloudflare Pages or any other static hosting platform.

## Deploy to Vercel

Recommended flow:

1. Fork this repository
2. Import the repository into Vercel
3. Keep the repository root as the project root
4. Configure environment variables
5. Deploy

### Environment variable safety

Do not preconfigure model API keys for a public Web site. `VITE_*` variables are bundled into the frontend build output, so visitors can download those values in the browser. For public sites, let users configure their own API keys in the application UI.

Only consider preconfigured `VITE_*` model settings for controlled private deployments. Pair that with access control, and use keys that are rotatable, scoped, and cost-limited.

### Optional: site password protection

If you set this on Vercel:

```bash
ACCESS_PASSWORD=your_password
```

The site shows a password page first. This behavior is provided by the root `middleware.js` and `api/auth.js`.

## Deploy to Cloudflare

Public-repository users can start with Cloudflare's official one-click deploy button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/linshenkx/prompt-optimizer)

This flow clones the source repository into your GitHub/GitLab account, then creates and deploys a Worker with Workers Builds. The root `wrangler.jsonc` configures the Web frontend build command, sets `packages/web/dist` as the Workers Static Assets directory, and enables `index.html` fallback routing for the single-page application.

Important notes:

- Deploy to Cloudflare buttons require a public GitHub/GitLab source repository.
- If you want to use a private repository, or restrict the Cloudflare GitHub App to selected repositories manually, use the manual import flow below.

### Manually import a repository

Manual import is useful for private repositories, organization repositories, stricter GitHub App access control, or cases where the one-click button does not fit your setup. The current Cloudflare Dashboard may enter the **Workers Static Assets** flow. If the screen says "Create Worker" and shows a deploy command like `npx wrangler deploy`, use the Workers settings.

1. Fork this repository
2. In the Cloudflare Dashboard, open **Workers & Pages**
3. Create an application from your GitHub/Git repository
4. Choose your forked `globalcloud-xiaoc` repository
5. If the screen says "Create Worker", keep most settings at their defaults:

| Setting | Recommended value |
| --- | --- |
| Worker name | Keep `globalcloud-xiaoc` if it is auto-filled; otherwise change it to `globalcloud-xiaoc` |
| Root directory / Path | Keep the default, usually `/` or empty |
| Build command | Clear it; if Cloudflare auto-fills `pnpm run build`, delete it. `wrangler.jsonc` already configures the build command |
| Deploy command | Keep the default `npx wrangler deploy` |
| Non-production branch deploy command | Keep the default `npx wrangler versions upload` |

If the deployment log says `The Wrangler application detection logic has been run in the root of a workspace`, Wrangler did not read the root `wrangler.jsonc` and tried to auto-detect an app from the monorepo root. Make sure the deployed commit includes `wrangler.jsonc`. If it still fails, set the deploy command to `npx wrangler deploy --config wrangler.jsonc`, and set the non-production branch deploy command to `npx wrangler versions upload --config wrangler.jsonc`.

If your Cloudflare Dashboard still shows **Create application** -> **Pages** -> **Connect to Git**, you can use the Pages form:

| Setting | Recommended value |
| --- | --- |
| Framework preset | `None` or empty |
| Root directory | `/` or empty |
| Build command | `pnpm -F @prompt-optimizer/core build && pnpm -F @prompt-optimizer/ui build && pnpm -F @prompt-optimizer/web build` |
| Build output directory | `packages/web/dist` |

You usually do not need to configure build environment variables manually. Cloudflare detects the `pnpm` and Node.js versions from the repository `packageManager` and `engines` fields.

If Cloudflare detects the wrong versions, set these build environment variables:

```bash
NODE_VERSION=22
PNPM_VERSION=10.6.1
```

Do not preconfigure model API keys for a public Cloudflare site. Every `VITE_*` variable is bundled into the frontend build output, so visitors can download those values in the browser. For public sites, leave API keys out of the hosting platform and let users configure their own keys in the application UI.

Only consider preconfigured `VITE_*` model settings for controlled private deployments. Pair that with Cloudflare Access, and use keys that are rotatable, scoped, and cost-limited.

### Optional: Cloudflare Access and Web Analytics

Cloudflare deployment does not use Vercel's `ACCESS_PASSWORD`, `middleware.js`, or `/api/auth`. If you need restricted access, configure Cloudflare Access for your Workers or Pages domain in Cloudflare Zero Trust.

Cloudflare Web Analytics can be enabled from the Cloudflare dashboard, so no frontend dependency like `@vercel/analytics` is required.

!!! note
    The Web version currently uses hash routing. Cloudflare Web Analytics can track site visits and performance data, but it will not automatically treat `/#/xxx` hash route changes as separate page views.

## Deploy to other static hosting

Local build:

```bash
pnpm install
pnpm build
```

After the build completes, the Web frontend output is:

```text
packages/web/dist
```

Deploy this directory to Nginx, OSS, S3, Cloudflare Pages, or another static hosting platform.

!!! note
    If you are not using Vercel, static hosting does not automatically provide the `ACCESS_PASSWORD` password page or `/api/auth`. Those are part of the Vercel deployment path.

## Main limitation of the Web version

The problem is usually not whether the page can open. The problem is whether the browser can connect to your model service.

### CORS

If the model service does not return browser-compatible CORS headers, the Web version fails directly.

### Mixed Content

If your site is served over `https://...` but your model API is `http://localhost:...`, browsers usually block the request.

### Enterprise network policies

If a company network blocks unknown API domains, restricts self-signed certificates, or requires a proxy, the frontend site itself cannot solve that automatically.

## When to use another option

Choose another option for these needs:

- Connect to Ollama / LM Studio: use the [desktop app](desktop.md)
- Connect to LAN HTTP APIs: use the [desktop app](desktop.md)
- Provide Web and MCP together: use [Docker Basics](docker-basic.md)
- Provide MCP only: see [MCP Server](../user/mcp-server.md)

## Related pages

- [Desktop App](desktop.md)
- [Docker Basics](docker-basic.md)
- [MCP Server](../user/mcp-server.md)
