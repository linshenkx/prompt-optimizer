# Chrome bridge transport experiment

Task `PO-MCP-CHROME-20261115`, round 1. See [the architecture and handoff](../../docs/architecture/mcp-chrome-bridge.md).

## Actual product integration — 2026-11-19

The production integration now lives in `packages/core/src/services/browser-bridge`, `packages/ui/src/browser-bridge` and `packages/mcp-server/src/browser*.ts`. It reuses initialized product services and the existing MCP business contract. The old fixture files below remain historical protocol research, **not evidence for product integration**.

Run the actual built web product against the real SDK stdio server:

```powershell
pnpm -F @prompt-optimizer/core build
pnpm -F @prompt-optimizer/ui build:bundle
pnpm -F @prompt-optimizer/web build
pnpm -F @prompt-optimizer/mcp-server build
pnpm -F @prompt-optimizer/mcp-server test:browser-product
```

Node 24.22.1 and Playwright Chromium/Firefox runtimes are required. The script starts only temporary local product/model HTTP services, uses isolated real browser contexts, seeds synthetic saved model configurations through the browser IndexedDB API, then authorizes through the actual product consent panel. Favorite writes, asset reads, model execution, comparison save/reopen and lifecycle checks all use the real MCP and initialized product services. No user profile or paid provider is used, and no browser security feature is disabled.

Current output is `evidence/20261119/acceptance.json` plus screenshots; see [the local acceptance report](../../docs/testing/browser-mcp-local-20261119.md) for measured scope and restrictions. It is separate from the historical `evidence/browser-20261115.json` fixture observations. A targeted development run accepts `--case=chromium-loopback`; the complete matrix is the final acceptance evidence.

## Historical isolated transport experiment — 2026-11-15

The following is an isolated transport experiment, **not product integration**. It exposes no MCP business tools, model calls, real favorites, real model settings or Chrome profile files. The browser uses raw IndexedDB in a disposable browser context, not the product Dexie provider. No package installation is needed for these older checks.

## Run checks

From the repository root:

```powershell
node --test experiments/mcp-chrome-bridge/bridge.test.mjs
node experiments/mcp-chrome-bridge/demo.mjs
```

The demo prints two fixture URLs on `127.0.0.1` and its PID. It opens two fixture servers and the bridge listener **inside that same Node process**; production would keep only the bridge listener inside the existing MCP process. It stops after 20 minutes or when interrupted. Nothing auto-starts or persists a connection token.

1. Open fixture A and fixture B in a **dedicated disposable browser context**; open a second A page in that same context. Do not use a user's product tabs or daily browser profile.
2. Click **Connect this fixture** on all three pages. The fixture's test-only ticket issuer performs pairing automatically after the click.
3. Click **Refresh sources**. Verify three entries and an initially empty target selection. Listing with no selection returns `explicit_source_required`.
4. Choose B's origin/instance on A, then **List samples from target**. Expect marker `B` and B's executor ID. Choose the second A page and expect marker `A` and that page's executor ID. Both origins use the same experiment database name, so the different samples demonstrate origin separation; the two A pages share data but execute separately.
5. Choose B and **Cancel a wait on target**. The caller returns `cancelled`; B's output shows `cancelledRequest`. This is a cancellable sample timer, not a real model request.
6. Close the selected second A page. Refresh the source list. Its handle must disappear; a call using the old handle fails rather than switching to another page. Ungraceful loss instead expires the six-second demo lease.
7. End the demo process. Remaining pages stop and display `Disconnected`. Close all fixture tabs/the disposable context. No test database is created in product origins.

The automated HTTP checks also cover expired/used tickets, denied Host/Origin, per-source token binding, CORS preflight, cancellation before/after delivery, late results, deadlines, lease expiry, handle changes on reconnect, listener shutdown and body/queue/source limits. They emulate browser clients using Node fetch and **cannot** prove browser permissions.

## Files and limits

- `bridge.mjs`: embeddable Node HTTP listener; authenticates requests and routes only `fixture.list` / `fixture.wait`. Browser result provenance comes from the authenticated connection. No arbitrary script/storage-key execution.
- `demo.mjs`: fixture-only control plane. `/demo/ticket`, `/demo/run` and `/demo/cancel` intentionally make local sample testing easy; **never ship those routes or their authorization model**.
- `fixture.mjs` / `fixture.html`: browser executor, two known samples separated by origin, explicit target picker and cancellation display. The database is `POBridgeExperiment-<random run UUID>` with one `samples` store. No key or private URL is involved.
- `bridge.test.mjs`: seven bounded checks using Node built-ins.
- `evidence/browser-20261115.json`: recorded observations from a dedicated Chrome DevTools context; no pairing/connection secrets.

Pairing tickets and connection tokens are random 256-bit values kept in memory; requests use Authorization headers, not URLs or cookies. The listener accepts exact Host/Origin, bounded JSON POSTs, exact CORS and no credentials. Limits: 64 KiB request body, eight sources, sixteen tickets, sixteen pending requests per source, at most thirty seconds per dispatch. The fixture uses short polling for visibility, not a proposed production heartbeat policy.

The experiment has no MCP owner scoping, accepted business schema, production consent UI, true browser installation identity, product readiness/version negotiation, progress stream, extension support or public-HTTPS permission test. `kind=web-fixture` is the only accepted source kind. It rejects missing Origin; extension request-header behavior must be measured before adapting it. Local hostile processes/XSS are outside the authentication guarantee.

The original checks used Node `v26.13.0` and a Chrome UA reporting `157.0.0.0`. The coordinating chat subsequently reported running the same protocol test command on Node `24.22.1`: 7/7 passed in approximately 0.88 seconds. This adds protocol-test coverage on the repository's declared runtime; no browser or product checks were repeated. Real MCP integration, product Dexie, HTTPS/LNA, installed PWA and packaged extension remain unverified. SQLite is not a prerequisite.
