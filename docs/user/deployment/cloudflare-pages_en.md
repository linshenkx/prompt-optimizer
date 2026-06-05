## Cloudflare Deployment Guide

Cloudflare is suitable for deploying the GlobalCloud XiaoC **Web frontend**. The current Cloudflare Dashboard may import GitHub repositories through the **Workers Static Assets** flow instead of the older **Pages** form. Both can deploy the static frontend, but if your screen says "Create Worker" and shows a deploy command like `npx wrangler deploy`, use the Workers settings below.

### Recommended method: one-click deploy

Public-repository users can start with Cloudflare's official one-click deploy button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/linshenkx/prompt-optimizer)

This flow clones the source repository into your GitHub/GitLab account, then creates and deploys a Worker with Workers Builds. The repository root includes `wrangler.jsonc`, which tells Cloudflare Workers how to build the Web frontend, publish the `packages/web/dist` static assets, and use `index.html` fallback routing for the single-page application.

Important notes:

- Deploy to Cloudflare buttons require a public GitHub/GitLab source repository.
- If you want to use a private repository, or restrict the Cloudflare GitHub App to selected repositories manually, use the manual import flow below.

### Alternative: manually import a repository

Manual import is useful for private repositories, organization repositories, stricter GitHub App access control, or cases where the one-click button does not fit your setup.

1. **Fork the project to your GitHub account**
   - Visit the [prompt-optimizer repository](https://github.com/linshenkx/prompt-optimizer)
   - Click "Fork" in the top right corner
   - After forking, you will have a copy of the repository under your own GitHub account

2. **Import the repository into Cloudflare**
   - Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Open **Workers & Pages**
   - Create an application from your GitHub/Git repository
   - Choose your forked `globalcloud-xiaoc` repository

3. **Review Worker settings**

   If the screen says "Create Worker", most settings can stay at their defaults. The Worker name must match the `name` field in the root `wrangler.jsonc`.

   | Setting | Recommended value |
   | --- | --- |
   | Worker name | Keep `globalcloud-xiaoc` if it is auto-filled; otherwise change it to `globalcloud-xiaoc` |
   | Root directory / Path | Keep the default, usually `/` or empty |
   | Build command | Clear it; if Cloudflare auto-fills `pnpm run build`, delete it. `wrangler.jsonc` already configures the build command |
   | Deploy command | Keep the default `npx wrangler deploy` |
   | Non-production branch deploy command | Keep the default `npx wrangler versions upload` |

4. **Environment variables**

   You usually do not need to configure build environment variables manually. Cloudflare detects the `pnpm` and Node.js versions from the repository `packageManager` and `engines` fields.

   If Cloudflare detects the wrong versions, add these build environment variables:

   ```bash
   NODE_VERSION=22
   PNPM_VERSION=10.6.1
   ```

   Do not preconfigure model API keys for a public Cloudflare site. Every `VITE_*` variable is bundled into the frontend build output, so visitors can download those values in the browser. For public sites, leave API keys out of the hosting platform and let users configure their own keys in the application UI.

   Only consider preconfigured `VITE_*` model settings for controlled private deployments. Pair that with Cloudflare Access, and use keys that are rotatable, scoped, and cost-limited.

5. **Deploy**
   - Save the settings and start the deployment
   - After deployment succeeds, Cloudflare Workers provides a `*.workers.dev` domain; you can bind a custom domain later
   - Later, whenever your fork receives new commits, Cloudflare rebuilds and redeploys automatically

6. **Sync upstream updates**
   - Open your forked repository on GitHub
   - When GitHub shows that it is behind `linshenkx/prompt-optimizer`, click **Sync fork**
   - Once the sync creates new commits in your fork, Cloudflare redeploys automatically

### Alternative: older Cloudflare Pages form

If your Cloudflare Dashboard still shows **Create application** -> **Pages** -> **Connect to Git**, you can use the Pages form:

| Setting | Recommended value |
| --- | --- |
| Framework preset | `None` or empty |
| Root directory | `/` or empty |
| Build command | `pnpm -F @prompt-optimizer/core build && pnpm -F @prompt-optimizer/ui build && pnpm -F @prompt-optimizer/web build` |
| Build output directory | `packages/web/dist` |

### Optional: access control

Cloudflare deployment does not use Vercel's `ACCESS_PASSWORD`, `middleware.js`, or `api/auth.js`. If you want restricted access, use **Cloudflare Access**:

1. Open Cloudflare Zero Trust
2. Create a Self-hosted application
3. Bind it to your Workers or Pages domain
4. Configure allowed emails, domains, identity providers, or other access policies

Requests will pass through Cloudflare Access before reaching the static site, without frontend code changes.

### Optional: analytics

Cloudflare Web Analytics can be enabled from the Cloudflare dashboard, so you do not need a frontend dependency like `@vercel/analytics`.

Note that GlobalCloud XiaoC currently uses hash routing. Cloudflare Web Analytics can track overall site visits and performance, but it will not automatically treat `/#/xxx` hash route changes as separate page views.

### Differences from Vercel deployment

| Capability | Vercel | Cloudflare Workers / Pages |
| --- | --- | --- |
| Web frontend deployment | Supported | Supported |
| Auto deploy after fork commits | Supported | Supported |
| Automatic upstream sync | Not supported; users sync their fork | Not supported; users sync their fork |
| Site access control | `ACCESS_PASSWORD` password page | Use Cloudflare Access |
| Vercel Analytics | Supported | Not applicable; use Cloudflare Web Analytics |

### FAQ

#### Environment variable changes did not take effect

Cloudflare build environment variables are included in the frontend build output only after a new deployment. After saving variables, redeploy from **Deployments**.

#### Why does the dashboard show Worker instead of Pages?

The Cloudflare dashboard may now import GitHub static sites through the Workers Static Assets flow. This project is a pure frontend static site. In the Workers flow, `wrangler.jsonc` owns both the build command and the `packages/web/dist` static asset directory, which serve the same roles as the Pages build command and build output directory fields.

If the deployment log says `The Wrangler application detection logic has been run in the root of a workspace`, Wrangler did not read the root `wrangler.jsonc` and tried to auto-detect an app from the monorepo root. Make sure the deployed commit includes `wrangler.jsonc`. If it still fails, set the deploy command to `npx wrangler deploy --config wrangler.jsonc`, and set the non-production branch deploy command to `npx wrangler versions upload --config wrangler.jsonc`.

#### What if model API connections fail?

Cloudflare deploys a pure frontend page. The browser still calls model services directly. If a model provider does not allow browser CORS requests, the Web version will fail. Use the desktop app or configure your own API relay service in that case.
