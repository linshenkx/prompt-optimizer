# Prompt Optimizer MCP

在 Codex、Claude Desktop 等 AI 助手里使用你已有的提示词优化器。你可以贴入提示词，也可以从收藏中选一条，用自己配置的模型优化、对照测试并评估结果。满意后，可以把优化结果存入历史记录，或把定稿加入收藏。

> 帮我优化这句提示词：“把工作记录写成周报。”用同一个模型分别测试原版和新版。工作记录是“周一修复登录超时，周三上线，周五收到两条用户反馈”。把两份周报放在一起给我看。

## 接入 AI 助手

从 `0.2.0-beta.4` 起，使用 Node.js 24、25 或 26，在 MCP 客户端填写以下 `stdio` 启动命令。

```sh
npx -y @prompt-optimizer/mcp-server@beta
```

如果客户端分开填写，命令填 `npx`（Windows 可用 `npx.cmd`），参数依次填 `-y` 和 `@prompt-optimizer/mcp-server@beta`。

## 使用桌面资料

MCP 默认使用本机桌面版已有的资料。关闭桌面应用也能优化、测试和保存。操作桌面图片库或导入导出完整 ZIP 备份时，需要打开 Windows 桌面应用。

如果手上有一份已初始化的桌面资料，可以在启动命令末尾追加 `--desktop-profile=<绝对目录>`。只要目录里有这份资料，即使没有安装桌面版，也能继续使用其中的模型、收藏和历史。

## 使用网页版

网页版把收藏、历史和模型配置保存在当前浏览器个人资料的 IndexedDB 中。**即使网址相同，Chrome 的「工作」、Chrome 的「个人」和 Edge 也各有一份资料。** 在同一份浏览器个人资料里，网站按协议、主机和端口区分。只改变网址路径通常仍使用同一份资料。

1. 把支持 MCP 连接的提示词优化器完整网址告诉助手。自部署的网站也可以。想默认使用这个站点，可以在启动命令末尾追加 `--product-url=<网址>`。
2. 在运行 MCP 的同一台电脑上，用存有目标资料的浏览器和个人资料打开助手给出的链接。可以为来源取名，例如「Chrome 工作」，然后点「允许连接」。
3. 读写期间保持授权标签页打开。关页后，这份资料会在已授权来源中显示为离线。下次告诉助手「使用 Chrome 工作」，在原来的浏览器个人资料中打开新链接即可继续读写。

网页连接无需为 Windows、macOS 或 Linux 配置浏览器的磁盘路径。Windows 上已验证 Chrome、Edge 和 Firefox 的读写与资料隔离，其中 Firefox 使用 Playwright 构建。macOS（含 Safari）和 Linux 尚待同等实机验证。

[桌面与浏览器使用指南](https://github.com/linshenkx/prompt-optimizer/blob/develop/docs/user/desktop-mcp.md)
