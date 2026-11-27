# 连接问题

这页只处理一类问题：

**为什么连不上模型服务。**

如果你的问题不是“连不通”，而是页面、按钮、数据状态异常，去看 [故障排除](troubleshooting.md)。

## 先判断你在哪个环境里使用

| 使用方式 | 适合连接什么 | 最常见限制 |
| --- | --- | --- |
| 在线站 / Web 版 | 公开 HTTPS API | CORS、Mixed Content |
| 本机自部署 Web | 公开 HTTPS API、本机 HTTP 接口 | 仍可能受 CORS 影响 |
| 桌面版 | 本地模型、内网 API、自定义网关 | 主要是模型配置和网络本身问题 |
| Chrome 插件 | 轻量浏览器入口 | 仍然是浏览器环境 |

## 最常见的 4 类原因

### 1. API Key 本身有问题

表现：

- `401`
- `invalid api key`
- `authentication failed`

先检查：

1. Key 有没有多余空格
2. 账户有没有额度
3. 你填的是不是对应 provider 的 Key

### 2. 模型名或 Base URL 写错

表现：

- `404`
- `model not found`
- 测试连接能过，但执行时报错

先检查：

- Base URL 是否已经带 `/v1`
- 模型名是否和服务端实际暴露的一致
- 自定义接口是否兼容 OpenAI 风格

### 3. 浏览器跨域限制

表现：

- 浏览器控制台出现 CORS 报错
- `Network Error`
- 请求根本没到模型服务

这类问题在 Web / 在线版最常见。

### 4. HTTPS 页面访问 HTTP 本地接口

表现：

- 浏览器控制台出现 Mixed Content
- 在线站无法连接 `http://localhost:...`

这是因为浏览器默认不允许 HTTPS 页面访问不安全的 HTTP 接口。

## 本地模型怎么连更稳

### Ollama

常见配置：

```text
提供商：Ollama
Base URL：http://localhost:11434/v1
模型：qwen2.5:7b
API Key：通常可留空
```

如果你已经在用内置 `Ollama` provider，就不需要再为了本地模型额外走 `Custom`。

只有在这些情况下，才更适合继续用 `Custom`：

- 你的接口不是标准 Ollama
- 你前面还有一层 OpenAI 兼容网关
- 你想手动控制特殊 Base URL 或额外参数

### Rapid-MLX

Apple Silicon 用户可选择内置 **Rapid-MLX** 提供商，运行 `rapid-mlx serve qwen3.5-4b-4bit --port 8000`，地址使用 `http://localhost:8000/v1`，获取模型列表后选择 `qwen3.5-4b-4bit`。API Key 默认留空，仅在服务端使用 `--api-key` 时填写。网页版需在启动命令中添加 `--cors-origins <当前网页来源>`（协议、域名和端口，不含路径）；默认禁用浏览器跨域访问。桌面应用无需添加 CORS 选项。

### LM Studio

常见配置：

```text
提供商：Custom
Base URL：http://localhost:1234/v1
模型：填写 LM Studio 当前模型名
API Key：任意非空字符串
```

### 结论

如果你主要用本地模型，优先选 [桌面版](../deployment/desktop.md)。

## 自定义 / 企业接口怎么连

如果你的接口是下面这些情况之一：

- 企业内网地址
- 自签名证书
- 需要公司代理
- 限制浏览器跨域

推荐顺序：

1. 桌面版
2. 你自己的网关或中转层
3. 本机 / 局域网自部署 Web

当前公开版本没有“内置代理开关”可以直接帮你绕过这些限制。

## 一张快速判断表

| 你的目标 | 推荐方案 |
| --- | --- |
| 连接 OpenAI / Gemini 这类公开 HTTPS API | 在线站或 Web 版 |
| 连接 Ollama / LM Studio | 桌面版 |
| 连接公司内网模型网关 | 桌面版优先 |
| 连接自建 OpenAI 兼容服务 | 桌面版或你自己的网关 |

## 最实用的排查顺序

1. 先点 **测试连接**
2. 再核对 Base URL 和模型名
3. 查看浏览器控制台或桌面日志
4. 判断是不是浏览器限制
5. 决定要不要换成桌面版

## 什么时候不要继续卡在这页

如果你已经能连上模型，但问题变成：

- 页面空白
- 按钮不可用
- 工作区状态不对
- 历史或设置像丢了一样

那就不再是连接问题了，去看 [故障排除](troubleshooting.md)。

## 还不行怎么办

- 先看 [常见问题](common-questions.md)
- 再看 [故障排除](troubleshooting.md)
- 如果准备反馈问题，去看 [技术支持](support.md)
