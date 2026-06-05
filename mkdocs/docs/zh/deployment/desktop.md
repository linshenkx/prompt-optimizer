# 桌面应用

桌面版是最适合长期使用 GlobalCloud XiaoC 的版本，尤其适合连接本地模型、自定义网关和企业内网接口。

## 为什么优先推荐桌面版

- 不受浏览器 CORS 和 Mixed Content 限制
- 连接 `http://localhost`、局域网地址和内网 API 更直接
- 与 Web 版共享主要工作区能力
- 数据保存在本机应用目录，便于备份
- 发布版内置更新检查入口，但具体更新可用性仍取决于平台和发行渠道

## 下载位置

GitHub Releases：<https://github.com/linshenkx/prompt-optimizer/releases>

当前桌面应用的产品名是 **`GlobalCloud XiaoC`**。构建产物命名模式为：

```text
GlobalCloud XiaoC-<version>-<os>-<arch>.<ext>
```

常见示例：

- Windows 安装包：`GlobalCloud XiaoC-<version>-win-x64.exe`
- Windows 压缩包：`GlobalCloud XiaoC-<version>-win-x64.zip`
- macOS 磁盘镜像：`GlobalCloud XiaoC-<version>-mac-arm64.dmg`
- Linux AppImage：`GlobalCloud XiaoC-<version>-linux-x64.AppImage`

## 安装说明

### Windows

1. 下载 `.exe` 安装包
2. 双击安装
3. 如遇 SmartScreen，选择“更多信息”后继续

### macOS

1. 下载 `.dmg`
2. 拖动到 `Applications`
3. 如首次打开被拦截，在“系统设置 -> 隐私与安全性”中允许打开

### Linux

1. 下载 `.AppImage` 或 `.zip`
2. 若使用 AppImage，先执行：

```bash
chmod +x "GlobalCloud XiaoC-<version>-linux-x64.AppImage"
```

3. 再运行该文件

## 首次使用建议

1. 打开应用
2. 进入 **模型管理**
3. 配置常用文本模型
4. 如果你使用 Ollama，优先直接选内置的 `Ollama` provider
5. 如果你使用 LM Studio、企业网关或其他 OpenAI 兼容接口，再用 `Custom`
6. 如果你要用图像模式，再配置对应的图像模型
7. 根据任务进入合适的工作区

### 连接本地模型示例

#### Ollama

```text
提供商：Ollama
Base URL：http://localhost:11434/v1
模型：qwen2.5:7b
API Key：通常可留空
```

#### LM Studio

```text
提供商：Custom
Base URL：http://localhost:1234/v1
模型：填写 LM Studio 当前暴露的模型名
API Key：任意非空字符串
```

#### 什么时候还要用 Custom

如果你的服务是下面这些情况之一，通常更适合 `Custom`：

- LM Studio
- vLLM / OneAPI / 自建网关
- 企业内网里的 OpenAI 兼容接口
- 你想手动指定特殊 Base URL 或额外参数

对于 `localhost`、私有网段和局域网里的 OpenAI 兼容接口，桌面版会在合适情况下走直接请求路径，避免被浏览器网络限制或代理路径误导；公开 HTTPS 模型平台仍可以走常规网络路径。

## 数据和日志位置

桌面版使用系统标准应用目录，目录名会跟随产品名 `GlobalCloud XiaoC`。

常见位置：

```text
Windows: %APPDATA%\GlobalCloud XiaoC\
macOS: ~/Library/Application Support/GlobalCloud XiaoC/
Linux: ~/.config/GlobalCloud XiaoC/
```

如果你主要关心日志，通常可以在以下目录找到：

```text
%APPDATA%\GlobalCloud XiaoC\logs\
```

## 什么时候不必使用桌面版

如果你只需要：

- 偶尔体验
- 连接公开的 HTTPS 模型 API
- 跨设备临时打开

那直接使用在线站或自部署 Web 版就够了。

## 常见问题

### 桌面版是不是功能和中文文档一致？

是。当前桌面版复用主应用的核心工作区与大部分功能，中文文档描述以当前实现为准。

### 桌面版一定比 Web 版快吗？

不一定，但它通常更稳定，尤其是在访问本地模型、自定义接口和复杂网络环境时。

### 桌面版的数据能迁移吗？

可以。建议优先使用应用里的 **数据管理** 做导出 / 导入，而不是直接手改应用目录。
