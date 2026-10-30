# Local service discovery shortcuts

Opening the text model manager probes known local services once. The list stays
empty until a new reachable service or browser AI capability is identified. A compact
**Discovered: Ollama Magpie CLIProxyAPI LiteLLM llama.cpp Chrome AI** row shows each service's
icon and name. Loading, missing services,
blocked requests and already configured addresses add no UI. Reopening the manager
or returning to the text tab starts a new bounded probe.

Existing connection addresses are excluded regardless of model ID, provider or
enabled state. `localhost`, `127.0.0.1` and `::1` are equivalent; trailing slashes
and the standard `/v1` API suffix are normalized. Different ports, protocols and
other URL paths remain distinct. Results update when the saved connection list
changes, including when a connection is added or removed.

Clicking a service opens the existing new-provider/model editor, prefilled with
the connection address. All five enabled HTTP services leave API key and model selection
empty. The user explicitly fetches models with the existing refresh button;
services with authentication require the user's own key. In the web app, Magpie requires a key
before refresh; other services can be queried without one and a 401 prompts for
a key. Entering a key itself sends no request. No key is read, generated or saved
by discovery, and opening the editor never requests any service's catalog.
Saving uses the normal
model manager persistence flow. Cancelling adds nothing. The persisted address
list is checked again before preparing a draft, and saving removes the suggestion.
No separate provider entity or automatic model import is introduced.

## Magpie provider and connection help verification (2026-10-29)

- Core registry/discovery/catalog regression: 103 checks passed; core build passed.
- UI regression: 144 checks passed across provider help, provider selection,
  mobile editor, discovery, refresh and address normalization. UI typecheck passed.
- Isolated headless web verification at `http://127.0.0.1:18262` used the actual
  running Magpie for discovery and an intentionally invalid-key rejection.
  Neither opening its draft nor switching/copying help commands fetched models.
  Windows, macOS and Linux command selection and clipboard contents passed.
- Positive catalog and chat responses were intercepted only inside that browser
  context, with a fixture key. This verified manual Magpie selection, Bearer
  forwarding, model selection, testing, saving, retained provider help on editing,
  and `localhost`/`127.0.0.1` deduplication. It is not a real authorized inference test.
- At 390px viewport width, expanded help wraps without horizontal overflow.
  Ollama's empty key, enabled explicit refresh and collapsed CORS guidance passed.
  No native UI was operated, no gateway key was created/read, and no Ollama runtime
  connection was claimed. macOS/Linux commands were displayed/copied, not executed.

## Discovery transports

- Ollama: default `localhost:11434`, recognize the exact `GET /` text
  `Ollama is running`. Explicit model refresh reads `/api/tags`.
- Magpie: default `127.0.0.1:3425`, recognize either a successful `/api/hello`
  response with `name: "magpie"`, or its branded HTTP 401 JSON response from
  `corsGuard`: `error.type` must be `authentication_error` and `error.message`
  must carry the Magpie web/extension gateway-key prefix and Gateway-page
  guidance. A bare 401, generic authentication error, HTML, or 403 is insufficient.
  No authorization header or `/v1/models` request is sent during discovery.
  This is a service fingerprint, not cryptographic identity: changes to Magpie's
  error format may require an update; unknown responses produce no suggestion.
- LM Studio: paused at the user's request on 2026-10-30. No automatic probes,
  including custom-port probes, discovery shortcut or dedicated connection help.
  Its known kind remains solely for compatibility with persisted metadata.
- CC Switch: paused at the user's request on 2026-10-30. No automatic probes,
  including custom-port probes, discovery shortcut or dedicated connection help.
- CLIProxyAPI: default `127.0.0.1:8317`, identify the public `GET /` JSON with
  `message: "CLI Proxy API Server"` and an endpoints array containing both
  `POST /v1/chat/completions` and `GET /v1/models`. No management API is accessed;
  generic JSON, HTML, and unauthenticated 401/403 responses do not establish identity.
  Explicit model refresh uses `/v1/models` and the user's client API key when
  authentication is enabled. The field distinguishes client keys from management
  keys. New drafts use OpenAI-compatible Chat Completions. The terminal icon is
  an original pictogram rather than an official logo.
