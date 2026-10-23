# Web app shell

PWA support belongs to `packages/web`; the shared UI keeps the workspace state and normal desktop presentation. The production build generates `manifest.webmanifest` and `sw.js`. Development/HMR, Electron and browser extension contexts do not register the worker.

`pwa.config.ts` exports `createPwaPlugin()` so the private production preview can use the exact same manifest and worker without changing the public model configuration. Registration requires a secure context (HTTPS or browser-trusted localhost). A plain LAN HTTP IP is not installable as a full PWA. Server-side API routing is separate from this feature.

## Update adapter

`PromptOptimizerApp` exposes `prepareForUpdate(): Promise<'ready' | 'busy' | 'save-failed'>`. The Web entry calls only this adapter via the component ref; it never imports the workspace's internal stores. The adapter must save pending workspace state and reject active generation or unsaved manager forms. Missing/failed adapters block activation.

New workers wait. The user explicitly chooses **Save and update**; while saving and activating, the Web wrapper becomes inert and a shield prevents starting another operation. Busy/save-failed/other-window outcomes immediately release that lock. Preparation and activation have bounded timeouts. After preparation, the worker refuses activation if another window in its scope is open. No generic `controllerchange` handler reloads other tabs. The accepted tab reloads only after its waiting worker activates. No cache cleanup touches localStorage, IndexedDB, model configuration, images, or unrelated app caches.

## Offline boundaries

Only assets listed by the production build enter the shell precache. The hash-router entry uses network-first navigation with the precached document as an offline fallback. Model APIs, runtime `config.js`, unknown resources, cross-origin requests, requests with Authorization/Range, mutations and query-string resources are not intercepted. Install fetches omit credentials, and private/no-store/authentication/redirected responses cannot enter the shell cache. Thus a server must serve its public build assets without private/no-store response headers; `config.js`, API responses and the service-worker script itself should remain uncached by the HTTP layer.

Offline opening allows reading and editing already-saved local work. Model execution still needs the network; first-time loading and configuration download require connectivity. Changing from a LAN IP to localhost/HTTPS creates a different browser origin and does not silently move existing data.

A successful `register()` call only starts installation. The shell is marked offline-ready only after a worker activates. A failed first installation (`redundant`) keeps the normal online page available and does not present the installation reminder or claim that the offline shell is ready.

The existing Docker Nginx configuration uses Basic Auth and no-store rules for some build resources. Those deployment settings conflict with intentionally refusing authenticated/private shell caching. They have not been relaxed by this change. Local production-preview acceptance does **not** establish that Docker installation/offline use or a long-term HTTPS deployment is ready. A deployment-specific authentication and static-resource policy must be reviewed before enabling that scenario; never cache credential-bearing runtime configuration to make it pass.

Installation uses the existing project logo at 192/512 px; the maskable variant keeps the brand inside a safe inner area. The install reminder is compact, dismissible for seven days, mobile-only, hidden after installation and while the keyboard is open. iOS shows the Safari Add to Home Screen steps. Updates and offline status are temporary overlays below modal layers and do not change desktop layout.

## Checks

Run `pnpm -F @prompt-optimizer/web test:unit --run`, Web typecheck, and the production Web build. Real-device acceptance should also verify installation, standalone display, restart restoration, offline shell loading, an actual model call, an update while busy, an accepted update after saving, and the other-window guard. Do not describe a successful build or an install banner as proof of native installation.
