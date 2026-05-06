# Changelog

Full release narratives now live in versioned files under `releases/`. This file stays as the index and summary entry point.

## [2.10.3] - 2026-05-06
- EN: This patch adds a best-effort LLM image-input compatibility layer so non-standard input formats can be converted to PNG before provider requests without changing stored assets. See [Release Notes (EN)](releases/v2.10.3.en.md).
- 中文：本次补丁新增 LLM 输入图片格式兼容层，在不改变已保存素材的前提下，尽力将非标准输入格式转为 PNG 后再请求模型。参见 [版本说明（中文）](releases/v2.10.3.zh-CN.md)。

## [2.10.2] - 2026-05-06
- EN: This patch clarifies Prompt Optimizer and Prompt Garden positioning, adds a bilingual Prompt Garden image workflow tutorial, and fixes optional prompt-asset variable handling. See [Release Notes (EN)](releases/v2.10.2.en.md).
- 中文：本次补丁澄清 Prompt Optimizer 与 Prompt Garden 的产品定位，新增双语 Prompt Garden 图像工作流教程，并修复可选提示词资产变量处理。参见 [版本说明（中文）](releases/v2.10.2.zh-CN.md)。

## [2.10.1] - 2026-05-04
- EN: This patch adds a comprehensive MkDocs documentation site with bilingual support, fixes Pro workspace actions broken by RouterView refactoring, corrects Prompt Garden nav paths, and updates project landing page copy. See [Release Notes (EN)](releases/v2.10.1.en.md).
- 中文：本次补丁新增完整的 MkDocs 双语文档站，修复 RouterView 重构导致的 Pro 工作区操作失效，修正 Prompt Garden 导航路径，并更新项目落地页文案。参见 [版本说明（中文）](releases/v2.10.1.zh-CN.md)。

## [2.10.0] - 2026-05-03
- EN: This release standardizes prompt model/session structures, turns favorites into resource-aware prompt assets, adds Prompt Garden discovery/import/favorite flows, expands resource-complete backups, and improves desktop IPC reliability. See [Release Notes (EN)](releases/v2.10.0.en.md).
- 中文：本次发布标准化提示词模型与会话结构，将收藏升级为资源感知的提示词资产，加入 Prompt Garden 发现 / 导入 / 收藏流程，扩展资源完整备份，并提升桌面端 IPC 可靠性。参见 [版本说明（中文）](releases/v2.10.0.zh-CN.md)。

## [2.9.6] - 2026-04-27
- EN: This release enhances favorites with reproducibility example editing, media management, and one-click example application to workspace sessions. See [Release Notes (EN)](releases/v2.9.6.en.md).
- 中文：本次发布增强收藏功能，支持可复现性示例编辑、媒体管理，以及一键将示例应用到工作区会话。参见 [版本说明（中文）](releases/v2.9.6.zh-CN.md)。

## [2.9.5] - 2026-04-24
- EN: This patch adds a workspace-wide clear-content tool, makes Prompt Garden imports start from a clean workspace state, restores missing DeepSeek parameter and import-failure localization, and keeps Trellis workspace artifacts ignored. See [Release Notes (EN)](releases/v2.9.5.en.md).
- 中文：本次补丁新增工作区“清理内容”工具，让 Prompt Garden 导入先清场再写入新内容，补齐 DeepSeek 参数与导入失败提示的本地化，并忽略 Trellis 工作区产物。参见 [版本说明（中文）](releases/v2.9.5.zh-CN.md)。

## [2.9.4] - 2026-04-20
- EN: This release improves image workflow reliability with restored image-to-image session persistence, aligns Seedream model metadata and built-in defaults with current capabilities, adds OpenAI Responses request-style support, and makes desktop/local release flows more robust. See [Release Notes (EN)](releases/v2.9.4.en.md).
- 中文：本次发布修复了图生图会话恢复、按最新能力校准了 Seedream 模型元数据与内置默认项，补上 OpenAI Responses 请求风格支持，并让桌面端本地直连与 Release 发布链路更稳。参见 [版本说明（中文）](releases/v2.9.4.zh-CN.md)。

## [2.9.3] - 2026-04-10
- EN: This release establishes an English-first locale baseline, restores localized user feedback across key UI workflows, hardens MCP and repository guardrails, and extracts evaluation prompt assets into maintainable modules. See [Release Notes (EN)](releases/v2.9.3.en.md).
- 中文：本次发布建立了 English-first locale 基线，补回关键 UI 流程的本地化反馈，并加固了 MCP、仓库守护校验与评估模板资产结构。参见 [版本说明（中文）](releases/v2.9.3.zh-CN.md)。

## [2.9.2] - 2026-04-07
- EN: This release fixes the desktop updater path for both stable and prerelease downloads, hardens invalid preference-key handling, and expands the bilingual image workflow documentation. See [Release Notes (EN)](releases/v2.9.2.en.md).
- 中文：本次发布修复了桌面端正式版与预览版下载更新链路，强化了无效偏好键处理，并补充了双语图像工作流文档。参见 [版本说明（中文）](releases/v2.9.2.zh-CN.md)。

## [2.9.1] - 2026-04-06
- EN: This hotfix restores a more visible remove affordance in the multi-image upload area, replacing the footer text action with a clearer top-right icon button. See [Release Notes (EN)](releases/v2.9.1.en.md).
- 中文：本次热修复让多图上传区域的删除入口重新变得更直观，用更明显的右上角图标按钮替代底部文字按钮。参见 [版本说明（中文）](releases/v2.9.1.zh-CN.md)。

