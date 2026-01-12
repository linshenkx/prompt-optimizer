# 标准化优化待办清单

本文档记录代码质量和工程规范相关的待优化事项。

## 代码格式化标准化

### Prettier 配置

**优先级**: P2 - 代码质量提升
**预估工作量**: 1-2 小时
**负责人**: 待分配
**状态**: 待开始

#### 任务描述

引入 Prettier 作为代码格式化工具，统一团队代码风格，减少 Code Review 中的格式争议。

#### 实施步骤

1. **安装依赖**
   ```bash
   pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier
   ```

2. **创建配置文件** `.prettierrc.json`
   ```json
   {
     "semi": false,
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2,
     "trailingComma": "es5",
     "arrowParens": "always",
     "endOfLine": "auto",
     "vueIndentScriptAndStyle": false
   }
   ```

3. **创建忽略文件** `.prettierignore`
   ```
   dist/
   node_modules/
   *.min.js
   *.min.css
   pnpm-lock.yaml
   ```

4. **更新 ESLint 配置** `.eslintrc.json`
   ```json
   {
     "extends": [
       "eslint:recommended",
       "plugin:prettier/recommended"
     ]
   }
   ```

5. **添加 npm 脚本** `package.json`
   ```json
   {
     "scripts": {
       "format": "prettier --write .",
       "format:check": "prettier --check ."
     }
   }
   ```

6. **配置 VS Code 自动格式化** `.vscode/settings.json`
   ```json
   {
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.formatOnSave": true,
     "[vue]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode"
     },
     "[typescript]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode"
     }
   }
   ```

7. **（可选）集成 Git Hooks**
   ```bash
   pnpm add -D husky lint-staged
   pnpm exec husky init
   ```

#### 验收标准

- [ ] 所有配置文件已创建
- [ ] `pnpm format` 可以正常运行
- [ ] VS Code 保存时自动格式化生效
- [ ] 所有现有代码已格式化（无 linting 错误）
- [ ] 团队成员已配置 IDE 自动格式化

#### 注意事项

- 首次引入需要格式化所有现有代码，建议单独提交一次"Format all code with Prettier"
- 确保 CI/CD 中添加 `format:check` 检查
- 通知团队成员更新本地 IDE 配置

---

## 日志系统标准化

### 统一日志组件

**优先级**: P2 - 开发体验优化
**预估工作量**: 4-6 小时
**负责人**: 待分配
**状态**: 待开始

#### 任务描述

创建统一的日志工具，替换项目中散落的 `console.log`，提供结构化日志、日志级别控制、性能监控等功能。

#### 需求分析

当前问题：
- 项目中大量使用裸 `console.log`，生产环境无法控制
- 无法按模块/功能域过滤日志
- 缺少性能监控（函数执行时间、API 调用耗时）
- 调试困难（无法快速定位日志来源）

#### 技术方案

##### 方案 A：轻量级封装（推荐）

创建 `packages/ui/src/utils/logger.ts`：

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

interface LoggerConfig {
  level: LogLevel
  prefix?: string
  enableTimestamp?: boolean
  enableStackTrace?: boolean
}

class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: import.meta.env.MODE === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
      enableTimestamp: true,
      enableStackTrace: false,
      ...config,
    }
  }

  debug(message: string, ...args: unknown[]) { /* ... */ }
  info(message: string, ...args: unknown[]) { /* ... */ }
  warn(message: string, ...args: unknown[]) { /* ... */ }
  error(message: string, ...args: unknown[]) { /* ... */ }

  // 性能监控
  time(label: string) { /* ... */ }
  timeEnd(label: string) { /* ... */ }

  // 创建子 logger
  child(prefix: string): Logger { /* ... */ }
}

// 使用示例
const logger = new Logger({ prefix: '[SessionManager]' })
logger.info('切换模式', { from: 'basic-system', to: 'pro-user' })
```

**优点**：
- 零依赖，轻量级
- 开发环境全日志，生产环境只显示警告和错误
- 支持按模块创建子 logger

##### 方案 B：使用第三方库

推荐库：
- **pino** - 高性能，JSON 格式（适合后端日志聚合）
- **consola** - 美观，支持浏览器和 Node.js
- **debug** - 经典轻量级，npm 下载量最高

**不推荐**：winston（体积大，主要用于 Node.js 后端）

#### 实施步骤

1. **创建 logger 工具类**
   - 实现日志级别过滤
   - 支持按模块分组（prefix）
   - 添加时间戳和堆栈跟踪
   - 开发/生产环境自动适配

2. **创建预设 logger 实例**
   ```typescript
   // packages/ui/src/utils/loggers.ts
   export const sessionLogger = logger.child('[SessionManager]')
   export const routerLogger = logger.child('[Router]')
   export const storageLogger = logger.child('[Storage]')
   ```

3. **逐步迁移现有代码**
   - 优先迁移关键模块（SessionManager, Router, Storage）
   - 使用 ESLint 规则禁止直接使用 `console.log`

4. **添加性能监控**
   ```typescript
   logger.time('session-restore')
   await restoreAllSessions()
   logger.timeEnd('session-restore')  // 输出: session-restore: 145ms
   ```

5. **配置生产环境**
   - 生产环境只输出 WARN 和 ERROR
   - 可选：集成错误监控平台（Sentry）

#### 验收标准

- [ ] logger 工具类已实现并测试
- [ ] 关键模块已迁移到新 logger
- [ ] ESLint 规则已添加（禁止 `console.log`）
- [ ] 生产环境日志级别正确
- [ ] 文档已更新（开发者指南）

#### 注意事项

- 日志迁移应逐步进行，避免一次性大范围修改
- 保留必要的 `console.error`（如 try-catch 中的关键错误）
- 考虑添加日志采样（避免性能敏感场景的过量日志）

---

## 其他待规划优化

### 单元测试覆盖率提升

**优先级**: P3
**状态**: 待规划

- 为关键 composables 添加单元测试
- 目标：核心业务逻辑测试覆盖率 > 80%

### JSDoc 注释规范

**优先级**: P3
**状态**: 待规划

- 为公开 API 添加 JSDoc 注释
- 集成 TypeDoc 自动生成 API 文档

### 组件库文档

**优先级**: P3
**状态**: 待规划

- 使用 Storybook 或 VitePress 构建组件文档
- 提供交互式示例和最佳实践

---

## 更新日志

| 日期 | 操作 | 说明 |
|------|------|------|
| 2025-01-08 | 创建文档 | 初始化标准化优化待办清单 |
