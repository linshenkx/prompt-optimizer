# 测试命令说明

## 📝 命令总览

### 日常开发（推荐）

```bash
# 运行所有测试（单元 + E2E）- 统一入口
pnpm test

# 只运行单元测试（快速）
pnpm test:unit

# 快速验证（等同于 test:unit）
pnpm test:fast
```

### E2E 测试

```bash
# 智能运行 E2E（自动回放/录制）
pnpm test:e2e:smart

# 明确回放模式
pnpm test:e2e:replay

# 明确录制模式（覆盖已有 fixtures）
pnpm test:e2e:record

# 只运行 E2E，不运行单元测试
pnpm test:e2e
```

### CI/CD 门禁

```bash
# 轻量级门禁（单元 + 关键 E2E）
pnpm test:gate

# 完整门禁（单元 + 关键 E2E）
pnpm test:gate:full
```

## 🔧 智能测试逻辑

### `pnpm test` 的行为

执行 `pnpm test` 时，会按顺序执行：

1. **单元测试**（`test:unit`）
   - 运行所有包的 Vitest 单元测试
   - 快速验证核心功能

2. **E2E 测试**（`test:e2e:smart`）
   - 自动检查 VCR fixtures 是否完整
   - **全部存在**：使用回放模式（快速，不消耗 API）
   - **有缺失**：自动切换到录制模式（消耗 API，创建 fixtures）

### 自动录制场景

智能脚本会在以下情况自动录制：

- ✅ 首次运行 E2E 测试
- ✅ 新增测试用例
- ✅ 删除了 VCR fixtures

**不会被覆盖的情况**：

- ✅ 修改测试代码逻辑（fixture 已存在，自动回放）
- ✅ 修改 UI 代码（fixture 已存在，自动回放）
- ✅ 修改评估逻辑（fixture 已存在，回放失败，需手动录制）

### 强制覆盖录制

当评估逻辑变更时，需要重新录制：

```bash
# 方式 1：使用明确的录制命令
pnpm test:e2e:record

# 方式 2：删除特定 fixtures 后运行
rm tests/e2e/fixtures/vcr/analysis-*/评估*.json
pnpm test
```

## 📊 测试覆盖

### 单元测试（~20-30秒）
- Core 包：业务逻辑、服务层
- UI 包：组件、工具函数

### E2E 测试（~40-90秒）

#### Analysis 测试（10 个测试用例）
- ✅ Basic-System（2 个测试）
- ✅ Basic-User（2 个测试）
- ✅ Image-Text2Image（2 个测试）
- ✅ Image-Image2Image（2 个测试）
- ✅ Pro-Variable（2 个测试）

#### Gate 测试（2 个测试文件）
- ✅ Regression 测试
- ✅ Route Smoke 测试（6 个路由）

## ⚡ 性能对比

| 命令 | 场景 | 时间 | API 调用 |
|------|------|------|----------|
| `pnpm test:unit` | 日常开发 | ~20秒 | 无 |
| `pnpm test` | 完整验证 | ~60秒 | 仅缺失时 |
| `pnpm test:e2e:record` | 重新录制 | ~90秒 | 是 |
| `pnpm test:e2e:replay` | 离线回放 | ~50秒 | 否 |

## 💡 最佳实践

### 日常开发流程
```bash
# 1. 修改代码
# 2. 快速验证单元测试
pnpm test:unit

# 3. 提交前完整验证
pnpm test
```

### 评估逻辑变更流程
```bash
# 1. 修改评估模板或逻辑
# 2. 强制重新录制 E2E 测试
pnpm test:e2e:record

# 3. 验证所有测试通过
pnpm test
```

### 新增测试用例流程
```bash
# 1. 添加新测试代码
# 2. 运行测试（自动录制缺失的 fixtures）
pnpm test

# 3. 验证新增的测试
# 脚本会自动检测并录制新 fixtures
```

## 🔍 故障排查

### 测试失败怎么办？

**单元测试失败**：
```bash
# 单独运行单元测试查看详细错误
pnpm test:unit
```

**E2E 回放失败**：
- 检查是否是评估逻辑变更导致
- 如果是，运行 `pnpm test:e2e:record` 重新录制

**E2E 录制失败**：
- 检查 `.env.local` 是否配置 API keys
- 检查网络连接
- 查看具体错误日志

### Fixture 缺失

智能脚本会自动处理，但如果你遇到问题：

```bash
# 查看哪些 fixtures 缺失
ls tests/e2e/fixtures/vcr/

# 删除所有 fixtures 重新录制
rm -rf tests/e2e/fixtures/vcr/
pnpm test
```

## 📚 相关文档

- [E2E 测试指南](./e2e-guide.md)
- [VCR 使用说明](./e2e-vcr-guide.md)
- [选择器策略](./e2e-selector-strategy.md)
