# 发布版本与镜像渠道

本规则覆盖桌面/扩展 GitHub Release 和 Docker Hub、阿里云镜像。发布入口统一为 `.github/workflows/release.yml`，`docker.yml` 仅作为其可复用工作流；不再因主分支测试完成而自动推送镜像，也不提供绕过测试的独立 Docker 手动发布。

## 版本身份

`scripts/release-channel.js` 统一校验版本和渠道：

- 版本标签必须已存在，且解析到本次 Actions 检出的提交。手动运行也必须选择该标签或指向同一提交的 ref；不能用旧标签搭配新分支代码。
- 根 package、桌面 package 与标签中的完整版本必须一致。版本说明和 CHANGELOG 仍由原有校验器检查。
- 所有带预发布后缀的版本均是预发布，包括 alpha、beta、rc、preview、hotfix；不会按关键词漏判为稳定版。正式修复版本应使用新的三段数字版本，不使用 `-hotfix` 绕过渠道规则。
- 不支持带 `+build` 的版本，避免 Docker 标签格式与 GitHub 版本不一致；非法版本、换行、前导零和超出扩展版本范围的数字会被拒绝。
- 已公开的 Release 不允许同版本重建覆盖；失败且仍为 Draft 的版本可以在原标签提交上重试。需要修改源码时使用新版本。
- Draft 准备、镜像发布及最终公开前分别重新读取远端版本状态；只重跑失败任务也不能跳过旧版本/已公开版本保护。
- 稳定版必须高于已公开稳定版本，避免手动补发旧版本使 latest 回退。所有 Release 运行串行执行，不中断已开始的发布；GitHub 并发队列并非无限队列，需留意连续触发时的 pending 状态。

## 产物规则

| 版本例子 | GitHub | Docker Hub / 阿里云 | 扩展 manifest |
| --- | --- | --- | --- |
| `2.12.0-beta.1` | prerelease=true、latest=false | 仅 `:2.12.0-beta.1` | version=`2.12.0`，version_name=`2.12.0-beta.1` |
| `2.12.0-rc.1` | prerelease=true、latest=false | 仅 `:2.12.0-rc.1` | version=`2.12.0`，version_name=`2.12.0-rc.1` |
| `2.12.0` | prerelease=false、latest=true | `:2.12.0`，验证后提升 `:latest` | version=`2.12.0`，移除旧 version_name |

预览版不使用可漂移的 `beta` 别名。使用者显式拉取完整版本号，稳定版 latest 保持不变。

扩展数字版本与显示版本分离遵循 [Chrome Manifest 版本规则](https://developer.chrome.com/docs/extensions/reference/manifest/version)。同一目标版本的多个预览 ZIP 供手动测试，不用于 Chrome Web Store 的自动升级顺序；预览与正式包的数字版本相同，不承诺从 beta 自动升级为正式包。现有工作流不自动上传商店。

桌面运行时的默认 `allowPrerelease=false` 保持不变，用户可沿用既有设置选择预览更新。GitHub provider 继续使用现有更新描述文件方式，不把 Docker 的 latest 别名规则误套到 Release 内的 `latest*.yml` 文件名；预览 Release 的 isPrerelease 标记负责稳定用户隔离。

## 执行顺序与失败处理

1. 校验标签、实际提交、各端版本以及中英文说明。
2. 运行现有测试工作流，创建或恢复 Draft。
3. Windows、macOS、Linux、扩展从已验证 SHA 打包并上传 Draft 产物。
4. 所有端成功后，同一个 Docker 构建向两个仓库推送版本镜像，覆盖 linux/amd64 和 linux/arm64，并写入版本、提交 OCI 标签。
5. 两个仓库的版本标签必须解析为构建返回的同一摘要。正式版才将同一摘要提升为各仓库的 latest，并再次校验；预览版跳过提升。
6. 镜像流程成功后，才公开 GitHub Release，明确设置预发布与 latest 属性，并校验元数据与产物。

摘要提升采用 [Buildx imagetools](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/) 对已有多架构索引复制，避免为 latest 重新构建镜像。

**两个镜像仓库与 GitHub 之间没有分布式原子事务。** 若第二个仓库推送/提升失败，第一个可能已经成功；流程必须失败并保留 Draft，不能把部分发布写成成功。查看构建摘要和已更新的标签，在同一未公开版本上修复重试；镜像全部成功但公开 Release 的请求失败时，同样先检查远端真实状态。若 Release 已公开，不重新运行构建覆盖它，修正元数据需单独处理或使用新版本。

## 本地检查与发布边界

- `pnpm test:repo` 纳入发布策略、真实临时 Git 标签、版本同步、结构化 Actions 依赖及发布说明回归。
- 回归直接执行工作流中的镜像校验/提升 shell，使用隔离的 Docker 命令替身验证摘要不一致时停止，避免测试向镜像仓库写入。
- 使用 actionlint 验证三份 Actions 文件；本地检查不等于 GitHub runner、多架构交叉构建和双仓库推送已经验收。
- 渠道规则整理阶段只修改发布配置、脚本、测试和文档，根版本当时保持 2.11.13。随后按用户授权准备为 2.12.0-beta.1，说明移至正式路径；仍未创建发布标签、推送、运行线上 Actions 或发布镜像。

2026-10-23 本地结果：仓库入口 93 项全部通过，无跳过；发布策略 18 项（包含在上述总数中）在补充实际 CLI 输出断言后再次通过。actionlint 1.7.12 检查 Release、Docker 和 Test 三份工作流通过；冻结锁文件检查、语言检查和 diff 空白检查通过。beta 中英文草稿在隔离目录通过正式结构校验及正文生成。另以只读方式确认 Buildx 的摘要提取表达式可读取官方 Nginx 镜像；未执行真实镜像推送。

日志：本地 `.codex-run/release-channels-repo-tests.log`；隔离正文：`.codex-run/mobile-pwa-release-preparation-20261023/beta/github-release-body-preview.md`。actionlint 二进制使用官方校验和核验后存于 Git 忽略目录；没有加入发布包。