- LiteLLM: default `127.0.0.1:4000`, require the public `/health/liveliness`
  JSON string `"I'm alive!"` together with the root Swagger document's exact
  `LiteLLM API - Swagger UI` title and `SwaggerUIBundle` marker. Never use
  `/health`, which may invoke upstream models. Disabled, moved or custom-branded
  documentation cannot establish this fingerprint and remains a manual connection.
- llama.cpp (`llama-server`): probe both `127.0.0.1:9931` (current default) and
  `127.0.0.1:8080` (legacy default); distinct instances can both appear. An explicit
  port override replaces both defaults. Require the public `/health` schema and
  either `Server: llama.cpp`, the strict `/props` structure, or the public UI
  manifest's llama name and exact description. Browser CORS normally hides the
  Server header, so props/manifest are necessary fallbacks. Protected props do
  not require entering a key during discovery: the default UI manifest is public.
  Protected servers with UI disabled/older UI and no exposed identity cannot be
  reliably identified in a browser and stay manual. A generic healthy response,
  401, or the port alone is insufficient. Discovery never reads `/v1/models`.
- LiteLLM and llama.cpp drafts use OpenAI-compatible Chat Completions. Explicit
  refresh reads `/v1/models`; an optional user-entered key is sent only then.
  Their icons are original pictograms. These probes identify running services;
  they do not prove that a model is loaded or upstream inference is available.
- Desktop: the main process makes direct requests. For Magpie it reads only the
  port from `$XDG_CONFIG_HOME/magpie/settings.json` or
  `~/.config/magpie/settings.json`. Missing or invalid settings fall back to 3425.
- Web: browser requests are subject to CORS and local network permissions. An
  inaccessible service produces no suggestion. Ollama can allow the website
  through `OLLAMA_ORIGINS`. LM Studio/CC Switch must also allow the website's origin;
  a successful desktop probe does not establish browser access. On mobile, localhost
  refers to the phone. No backend proxy is used to inspect the web server's localhost.

There is no port-range or LAN scan, background polling or inference request.
Each HTTP service has a three-second deadline. Redirects are rejected and browser
cookies omitted. Closing the manager or changing tabs aborts browser requests
and ignores late results; desktop probes complete within their deadline.

Ollama uses its existing adapter with no API key. Magpie has its own `magpie`
provider metadata and reuses the OpenAI adapter transport with a user-entered gateway key;
its ordinary local application identifier is not a valid browser credential.
Magpie web drafts require a nonblank key before
model refresh, connection testing or saving. Entering a key alone sends no request.
The native desktop transport can still use unauthenticated loopback access.
Both providers expose collapsed provider-specific help beneath API Key, including
manual addition and editing. Magpie help defaults to the detected OS with Windows,
macOS and Linux choices and copies a key-creation command; the app never executes it.
Windows uses the default `%LOCALAPPDATA%/Programs/Magpie/magpie-cli.exe` path,
while macOS/Linux use `magpie` on PATH. Custom installs must adjust the path.
The text distinguishes a new key from retrieval of an existing key and explains
that local browser access needs a gateway key and an allowed origin, not LAN sharing.
Ollama help explains optional local credentials and `OLLAMA_ORIGINS` plus restart
for additional page origins. Existing generic OpenAI-compatible configurations
are not automatically reclassified; select Magpie to use its dedicated help.
LM Studio uses the OpenAI-compatible adapter. CC Switch uses OpenAI-compatible
Responses or Anthropic according to the discovered routing. No placeholder key
is put into the editor or saved configuration. For unauthenticated loopback
Anthropic proxies, the SDK explicitly omits authentication headers. Remote
Anthropic connections retain their normal authentication requirement.
Explicit catalog refresh preserves the provider's authentication header convention
(`x-api-key` for Anthropic, Bearer for OpenAI-compatible services). Model IDs are
preserved verbatim. Brand SVGs are bundled locally; their source
and license notices are in `packages/ui/src/components/icons/THIRD_PARTY_NOTICES.txt`.

