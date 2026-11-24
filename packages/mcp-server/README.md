# Prompt Optimizer MCP

让 AI 助手使用你在提示词优化器中配置的模型，优化提示词、测试输出，在顶部「MCP 运行成果」回看保存的对照。

## 接入 MCP 客户端

安装 Node.js 24.22.1 或更高的 24.x 版本，在客户端添加一个 stdio 服务，启动命令如下。Windows 使用 `npx.cmd`。

```sh
npx --yes --package=@prompt-optimizer/mcp-server@beta prompt-optimizer-product-mcp
```

- 默认使用**桌面资料**，关闭桌面应用也能优化和测试。可追加 `--desktop-profile=<绝对目录>` 选择其他资料。
- 使用**浏览器资料**时，把产品网址告诉助手，在存有目标资料的浏览器中打开授权链接，连接期间保持标签页开启。可追加 `--product-url=<网址>` 设为默认来源。

连接后，试着问助手「列出我的模型和收藏，让我选一条提示词，用两个模型测试并保存对照结果。」

[桌面与浏览器使用指南](../../docs/user/desktop-mcp.md) · [旧版命令 prompt-optimizer-mcp](../../docs/user/mcp-server.md)
