---
name: prompt-optimizer-compare
description: 用提示词优化器 MCP 对照变量工作区的提示词，支持同一收藏版本跑两个已配置的文本模型，或用同一个已配置模型跑两版提示词。用户要求执行对照、核对原始输出、保存或找回已保存比较时使用。
---

# 提示词对照

使用新版提示词优化器 MCP。在用户指定比较方式、提示词、模型和变量时按其要求执行。

1. 用 `po_sources_list` 查看桌面资料、已授权网页和默认来源。用户未指定来源时使用默认来源。用户可指定桌面资料或产品网页 URL；同一 Origin 可能出现在多个浏览器或资料中，按浏览器和资料标签匹配，仍有歧义时列出选项。指定网页尚未授权时，用 `po_sources_authorize` 生成单次链接，请用户在目标浏览器资料里打开并授权。用选定的 `sourceId` 调用 `po_sources_open`，传 `access: "write"`；使用默认来源时可省略 `sourceId`。后续所有步骤用该次返回的 `connectionId`，来源断开时重新连接同一资料。
2. 用 `po_assets_list` 的 `modeKey: "pro-variable"` 与 `query` 找到收藏，匹配标题或指定 ID。用 `po_assets_list_versions` 查到确切的 `versionId`，再用 `po_assets_get_version` 核对所选版本的内容。传入对应的 `favoriteId`、`assetId` 和最新返回的资产 `revision` 作为 `expectedRevision`。用户指定「当前版本」时用 `currentVersionId`。
3. 用 `po_models_list` 查找所选的 `executable: true` 模型配置，取得 `configKey` 和 `revision`。列表有下一页时，按需用返回的游标继续查找。按用户要比较的对象组织 A、B 两项。
   - **同一提示词对照两个模型。** A、B 使用不同的 `configKey`，各自的 `expectedRevision` 取对应模型的 `revision`。两项共同使用 `source` 所选版本及变量。
   - **同一模型对照两版提示词。** A、B 使用同一个 `configKey` 和模型 `expectedRevision`。`source` 选择 A 的收藏版本，B 从同一收藏选择另一个确切版本并读取核对，再传 `candidatePrompt: {kind: "saved-version", versionId}`。用户提供临时草稿作 B 时，传 `candidatePrompt: {kind: "draft", text}`。两项使用同一份变量，临时草稿随比较结果保存。
4. 用 `po_tests_prepare` 传入 `connectionId`、`source: {favoriteId, assetId, versionId, expectedRevision}`、共用的 `variables` 和 `candidates: [{id: "a", configKey, expectedRevision}, {id: "b", configKey, expectedRevision}]`。对照提示词时加上第 3 步的 `candidatePrompt`。核对预览的模型配置、出处和展开后的输入。`request` 是 A 的输入，存在 `candidatePrompt.request` 时，它是 B 的输入。预览发现缺变量时请用户补充。用户只要求预览时返回预览。用户授权执行时，使用原 `preparedId`、`previewRevision` 和 `connectionId` 调用一次 `po_tests_execute`。模型调用可能产生费用。
5. 用 `po_tests_get` 查询同一个 `preparedId`，直到两个候选都有 `completedAt`。执行响应不确定时先查这个准备记录，避免重复发出模型请求。若还在运行，返回当前状态和继续查询所需的引用。比较两份 `output` 中可核对的差异、各自是否满足要求，并保留失败、取消和部分输出信息。以 `effective.request` 说明实际参数，缺少请求证据时标明。没有指定评价标准时，描述差异并保留判断所需的原文。
6. 用户要求保存时，两个候选结束后用 `po_comparisons_save` 保存，使用本次保存意图的唯一 `saveKey`。用返回的 `comparisonId` 调用 `po_comparisons_get`，核对两份原始输出、冻结后的输入和出处，并把 ID 给用户。保存结果不确定时，用准备阶段返回的 `comparisonId` 回查同一来源，确认前保留原 `saveKey`。

## 重开产品内的结果

用当前打开的来源和 `po_comparisons_get` 读取指定 ID 的完整记录。仅知道收藏时，可先用 `po_comparisons_list` 按 `favoriteId` 查找。在同一桌面来源或原网页的变量工作区打开 **已保存比较**，输入 `comparisonId`。用户已授权操作界面且有对应工具时，可沿此入口检查原文。根据实际查询和界面状态报告保存、回读和界面重开的结果。