## [2.9.0] - 2026-04-06
- EN: End-to-end multi-image generation, stronger storage safety and favorite asset handling, and a clearer data manager storage overview. See [Release Notes (EN)](releases/v2.9.0.en.md).
- 中文：本次发布带来端到端多图生图、更稳健的存储安全与收藏资源治理，以及更清晰的数据管理存储概览。参见 [版本说明（中文）](releases/v2.9.0.zh-CN.md)。

## [2.8.0] - 2026-04-03
- EN: Text-to-image evaluation, smoother reference-image workflows, and stronger Cloudflare-backed model support. See [Release Notes (EN)](releases/v2.8.0.en.md).
- 中文：本次发布聚焦文生图评估、更顺畅的参考图工作流，以及更稳健的 Cloudflare 模型支持。参见 [版本说明（中文）](releases/v2.8.0.zh-CN.md)。

## [2.7.0] - 2026-03-25
- EN: Structured compare evaluation, smoother compare UX, and refreshed docs and website surfaces. See [Release Notes (EN)](releases/v2.7.0.en.md).
- 中文：本次发布聚焦结构化对比评估、更顺畅的对比体验，以及焕新的文档与站点展示。参见 [版本说明（中文）](releases/v2.7.0.zh-CN.md)。

## [2.6.3] - 2026-03-22
- EN: Image prompt extraction, stronger image understanding, and a safer desktop release pipeline. See [Release Notes (EN)](releases/v2.6.3.en.md).
- 中文：本次发布带来图像提示词提取、更强的图像理解能力，以及更稳健的桌面端发布链路。参见 [版本说明（中文）](releases/v2.6.3.zh-CN.md)。

## [2.6.2] - 2026-03-15
- EN: Reworked evaluation architecture, cleaner workspace/result/compare flows, and more stable variable handling. See [Release Notes (EN)](releases/v2.6.2.en.md).
- 中文：本次发布重构了评估架构，梳理了工作区 / 结果 / 对比流程，并让变量处理更稳定。参见 [版本说明（中文）](releases/v2.6.2.zh-CN.md)。

## [2.6.1] - 2026-03-12
- EN: Better model management, richer image generation metadata, and stronger custom model configuration support. See [Release Notes (EN)](releases/v2.6.1.en.md).
- 中文：本次发布改进了模型管理、补充了更丰富的图像生成元数据，并增强了自定义模型配置能力。参见 [版本说明（中文）](releases/v2.6.1.zh-CN.md)。

## [2.6.0] - 2026-03-09
- EN: MiniMax provider support, stronger model management, and more usable temporary-variable and XML inspection workflows. See [Release Notes (EN)](releases/v2.6.0.en.md).
- 中文：本次发布带来 MiniMax provider 支持，进一步强化了模型管理，也让临时变量与 XML 检查体验更顺手。参见 [版本说明（中文）](releases/v2.6.0.zh-CN.md)。

## [2.5.5] - 2026-03-01
- EN: Media-aware favorites, Prompt Garden asset imports, and more durable preview storage. See [Release Notes (EN)](releases/v2.5.5.en.md).
- 中文：本次发布让收藏夹支持媒体内容、Prompt Garden 资源导入，并让预览资源存储更可靠。参见 [版本说明（中文）](releases/v2.5.5.zh-CN.md)。

## [2.5.4] - 2026-02-10
- EN: Feedback-driven evaluation, stronger parsing robustness, and smoother analyze interactions. See [Release Notes (EN)](releases/v2.5.4.en.md).
- 中文：本次发布强化了反馈驱动评估、结果解析鲁棒性，以及分析交互体验。参见 [版本说明（中文）](releases/v2.5.4.zh-CN.md)。

## [2.1.0] - 2025-01-19

### 🎉 Added - 收藏管理重构 (Favorite Management Refactor)

#### 🏗️ 核心架构改进
- **三层分类体系**:
  - `functionMode`: `basic | context | image` (必填)
  - `optimizationMode`: `system | user` (basic模式)
  - `imageSubMode`: `text2image | image2image` (image模式)
  - **Category**: 主题分类 (学习研究、日常助手等)
- **元数据重组**: `originalContent` 和 `sourceHistoryId` 移至 `metadata` 对象
- **TypeMapper 工具类**: 自动从历史记录类型推断功能模式

#### 🏷️ 独立标签库系统
- **标签全生命周期管理**: 重命名、合并、删除、统计
- **智能标签自动完成**: 基于使用频率的建议排序
- **独立标签存储**: 支持零使用次数的标签

#### 📁 分类管理增强
- **分类排序**: 支持上移/下移调整顺序
- **使用统计**: 计算每个分类的收藏数量
- **删除保护**: 有收藏的分类无法删除
- **颜色标识**: 支持自定义分类颜色

#### 🎨 UI 组件重构
- **SaveFavoriteDialog**: 统一的创建/编辑对话框，支持功能模式选择
- **TagManager**: 完整的标签管理界面
- **CategoryManager**: 分类管理界面，支持颜色选择和排序
- **标签自动完成**: `useTagSuggestions` + `NAutoComplete` 集成

#### 🔄 向后兼容性
- **数据迁移**: 自动检测和迁移旧数据
- **渐进式迁移**: 保留现有分类，不强制迁移

### 💔 Breaking Changes
- **移除 `isPublic` 字段**: 单机应用中无意义的公开字段
- **`FavoritePrompt` 接口变更**: `functionMode` 变为必填，`metadata` 结构重组

### 📝 Migration Guide
系统会自动检测旧数据并迁移，所有现有收藏保持不变，向后兼容。

### 🐛 Bug Fixes
- 修复导入导出数据完整性问题
- 修复标签计数不准确问题
- 修复E2E测试中遮罩层拦截点击问题

---

## [2.0.0] - 2025-01-XX

### 🎉 Initial Release
- 基础收藏管理功能
- 优化历史集成
- 标签和分类基础支持
- 导入导出功能
