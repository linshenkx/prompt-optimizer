# Release Traceability

- generatedAt: 2026-07-18T08:28:45.717Z
- branch: `work/desktop-hardening-on-develop`
- commit: `d06ab910b014a09f38bcb6546f07cecb99b93446`
- fork: https://github.com/xvyimu/prompt-optimizer
- upstream: https://github.com/linshenkx/prompt-optimizer

## git status
```
## work/desktop-hardening-on-develop...origin/work/desktop-hardening-on-develop
```

## remotes
```
origin	https://github.com/xvyimu/prompt-optimizer.git (fetch)
origin	https://github.com/xvyimu/prompt-optimizer.git (push)
upstream	https://github.com/linshenkx/prompt-optimizer.git (fetch)
upstream	https://github.com/linshenkx/prompt-optimizer.git (push)
```

## source file hashes (sha256)

- `packages/desktop/main.js`: `5e4c97397076d23d2e088f7c15a6f9949324e12aec0306edde2151e149cedab0`
- `packages/desktop/preload.js`: `1856deece0aa709d4fbef39d1ce444db602443f2deed478940ff8d28c2c3d58d`
- `packages/desktop/remote-storage.js`: `e5eef5fe9fa2ca78a845904c043759b892cfe2df9f207881390962cd1b7d1279`
- `packages/desktop/config/ipc/channel-manifest.js`: `6725db2745b459fc7d1d1192d5152048fa8b69b7411c3f5a457edb8f6522eb39`
- `packages/desktop/config/ipc/update-handlers.js`: `ff494c43e3c6ce0d0521184cf44080f6253a3496396cc5fe2b5a0bdb137461e3`
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
