---
name: prompt-optimizer-compare
description: 用提示词优化器 MCP 在桌面或浏览器的已配置模型上对照提示词，核对各候选原始回答，保存或找回运行成果。
---

# 提示词对照

1. 用 `po_sources_list` 选资料来源，默认使用桌面。浏览器资料按来源 ID 选择，同域名的不同浏览器或配置文件可以各有一份数据。离线时用 `po_sources_authorize` 重连。用 `po_sources_open` 打开来源，执行或保存用 `access: "write"`，回看用 `read`。
2. 用 `po_query(domain="models", operation="getEnabledModels")` 查看本来源的模型，选用返回的配置 `id` 作为 `modelKey`。使用同一配置下其他模型时，可先用 `model-list` 运行查询该提供商的模型 ID。按产品已有格式生成选择值：`"text-selection:v1:" + encodeURIComponent(JSON.stringify([配置ID, 模型ID]))`。需要选择收藏时查询 `assets.listAssets`、`assets.listAssetVersions`、`assets.getAssetVersion`；`po_query` 的参数为 `domain`、`operation` 和位置参数数组 `arguments`。在结果分页时跟随游标。确认要比较的版本、模型和共用变量。
3. 用 `po_runs_start` 发起一次 `test-batch`。传入连接 ID、最近查询返回的顶层 `revision` 作为 `expectedRevision`、一个可在原样重试时复用的 `requestKey`。每个候选填自己的 `modelKey`。双模型对照共享同一提示词和变量，双提示词对照共享同一模型和变量。已有版本使用其收藏条目的修订，草稿可直接传 `userPrompt`。例如以下是 `input` 的结构，占位值均须从当前来源替换。

```json
{
  "kind": "test-batch",
  "request": {
    "candidates": [
      { "modelKey": "<模型 A 的 key>", "promptField": "userPrompt", "source": { "favoriteId": "<收藏>", "assetId": "<资产>", "versionId": "<版本>", "expectedRevision": "<资产修订>" }, "variables": { "topic": "月亮" } },
      { "modelKey": "<模型 B 的 key>", "promptField": "userPrompt", "source": { "favoriteId": "<同一收藏>", "assetId": "<同一资产>", "versionId": "<同一版本>", "expectedRevision": "<同一资产修订>" }, "variables": { "topic": "月亮" } }
    ]
  }
}
```

4. 用 `po_runs_get(connectionId, runId)` 读取返回的 `id`，直到运行结束。按候选顺序核对 `input.executionModels`、冻结的输入和每一项 `output[].status/output/reasoning/error`。保留原始回答，解释单项失败或取消。选用本机或自定义提供商时走相同流程。
5. 用户要求保存时调用 `po_runs_save`，再按同一个 ID 回读。已保存结果可通过 `po_runs_list(savedOnly=true)` 和 `po_runs_get` 找回，需要写入产品长期记录的提示词可通过 `po_mutate` 存入「收藏夹」或以 `target: "history"` 将优化结果存入「历史记录」。最后关闭本次连接。
