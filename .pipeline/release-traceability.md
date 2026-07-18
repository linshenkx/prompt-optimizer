# Release Traceability

- generatedAt: 2026-07-18T07:08:17.705Z
- branch: `work/desktop-hardening`
- commit: `90adf6db32684325d12724b1065bd46c1a9b441a`
- fork: https://github.com/xvyimu/prompt-optimizer
- upstream: https://github.com/linshenkx/prompt-optimizer

## git status
```
## work/desktop-hardening...origin/work/desktop-hardening
 M packages/core/tests/unit/image-understanding/service.test.ts
 M packages/core/tests/unit/llm/anthropic-adapter.test.ts
 M packages/core/tests/unit/llm/openai-adapter.test.ts
 M packages/core/tests/unit/services/electron-proxy-ipc-serialization.test.ts
 M packages/desktop/config/ipc/channel-manifest.js
 M packages/desktop/main.js
 M scripts/desktop-ipc-handlers.test.mjs
?? .pipeline/core-unit-report.json
?? .pipeline/release-traceability.md
?? packages/desktop/config/ipc/update-handlers.js
?? scripts/desktop-local-e2e-smoke.cjs
?? scripts/write-release-traceability.cjs
```

## remotes
```
origin	https://github.com/xvyimu/prompt-optimizer.git (fetch)
origin	https://github.com/xvyimu/prompt-optimizer.git (push)
upstream	https://github.com/linshenkx/prompt-optimizer.git (fetch)
upstream	https://github.com/linshenkx/prompt-optimizer.git (push)
```

## source file hashes (sha256)

- `packages/desktop/main.js`: `34f573520afea224654d0cc9fc0c72b2e4b5824dd24cb3084429375cb5f2b57b`
- `packages/desktop/preload.js`: `1856deece0aa709d4fbef39d1ce444db602443f2deed478940ff8d28c2c3d58d`
- `packages/desktop/remote-storage.js`: `e5eef5fe9fa2ca78a845904c043759b892cfe2df9f207881390962cd1b7d1279`
- `packages/desktop/config/ipc/channel-manifest.js`: `6725db2745b459fc7d1d1192d5152048fa8b69b7411c3f5a457edb8f6522eb39`
- `packages/desktop/config/ipc/update-handlers.js`: `ec1f4f50fd5aaa5d1433bf5a33542bd4e4b3049ff21deb60d7ef989411c2e27d`
- `packages/core/dist/index.cjs`: `d894fcd1e0d164e67b49c881453cacf86ff376a019362757f94e46583a76ea2e`
- `packages/core/dist/electron.cjs`: `2d313986fde639047be0de21ebfac504e4db2d3fad3546b0c20c70e44cdc07c3`
- `packages/desktop/web-dist/index.html`: `6591d5b612fb1d688528687af0f4285925bd56584e9be702cc18ea7775354cd7`

## installed app hashes (if present)

- `D:/PromtOptimizer/PromptOptimizer/PromptOptimizer.exe`: `e23f337264707f66d30ab60183812ee52f3748e1716d087b9b5999f0593b1d45`
- `D:/PromtOptimizer/PromptOptimizer/resources/app/main.js`: `34f573520afea224654d0cc9fc0c72b2e4b5824dd24cb3084429375cb5f2b57b`
- `D:/PromtOptimizer/PromptOptimizer/resources/app/preload.js`: `1856deece0aa709d4fbef39d1ce444db602443f2deed478940ff8d28c2c3d58d`
- `D:/PromtOptimizer/PromptOptimizer/resources/app/config/ipc/channel-manifest.js`: `6725db2745b459fc7d1d1192d5152048fa8b69b7411c3f5a457edb8f6522eb39`
- `D:/PromtOptimizer/PromptOptimizer/resources/app/node_modules/@prompt-optimizer/core/dist/electron.cjs`: `2d313986fde639047be0de21ebfac504e4db2d3fad3546b0c20c70e44cdc07c3`

## notes

- 当前安装为 resources/app 热替换，不是 electron-builder 签名安装包。
- 完整签名链需正式 package + Authenticode；本文件仅提供本地可复查 hash。
