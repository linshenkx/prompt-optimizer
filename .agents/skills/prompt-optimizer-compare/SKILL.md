---
name: prompt-optimizer-compare
description: 用提示词优化器 MCP 把同一个已保存的变量工作区提示词版本交给两个已配置的文本模型，比较原始输出，按需保存并重新读取产品里的完整比较。用户要求按模型比较收藏、核对同一输入的实际输出或找回已保存比较时使用。
---

# 比较同一收藏版本的两个模型

使用 `prompt-optimizer-desktop-mcp` 的对照工具。在已授权的网页上，也可使用提供同一批工具且允许比较的网页 MCP。用户明确指定来源、收藏、版本、两个模型和变量时直接执行其要求。来源、版本或模型有歧义时，列出查询到的选项再请用户选择。

1. 用 `po_sources_list` 找到用户指定的来源。将所选 `sourceId` 交给 `po_sources_open`，指定 `access: "compare"`。核对返回的来源和 `capabilities.execute`。整个实验使用这一条 `connectionId`。使用 MCP 工具读取和保存产品数据。
2. 用 `po_assets_list` 的 `modeKey: "pro-variable"` 与 `query` 找到收藏，匹配标题或用户指定的 ID。用 `po_assets_list_versions` 查到确切的 `versionId`，再用 `po_assets_get_version` 核对内容和版本。传入对应的 `favoriteId`、`assetId` 和最新返回的资产 `revision` 作为 `expectedRevision`。用户指定「当前版本」时用 `currentVersionId`。
3. 用 `po_models_list` 匹配两个不同且 `executable: true` 的 `configKey`，各取自己的 `revision`。列表有下一页时，按需用返回的游标继续查找。
4. 用 `po_tests_prepare` 传入 `connectionId`、第 2 步核对的 `source: {favoriteId, assetId, versionId, expectedRevision}`、共用的 `variables` 和 `candidates: [{id: "a", configKey, expectedRevision}, {id: "b", configKey, expectedRevision}]`。核对预览的来源、版本、展开后的输入和两份模型设置。预览发现缺变量时请用户补充。用户只要求预览时返回预览。用户授权执行时，使用原 `preparedId`、`previewRevision` 和 `connectionId` 调用一次 `po_tests_execute`。模型调用可能产生费用。
5. 用 `po_tests_get` 查询同一个 `preparedId`，直到两个候选都有 `completedAt`。执行响应不确定时先查这个准备记录，避免重复发出模型请求。若还在运行，返回当前状态和继续查询所需的引用。比较两份 `output` 中可核对的差异、各自是否满足要求，并保留失败、取消和部分输出信息。以 `effective.request` 说明实际参数，缺少请求证据时标明。没有指定评价标准时，描述差异并保留判断所需的原文。
6. 用户要求保存时，两个候选结束后用 `po_comparisons_save` 保存，使用本次保存意图的唯一 `saveKey`。用返回的 `comparisonId` 调用 `po_comparisons_get`，核对两份原始输出、冻结后的输入和出处，并把 ID 给用户。保存结果不确定时，用准备阶段返回的 `comparisonId` 回查同一来源，确认前保留原 `saveKey`。

## 重开产品内的结果

用当前打开的来源和 `po_comparisons_get` 读取指定 ID 的完整记录。仅知道收藏时，可先用 `po_comparisons_list` 按 `favoriteId` 查找。桌面端进入同一来源的变量工作区，打开 **已保存比较**，输入 `comparisonId`。用户已授权操作界面且有对应工具时，可沿此入口打开并检查原文。根据实际查询和界面状态分别报告保存、回读和界面重开的结果。
