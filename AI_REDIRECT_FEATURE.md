# AI跳转功能

## 功能概述

新增了AI平台跳转功能，用户在优化完提示词后可以一键跳转到指定的AI平台（如OpenAI、Gemini、DeepSeek等）并自动复制优化后的内容。

## 主要特性

- 🚀 **一键跳转**: 支持跳转到多个主流AI平台
- 📋 **自动复制**: 自动将优化后的提示词复制到剪贴板
- 🔄 **对话续接**: 支持在现有对话中继续（未来扩展）
- ⚙️ **可配置**: 支持自定义跳转配置

## 支持的AI平台

- OpenAI (ChatGPT)
- Google Gemini
- DeepSeek
- 智谱GLM
- Claude
- 自定义平台

## 技术实现

### 核心服务
- `AiRedirectService`: 跳转逻辑核心服务
- `DefaultUrlBuilder`: URL构建器，负责为不同平台构建正确的跳转链接

### UI集成
- 在`OutputDisplayCore`组件中添加了跳转按钮
- 支持加载状态和错误处理
- 响应式设计，适配不同屏幕尺寸

### 类型安全
- 完整的TypeScript类型定义
- 支持配置验证和错误处理

## 使用方法

1. 完成提示词优化
2. 点击输出区域的"跳转到AI平台"按钮
3. 系统自动打开选定的AI平台并复制内容

## 文件变更

- `packages/core/src/services/ai-redirect/`: 新增AI跳转服务
- `packages/ui/src/components/OutputDisplayCore.vue`: 集成跳转按钮
- `packages/web/src/App.vue`: 主应用集成
- 其他相关组件的小幅调整

## 向后兼容

此功能为纯新增功能，不影响现有任何功能的使用。所有现有API和用户界面保持不变。
