# 项目图标资产指南

本文档说明 GlobalCloud XiaoC 当前的图标资产结构、唯一源文件，以及更新图标时应同步处理的目标文件。

## 唯一源文件

当前图标体系的唯一源文件是：

- `images/logo/1024-1024.svg`

对应的位图参考文件是：

- `images/logo/1024-1024.png`

约定：

- 所有对外发布使用的图标与展示 Logo，都应从上述 SVG 导出
- 不再使用历史位图作为导出入口
- 不再在目标目录中维护独立的“第二份 SVG 源文件”

## 当前产物分组

### 1. 桌面应用图标

目录：`packages/desktop/icons/`

主要文件：

- `app-icon.ico`
- `app-icon.icns`
- `app-icon.png`
- `16x16.png`
- `24x24.png`
- `32x32.png`
- `48x48.png`
- `64x64.png`
- `128x128.png`
- `256x256.png`
- `512x512.png`
- `1024x1024.png`

说明：

- Windows 使用 `app-icon.ico`
- macOS 使用 `app-icon.icns`
- Linux 优先使用 `512x512.png` / `256x256.png`
- 这些文件是已提交的发布产物，不应被视为新的设计源文件

### 2. Chrome 扩展图标

目录：`packages/extension/public/icons/`

主要文件：

- `icon16.png`
- `icon48.png`
- `icon128.png`

额外文件：

- `packages/extension/public/favicon.ico`

说明：

- `manifest.json` 当前引用的就是这三张 PNG
- 扩展图标应与桌面端对应尺寸 PNG 保持一致

### 3. Web / 文档 / 展示 Logo

主要文件：

- `packages/web/public/favicon.ico`
- `packages/ui/src/assets/logo.png`
- `mkdocs/docs/assets/images/logo.png`
- `mkdocs/docs/assets/images/favicon.png`
- `site/public/images/logo.png`

说明：

- 这些文件面向站点、文档和应用头部展示
- 它们不是设计源文件，而是从统一源图导出的展示资产

## 历史遗留

以下旧文件已不再作为当前图标流程的一部分：

- `images/logo/v2.png`
- `images/logo/v3.png`

如果需要回溯历史设计，请从 Git 历史中查看；不要再把它们重新引入当前导出流程。

## 更新规则

当图标需要更新时，遵循以下规则：

1. 只修改 `images/logo/1024-1024.svg`
2. 从该 SVG 导出 `images/logo/1024-1024.png`
3. 同步更新桌面应用图标产物
4. 同步更新扩展图标产物
5. 同步更新 Web / UI / 文档 / 站点展示 Logo
6. 提交时将这些导出结果一并纳入版本控制

## 最低同步范围

若只做一次常规品牌更新，至少需要同步这些文件：

- `images/logo/1024-1024.svg`
- `images/logo/1024-1024.png`
- `packages/desktop/icons/*`
- `packages/extension/public/icons/*`
- `packages/extension/public/favicon.ico`
- `packages/web/public/favicon.ico`
- `packages/ui/src/assets/logo.png`
- `mkdocs/docs/assets/images/logo.png`
- `mkdocs/docs/assets/images/favicon.png`
- `site/public/images/logo.png`

## 备注

- 当前仓库中的桌面端图标、扩展图标和 Web favicon 已完成统一
- 展示类 Logo 也应继续跟随这套统一源文件更新
- 若后续引入自动化导出脚本，应继续保持 `images/logo/1024-1024.svg` 为唯一输入
