# 项目文档索引

欢迎来到GlobalCloud XiaoC项目文档！本文档采用分级分类的组织方式，便于不同角色的用户快速找到所需信息。

## 📚 文档分类

### 👥 [用户文档](./user/)
面向最终用户的使用指南、部署说明和常见问题
- 桌面版用户手册
- Web版使用指南
- 部署指南（Vercel等）
- 常见问题解答

### 👨‍💻 [开发者文档](./developer/)
面向开发者的技术文档、API参考和故障排查
- 技术开发指南
- 项目结构说明
- API文档
- 架构设计
- 故障排查清单

### 📋 [项目管理文档](./project/)
面向项目管理的需求文档、状态跟踪和规划
- 产品需求文档
- 项目状态和进度
- 版本管理策略
- 功能规划

### 📦 [开发过程归档](./archives/)
按功能点归档的开发记录，用于跟踪和排错
- 101-singleton-refactor - 单例模式重构 ✅
- 102-web-architecture-refactor - Web架构重构 ✅
- 103-desktop-architecture - 桌面端架构 🔄
- 104-test-panel-refactor - 测试面板重构 📋
- 105-output-display-v2 - 输出显示v2 📋
- 106-template-management - 模板管理功能 🔄

### 🛠️ [开发工作区](./workspace/)
当前开发阶段的临时文档和开发笔记
- 开发笔记和临时记录
- 待办事项
- 实验性设计
## 🚀 快速导航

### 我是用户
- 想了解如何使用 → [用户文档](./user/)
- 需要部署应用 → [部署指南](./user/deployment/)
- 遇到使用问题 → [故障排查](./developer/troubleshooting/)

### 我是开发者
- 想参与开发 → [开发者文档](./developer/)
- 需要了解架构 → [技术开发指南](./developer/technical-development-guide.md)
- 遇到开发问题 → [故障排查](./developer/troubleshooting/)
- 想了解历史 → [开发过程归档](./archives/)

### 我是项目管理者
- 了解项目状态 → [项目管理文档](./project/)
- 查看功能规划 → [产品需求文档](./project/prd.md)
- 跟踪开发进度 → [项目状态](./project/project-status.md)

## 📖 重要文档

### 核心文档
- [项目总体介绍](../README.md) - 项目概述和快速开始
- [技术开发指南](./developer/technical-development-guide.md) - 完整的技术栈和开发规范
- [项目结构](./developer/project-structure.md) - 文件和目录组织说明
- [产品需求文档](./project/prd.md) - 产品功能需求和规格

### 专项文档
- [LLM参数配置指南](./developer/llm-params-guide.md) - LLM参数配置详细说明
- [AI开发流程规范](./developer/ai-development-workflow.md) - AI辅助开发的标准化流程

## 📋 使用指南

### 新成员入职
1. 阅读[项目总体介绍](../README.md)了解项目概况
2. 查看[项目结构](./developer/project-structure.md)了解代码组织
3. 参考[技术开发指南](./developer/technical-development-guide.md)了解开发规范
4. 根据角色查看对应的文档分类

### 日常开发
1. 遵循[技术开发指南](./developer/technical-development-guide.md)中的开发规范
2. 遇到问题查看[故障排查](./developer/troubleshooting/)
3. 了解历史背景查看[开发过程归档](./archives/)

### 项目管理
1. 通过[项目状态](./project/project-status.md)了解当前进度
2. 查看[产品需求文档](./project/prd.md)了解功能规划

## 🔄 文档维护

### 维护原则
1. **分类明确**：按目标受众和用途分类存放
2. **及时更新**：代码变更时同步更新相关文档
3. **定期整理**：定期清理过期内容，整理工作区文档
4. **交叉引用**：在相关文档间建立引用关系

### 文档规范
- 使用Markdown格式
- 统一的标题层级结构
- 代码示例使用语法高亮
- 文档末尾标注更新时间

### 归档流程
- **新功能开发**：在archives/中创建新的功能点目录（从107开始编号）
- **重要经验**：及时从workspace/转移到archives/对应功能点
- **通用指南**：从临时记录整理为正式的developer/文档

---

**文档重构完成时间**：2025-07-01
**最近同步更新**：2026-05-03（同步至 v2.10.0）
**下一次整理计划**：根据开发进度定期更新