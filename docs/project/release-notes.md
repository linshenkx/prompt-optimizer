# 版本说明与 Release 发布

## 目标

从当前流程开始，仓库内的版本说明文件是 GitHub Release 正文的唯一事实来源。

- `CHANGELOG.md`：版本索引与摘要入口
- `releases/vX.Y.Z.en.md`：某个版本的英文完整说明
- `releases/vX.Y.Z.zh-CN.md`：某个版本的中文完整说明
- `.github/workflows/release.yml`：读取两个版本文件，生成 GitHub Release 摘要正文

## 文件约定

每次发布都需要同时维护两处内容：

1. `CHANGELOG.md`
   - 顶部必须是当前版本
   - 必须包含一行英文摘要和一行中文摘要
   - 必须分别链接到 `releases/vX.Y.Z.en.md` 和 `releases/vX.Y.Z.zh-CN.md`

2. `releases/vX.Y.Z.en.md`
   - 标题固定为 `# Prompt Optimizer vX.Y.Z`
   - 必须包含 `## Summary`
   - 必须包含以下完整栏目：
     - `## Highlights`
     - `## Product Updates`
     - `## Fixes`
     - `## Breaking Changes / Upgrade Notes`
     - `## Developer Notes`

3. `releases/vX.Y.Z.zh-CN.md`
   - 标题固定为 `# Prompt Optimizer vX.Y.Z`
   - 必须包含 `## 概括`
   - 必须包含以下完整栏目：
     - `## 亮点`
     - `## 产品更新`
     - `## 修复`
     - `## 破坏性变更 / 升级说明`
     - `## 开发者说明`

`Summary / 概括` 为正式发布必填项；GitHub Release 正文会嵌入完整英文和中文版本说明，并保留安装文档与仓库版本说明链接。

## 常用命令

```bash
# 1. 生成当前版本的版本说明模板
pnpm release:notes:new

# 或者显式指定版本
pnpm release:notes:new 2.9.0

# 2. 校验当前版本说明
pnpm release:notes:check

# 或者显式指定版本
pnpm release:notes:check v2.9.0

# 3. 校验历史版本条目（用于回填旧版本 release 文档）
pnpm release:notes:check:entry v2.6.0
```

`release:notes:new` 会同时生成英文和中文模板，并附带一段仅供编辑参考的 commit 草稿区。
`release:notes:check` 用于正式发布前的硬门槛校验，要求目标版本必须位于 `CHANGELOG.md` 顶部。
`release:notes:check:entry` 用于历史版本回填，只要求 `CHANGELOG.md` 中存在对应版本条目，不要求它在顶部。

## 推荐发布流程

预览版与正式版都遵循[发布渠道与版本身份规则](release-channels.md)：根版本、桌面版本、扩展显示版本与已存在的标签必须一致。首个移动端预览建议使用 `2.12.0-beta.1`；`version:sync` 会将扩展的数字版本和预览显示名称分开。手动运行 Release 必须选择与该版本标签相同的提交。

```bash
# 1. 更新版本号，先不创建标签
pnpm version patch --no-git-tag-version
# 预览版则显式指定，例如：pnpm version 2.12.0-beta.1 --no-git-tag-version

# 2. 生成版本说明模板
pnpm release:notes:new

# 3. 手动完善 releases/vX.Y.Z.en.md 与 releases/vX.Y.Z.zh-CN.md，
#    并更新 CHANGELOG.md 顶部摘要

# 4. 校验版本说明
pnpm release:notes:check

# 5. 核对并提交版本文件、说明和代码，再创建 tag（标签必须包含这些提交）
# version 生命周期会暂存文件，提交前务必检查 git diff --cached
pnpm version:tag

# 6. 推送 tag
pnpm version:publish
```

## 校验规则

以下情况会导致 `pnpm release:notes:check` 失败：

- 缺少对应版本的英文或中文 release 文件
- 标题版本号与文件名不一致
- 缺少 `## Summary` 或 `## 概括`
- 必需栏目缺失或顺序错误
- `CHANGELOG.md` 顶部不是当前版本
- `CHANGELOG.md` 顶部没有同时链接英文和中文版本说明
- 正文中仍然存在 `TODO`、`TBD`、`待补充`、`XX` 等占位内容

对于历史版本回填，可以使用 `pnpm release:notes:check:entry <version>`。它会沿用同样的正文结构校验，但把 `CHANGELOG.md` 校验范围放宽为“存在对应版本条目”。

## GitHub Release 行为

Release 流程统一编排桌面、扩展和 Docker 镜像，并校验它们来自相同源码提交。预览镜像只使用完整预览版本标签，正式版本才更新 latest。主分支 push 不再独立发布 Docker；发布失败时的部分产物恢复边界见[发布渠道](release-channels.md)。

发布工作流不会再从 commit 列表自动拼接公开正文，而是优先读取：

- `releases/vX.Y.Z.en.md`
- `releases/vX.Y.Z.zh-CN.md`

然后生成：

- 英文区块
  - 完整英文版本说明（去掉文件标题和草稿注释，并将标题层级下调一级）
  - 安装文档链接
  - 英文仓库版本说明链接
- 中文区块
  - 完整中文版本说明（去掉文件标题和草稿注释，并将标题层级下调一级）
  - 安装文档链接
  - 中文仓库版本说明链接
- 末尾轻量 macOS 备注

末尾 macOS 备注可以完整说明隔离属性的现象和处理命令；因为它放在正文最后，不会压过主要版本内容。

正式发布流程仍要求 `Summary / 概括` 存在，方便用户快速扫描，也保证版本说明结构一致。

`workflow_dispatch` 中手动输入的 `version` 仍然用于“当前所选 ref 上准备发布的版本”，不是用来从当前主干回补任意历史版本的重新发布。

如果版本说明校验失败：

- 构建任务不会继续执行
- GitHub Release 不会创建成功