## Chrome built-in AI

The same row checks `LanguageModel.availability()` in the current renderer/browser,
independently of HTTP discovery. Available, downloadable and downloading states
produce a shortcut, with short download status labels for the latter two. Missing
or unavailable APIs produce no UI. Discovery never calls `create()` or downloads a
model. Electron does not inherit capabilities from a separately installed Chrome.

The untouched disabled built-in configuration is hidden from the model list and
reused when the shortcut is clicked. It is enabled in the draft only when already
available; the existing editor handles explicit download/preparation. Nothing is
persisted on click/cancel. Saving updates the same built-in ID and removes the hint.
Any configured Chrome connection, including an explicitly disabled one, suppresses
the hint. Existing enabled connections remain intact. Startup no longer silently
auto-enables the default placeholder.

## Validation

- Core tests cover catalog validation, service identity, port validation,
  authorization failures, timeouts, cancellation and duplicate catalog entries.
- Desktop tests cover configuration lookup, invalid settings, loopback HTTP
  responses and redirect rejection. The repository IPC check covers registration.
- UI tests cover invisible initial/failure states, service icons, address-only
  deduplication, browser/desktop dispatch, cancellation and late results, draft
  prefill, explicit save, cancel and preservation of existing saved configurations.

- Expanded browser acceptance used four isolated loopback HTTP fixtures and a
  test-only Chrome capability shim. All five icons appeared together; LM Studio
  prefilled its editor and cancelling added nothing; saving CC Switch with a
  `localhost` alias and trailing slash removed its `127.0.0.1` suggestion; saving
  Chrome reused one built-in connection and removed its shortcut. Unit tests also
  cover download-required states and explicitly disabled Chrome configurations.
  This is not packaged Electron acceptance, real Chrome model download or inference.

References: [Ollama FAQ](https://docs.ollama.com/faq),
[Ollama root handler](https://github.com/ollama/ollama/blob/main/server/routes.go),
[Magpie integration](https://usemagpie.ai/docs/integrate),
[Magpie CORS guard](https://github.com/yetone/magpie/blob/main/internal/gateway/cors.go),
[Magpie gateway keys](https://usemagpie.ai/docs/remote),
[LM Studio native API](https://lmstudio.ai/docs/developer/rest/list),
[LM Studio SDK identity probe](https://github.com/lmstudio-ai/lmstudio-js/blob/main/packages/lms-client/src/LMStudioClient.ts),
[LM Studio legacy API](https://lmstudio.ai/docs/developer/rest/endpoints),
[CC Switch proxy handlers](https://github.com/farion1231/cc-switch/blob/main/src-tauri/src/proxy/handlers.rs),
[CLIProxyAPI root and authenticated routes](https://github.com/router-for-me/CLIProxyAPI/blob/main/internal/api/server_routes.go),
[CLIProxyAPI port and client-key configuration](https://github.com/router-for-me/CLIProxyAPI/blob/main/config.example.yaml),
[LiteLLM public liveness contract](https://docs.litellm.ai/docs/proxy/health),
[LiteLLM Swagger title and routing](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/proxy_server.py),
[llama.cpp HTTP headers and public routes](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/server-http.cpp),
[llama.cpp props schema](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/server-context.cpp),
[llama.cpp public UI manifest](https://github.com/ggml-org/llama.cpp/blob/master/tools/ui/src/lib/constants/pwa.constants.ts),
[Chrome built-in AI](https://developer.chrome.com/docs/ai/get-started).

## Actual local-service web verification (2026-10-29)

The unmocked worktree web app was served at `http://127.0.0.1:18262` and tested
in an isolated browser tab. No fixture services, capability shims, proxy or CORS
bypass were enabled. Magpie was running at `127.0.0.1:3425`; direct read-only
requests returned its identity and 10 real models. Ollama 11434, LM Studio 1234
and CC Switch 15721 were not listening at the time of the check.

The initial web check, before the CORS and discovery changes, did **not** pass for Magpie:

- Discovery: `/api/hello` returned HTTP 200 without `Access-Control-Allow-Origin`.
  The browser reported `MissingAllowOriginHeader`, and no discovery chip appeared.
- Connection: manually configured the same Magpie URL/application identifier and
  the listed `deepseek/deepseek-flash` model in an unsaved draft, then clicked the
  application's Test Connection button. The browser reported
  `PreflightMissingAllowOriginHeader`; the UI showed `Connection test failed:
  Connection error`. The direct OPTIONS check returned 404 without CORS headers.
  This does not establish an upstream-model failure or successful inference.
- The current browser showed no Chrome AI discovery chip; no Chrome download or
  inference was attempted. Real Chrome Prompt API capability remains unverified.

The user stopped desktop UI testing; there is no completed desktop UI acceptance
claim from this run. No service/browser security settings were changed during that initial check.
Screenshot: `.codex-run/live-web-cors.jpg` (local ignored acceptance evidence).

### Keyless discovery revision

At the user's request, Magpie's origin allowlist now includes both `localhost`
and `127.0.0.1` for web ports 18181 and 18262, preserving its existing entries.
All four origins returned CORS preflight 204. The actual keyless `/api/hello`
returned the branded 401 JSON response used by discovery.

The revised web app was tested against the real running Magpie in isolated
headless Chromium after the in-app browser tab failed to load. Browser CORS
enforcement stayed enabled; no simulated service, proxy, response interception
or Chrome capability shim was used. The discovery shortcut appeared from one
unauthenticated `/api/hello` request, with no model-list request. Opening it
left the key and model empty and disabled model refresh until a key was entered.

The complete real-service web flow passed:

- Cancelling the empty draft added no connection and kept the shortcut available.
- An invalid user-entered key produced a real `/v1/models` 401; no model was invented.
- A temporary gateway key, restricted to `deepseek/deepseek-flash`, was entered
  through the same API-key field. Clicking refresh returned the real model list
  with HTTP 200. Entering the key itself triggered no request.
- The editor's Test Connection sent `/v1/chat/completions` to the actual Magpie,
  received HTTP 200, and displayed success.
- Saving as `http://localhost:3425/v1/` removed the discovery shortcut for
  `http://127.0.0.1:3425/v1`; the saved connection remained deduplicated after reload.
- The isolated browser was closed and the temporary key removed. The gateway-key
  IDs matched the original set afterwards; no existing keys were changed.

Evidence: `.codex-run/discovery-key-live-results.json`,
`.codex-run/discovery-key-found.png`, `.codex-run/discovery-key-empty.png`, and
`.codex-run/discovery-key-connected.png` (ignored local acceptance artifacts).
Targeted validation: 34 core and 119 UI tests passed, core/UI type checks passed,
changed UI source lint passed, and locale structures remained aligned.
No desktop UI, Chrome model download or other local service inference was tested
in this revision.

### Unified deferred catalogs (2026-10-29)

Ollama, LM Studio and CC Switch now follow the same deferred-catalog workflow.
Identity probes do not request model lists. Opening/cancelling the editor and
entering a key send no catalog request. Explicit refresh retains native model
filtering and CC Switch protocol selection, without static fallback models.
Cancelled requests and results for changed addresses/keys/headers are ignored.

Validation of this revision:

- 66 core and 123 UI unit tests passed, covering identity, native catalogs,
  user-provided headers/keys, auth failures, cancellation, empty drafts, protocol
  selection, saving and address normalization. Core/UI type checks passed.
- Isolated headless web protocol fixtures passed for Ollama, LM Studio with auth,
  CC Switch Responses with auth, and CC Switch Anthropic without auth. All used
  explicit catalog refresh and alias-based deduplication after saving. The
  Anthropic fixture also verified a web connection request without fabricated
  authentication headers. These fixtures are not real-service acceptance.
- The actual running Magpie was tested again without response interception:
  keyless identity, invalid-key 401, scoped model catalog 200, actual chat
  completion 200, and deduplication through save/reload all passed. The temporary
  scoped test key was revoked and the original key-ID list verified unchanged.
- Ollama 11434, LM Studio 1234 and CC Switch 15721 were not listening locally;
  real connections to those services were not claimed. No desktop UI was used.

Ignored local evidence: `.codex-run/discovery-unified-web-results.json` and
`.codex-run/discovery-key-live-results.json`. The ordinary worktree preview is
`http://127.0.0.1:18262`; fixture routes exist only inside the test browser.

### CLIProxyAPI addition (2026-10-29)

Added to the shared browser/main-process discovery registry with a bounded probe
of port 8317 and public-root identity validation. The existing deferred-catalog,
empty-draft and loopback-address deduplication rules apply unchanged.

An isolated headless browser tested the actual running CLIProxyAPI on port 8317:
public-root discovery succeeded with browser CORS enforcement, opening/cancelling
sent no catalog request, and explicit unauthenticated catalog retrieval returned
401 with the expected client-key prompt. No existing key was read or generated,
no management API or configuration was changed, and authenticated real-service
model retrieval/inference was not attempted without a user-provided key.

A separate browser protocol fixture verified key entry alone sends no request,
explicit refresh loads the catalog, Chat Completions connection testing succeeds,
and saving a localhost alias hides the 127.0.0.1 suggestion across reloads.
This positive authenticated flow is simulated, not actual upstream inference.
The targeted 62 core and 119 UI tests passed. Core build/declaration generation
passed. Evidence: `.codex-run/cliproxyapi-web-results.json` and
`.codex-run/cliproxyapi-live.png` (ignored local artifacts). No desktop UI testing.

### LiteLLM and llama.cpp addition (2026-10-29)

Added LiteLLM 4000 and llama.cpp 9931/8080 to the shared registry. No actual
LiteLLM or llama.cpp service was listening on those ports before validation.
An isolated headless Chromium session exercised three temporary HTTP protocol
fixtures with ordinary browser CORS enforcement and no response interception:
LiteLLM with authentication, llama.cpp without authentication on 9931, and
llama.cpp with authentication on 8080. The Server header was deliberately not
CORS-exposed, proving props and the public manifest fallback work in the browser.

All three passed identity-only discovery, empty draft/cancel, explicit model
refresh, optional-key or 401/key flows, simulated Chat Completions connection,
and localhost/127.0.0.1 deduplication after saving and reloading. The distinct
llama.cpp instances remained independently addable. The actual running
CLIProxyAPI still appeared after reload. Fixtures were closed after testing.
This does not establish real LiteLLM upstream inference or llama.cpp inference.
No desktop UI or service configuration was changed.

The 79 core and 121 UI targeted tests, core build/declarations and UI typecheck
passed. Local ignored evidence: `.codex-run/lite-llama-web-results.json` and
`.codex-run/lite-llama-web.png`. Docker Model Runner was explained only; it is
not part of the discovery registry in this revision.

### Connection help review (2026-10-29)

Added collapsed connection help for LM Studio, CC Switch, CLIProxyAPI, LiteLLM
and llama.cpp, alongside the existing Magpie and Ollama help. Each explains
service startup, the appropriate client credential, model prerequisites and
browser access constraints, with an official documentation link. All copy is
available in Simplified Chinese, Traditional Chinese and English. Chrome's
outdated three-language claim was removed; its text now distinguishes the
app's English session defaults from version-dependent browser capabilities,
and explains that the desktop app cannot borrow an installed Chrome's AI.

Discovered connections using shared protocol providers retain an optional
`connectionConfig.localServiceKind` solely for help on subsequent edits. It is
not inferred from names or ports, does not alter requests, and is cleared on
provider changes. Existing generic connections without this marker continue
to show generic help rather than guessing their service identity.

The 120 targeted UI tests and UI typecheck passed. Tests cover persistence and
reopening of the help identity, provider changes, invalid identities, and the
existing address deduplication rules. Headless web checks used the actual
running CLIProxyAPI for discovery/help and intercepted identity fixtures for
the other four services. All five passed three-language rendering, collapsed
initial state, documentation links and 390px layout checks. Opening help sent
no model-catalog or inference requests. This verifies guidance display, not
authenticated inference or those four services' actual CORS configuration.
Evidence: `.codex-run/other-provider-help-web-results.json` and the matching
`*-help-mobile.png` files (ignored). No native UI or service settings changed.

### Real-service acceptance and quiet LM Studio attempt (2026-10-30)

Real headless web acceptance passed for Magpie, CLIProxyAPI, LiteLLM, Ollama
and llama.cpp. Each exercised identity-only discovery, explicit catalog retrieval,
real inference, saving a connection with the alternate localhost/127.0.0.1 alias,
and deduplication after reload. Catalog sizes were 10, 22, 1, 1 and 1 respectively.
LiteLLM used real Magpie inference upstream. Ollama and llama.cpp used the actual
SmolLM2-135M-Instruct GGUF on CPU; this establishes connectivity, not model quality
or GPU performance. Ollama was also retested without an OLLAMA_ORIGINS override.
The temporary Magpie key was revoked and existing key IDs were verified unchanged;
private test credential copies were cleared. Evidence:
`.codex-run/real-local-web-results.json` and matching screenshots (ignored).

Actual llama.cpp testing exposed an SDK constructor failure for empty credentials.
Optional-key providers now use an internal SDK sentinel that is stripped from
outgoing Authorization headers. The real-SDK authentication regression cases and
existing OpenAI adapter tests passed (30 tests), as did core typecheck.

LM Studio llmster 0.0.27-1 was installed and the test GGUF imported. Following a
user report of disruptive windows, a bounded retry used a separate invisible
Windows desktop and a kill-on-close process job, capped at 20% CPU and 1.5 GiB
committed memory. The API started with CORS enabled and its native model catalog
returned the imported model's actual key. Loading it with GPU off then failed in
the previously installed CUDA runtime with Windows' "The paging file is too small
for this operation to complete" error. This happened inside the resource-limited
test; it does not establish the cause outside those limits. The attempt was
stopped without relaxing limits or changing system paging settings. All job
processes exited and ports 1234/18262 were verified closed. LM Studio web discovery,
connection testing and real inference remain incomplete. Evidence:
`.codex-run/services/lm-quiet-status.json` and `lm-quiet.log` (ignored).

CC Switch is skipped at the user's request. The user reports Chrome built-in AI
works in their real browser; the earlier isolated headless `unavailable` result
does not contradict that and is not a machine-wide capability verdict.

LM Studio discovery and its dedicated help were subsequently paused at the user's
request. Both default and custom-port discovery omit it; UI results from older
desktop bridges also hide it. Historical metadata/catalog compatibility remains.
The 53 core discovery and 30 UI discovery/help tests passed, along with core and
UI typechecks. No model services were started for these checks. CC Switch was
subsequently paused as well, including probes, shortcut and three-language help.
The enabled shortcuts now comprise only the five real-service-tested HTTP
services and Chrome AI, which the user verified in their real browser.

### Pre-commit review (2026-10-30)

Review fixed late catalog responses after the editor closes: closing the editor,
leaving the model manager or unmounting it now cancels the local request and
prevents stale options and notifications. The desktop bridge regression test was
also updated for the paused services. The final targeted suite passed 301 tests:
142 core adapter/discovery/catalog tests, 156 UI tests and 3 desktop bridge tests
(no native application launched). Core CJS/ESM/declaration builds, UI typecheck,
desktop JavaScript syntax checks and the existing web preview smoke test passed.
The web model manager loaded without page errors and neither paused shortcut
appeared. No model service was started for this review; local installation,
credential and test-log artifacts remain ignored and are excluded from Git.
