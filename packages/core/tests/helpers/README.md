# 真实LLM测试辅助工具

这个目录包含用于简化真实LLM API测试的辅助工具。

## 概述

`real-llm.ts` 提供了一套基础方法，用于在单元测试中获取真实的LLM接口。它会根据本地环境变量自动选择可用的提供商和模型，无需手动配置。

## 特性

- ✅ **自动检测可用提供商** - 根据环境变量自动选择第一个可用的LLM提供商
- ✅ **零配置** - 无需硬编码模型名称或API地址
- ✅ **多提供商支持** - 支持OpenAI、Anthropic、Gemini、DeepSeek、ModelScope、智谱等
- ✅ **类型安全** - 完整的TypeScript类型定义
- ✅ **简单易用** - 一行代码即可创建测试上下文

## 支持的提供商

| 提供商 | API密钥环境变量 |
|--------|---------------|
| OpenAI | `VITE_OPENAI_API_KEY` 或 `OPENAI_API_KEY` |
| Anthropic | `VITE_ANTHROPIC_API_KEY` 或 `ANTHROPIC_API_KEY` |
| Google Gemini | `VITE_GEMINI_API_KEY` 或 `GEMINI_API_KEY` |
| DeepSeek | `VITE_DEEPSEEK_API_KEY` 或 `DEEPSEEK_API_KEY` |
| ModelScope | `VITE_MODELSCOPE_API_KEY` 或 `MODELSCOPE_API_KEY` |
| 智谱AI | `VITE_ZHIPU_API_KEY` 或 `ZHIPU_API_KEY` |

**注意**：
- 辅助工具使用系统内置的 `getDefaultTextModels()` 函数获取配置
- BaseURL 由各提供商的 adapter 自动设置
- 只有 `custom` 提供商支持通过环境变量 `VITE_CUSTOM_API_BASE_URL` 自定义 BaseURL

## 快速开始

### 1. 设置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# 至少设置一个提供商的API密钥
VITE_OPENAI_API_KEY=your_openai_api_key
# 或
VITE_GEMINI_API_KEY=your_gemini_api_key
# 或其他...
```

### 2. 启用真实API测试

运行测试时设置 `RUN_REAL_API=1`：

```bash
# 运行所有真实API测试
RUN_REAL_API=1 pnpm test

# 运行特定测试文件
RUN_REAL_API=1 pnpm test real-llm.example.test.ts
```

### 3. 编写测试

```typescript
import { describe, it, expect } from 'vitest';
import { createRealLLMTestContext, hasAvailableProvider } from './helpers/real-llm';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('My Real API Test', () => {
  it.skipIf(!hasAvailableProvider())('应该能调用真实LLM', async () => {
    // 创建测试上下文（自动选择第一个可用提供商）
    const context = await createRealLLMTestContext();
    if (!context) {
      console.log('跳过测试：无可用的LLM提供商');
      return;
    }

    // 使用LLM服务发送消息
    const messages = [{ role: 'user', content: 'Hello!' }];
    const response = await context.llmService.sendMessage(messages, context.modelKey);

    // 验证响应
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
  }, 30000);
});
```

## API 参考

### `createRealLLMTestContext(options?)`

创建真实LLM测试上下文，自动选择第一个可用的提供商。

**参数：**
```typescript
interface Options {
  /** 参数覆盖（如temperature等） */
  paramOverrides?: Record<string, any>;
}
```

**返回值：**
```typescript
interface RealLLMTestContext {
  /** 提供商信息 */
  provider: AvailableProvider;
  /** 模型配置（使用第一个可用模型） */
  modelConfig: TextModelConfig;
  /** LLM服务实例 */
  llmService: ILLMService;
  /** 模型管理器实例 */
  modelManager: IModelManager;
  /** 模型键（已添加到modelManager） */
  modelKey: string;
}
```

**示例：**
```typescript
// 使用默认配置
const context = await createRealLLMTestContext();

// 使用自定义参数
const context = await createRealLLMTestContext({
  paramOverrides: {
    temperature: 0.7,
    max_tokens: 1000,
  },
});
```

### `hasAvailableProvider()`

检查是否有至少一个可用的提供商。

**返回值：** `boolean`

**示例：**
```typescript
if (!hasAvailableProvider()) {
  console.log('没有可用的API密钥');
  return;
}
```

### `getAvailableProviders()`

获取所有可用的提供商列表。

**返回值：** `AvailableProvider[]`

**示例：**
```typescript
const providers = getAvailableProviders();
console.log(`找到 ${providers.length} 个可用提供商`);

providers.forEach(p => {
  console.log(`- ${p.config.name}: ${p.models.length} 个模型`);
});
```

### `getFirstAvailableProvider()`

获取第一个可用的提供商。

**返回值：** `AvailableProvider | undefined`

**示例：**
```typescript
const provider = getFirstAvailableProvider();
if (provider) {
  console.log(`使用提供商: ${provider.config.name}`);
  console.log(`模型: ${provider.models[0].name}`);
}
```

### `printAvailableProviders()`

打印可用提供商信息（用于调试）。

**示例：**
```typescript
beforeAll(() => {
  printAvailableProviders();
});

// 输出：
// ✅ 找到 2 个可用提供商：
//
// 1. OpenAI
//    - Provider ID: openai
//    - Models: 15 个可用模型
//    - First Model: GPT-4 Turbo (gpt-4-turbo)
//
// 2. Google Gemini
//    - Provider ID: gemini
//    - Models: 5 个可用模型
//    - First Model: Gemini 2.0 Flash (gemini-2.0-flash)
```

### `createTestConfig(provider, paramOverrides?)`

从提供商创建测试配置（低级API）。

**参数：**
- `provider: AvailableProvider` - 提供商信息
- `paramOverrides?: Record<string, any>` - 参数覆盖

**返回值：** `TextModelConfig`

**注意：** 此函数直接使用系统加载的模型配置，不需要指定模型索引。

## 使用示例

### 示例1：基础LLM调用

```typescript
it('应该能发送消息', async () => {
  const context = await createRealLLMTestContext();
  if (!context) return;

  const messages = [
    { role: 'user', content: '请用一句话介绍你自己' }
  ];

  const response = await context.llmService.sendMessage(
    messages,
    context.modelKey
  );

  expect(response.content).toBeDefined();
  console.log(`响应: ${response.content}`);
}, 30000);
```

### 示例2：多轮对话

```typescript
it('应该能进行多轮对话', async () => {
  const context = await createRealLLMTestContext();
  if (!context) return;

  // 第一轮
  const messages1 = [
    { role: 'user', content: '我的名字叫Alice' }
  ];
  const response1 = await context.llmService.sendMessage(messages1, context.modelKey);

  // 第二轮（带上下文）
  const messages2 = [
    { role: 'user', content: '我的名字叫Alice' },
    { role: 'assistant', content: response1.content },
    { role: 'user', content: '我的名字是什么？' }
  ];
  const response2 = await context.llmService.sendMessage(messages2, context.modelKey);

  console.log(`第2轮响应: ${response2.content}`);
}, 60000);
```

### 示例3：自定义参数

```typescript
it('应该能使用自定义参数', async () => {
  const context = await createRealLLMTestContext({
    paramOverrides: {
      temperature: 0.1,  // 低温度，更确定性
      max_tokens: 50,    // 限制长度
    },
  });

  if (!context) return;

  const messages = [{ role: 'user', content: '1+1等于几？' }];
  const response = await context.llmService.sendMessage(messages, context.modelKey);

  expect(response.content).toBeDefined();
}, 30000);
```

### 示例4：测试特定服务

```typescript
import { createVariableExtractionService } from '../../../src/services/variable-extraction/service';

it('应该能提取变量', async () => {
  const context = await createRealLLMTestContext();
  if (!context) return;

  // 创建变量提取服务
  const variableExtractionService = createVariableExtractionService(
    context.llmService,
    context.modelManager,
    templateManager
  );

  // 使用服务
  const result = await variableExtractionService.extract({
    promptContent: '请写一篇关于春天的文章，字数要求在500字以内。',
    extractionModelKey: context.modelKey,
    existingVariableNames: [],
  });

  expect(result.variables).toBeDefined();
  console.log(`提取了 ${result.variables.length} 个变量`);
}, 60000);
```

## 最佳实践

### 1. 使用条件跳过

始终使用 `describe.skipIf()` 和 `it.skipIf()` 来条件执行测试：

```typescript
const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('Real API Tests', () => {
  it.skipIf(!hasAvailableProvider())('test case', async () => {
    // ...
  });
});
```

### 2. 检查上下文存在性

始终检查 `context` 是否存在：

```typescript
const context = await createRealLLMTestContext();
if (!context) {
  console.log('跳过测试：无可用的LLM提供商');
  return;
}
```

### 3. 设置合理的超时

真实API调用可能需要较长时间，设置适当的超时：

```typescript
it('test case', async () => {
  // ...
}, 30000); // 30秒超时
```

### 4. 打印调试信息

使用 `printAvailableProviders()` 在测试开始时打印可用提供商：

```typescript
beforeAll(() => {
  printAvailableProviders();
});
```

### 5. 限制输出长度

在测试中使用 `max_tokens` 限制输出长度，加快测试速度：

```typescript
const context = await createRealLLMTestContext({
  paramOverrides: {
    max_tokens: 100,
  },
});
```

## 故障排除

### 问题：测试被跳过

**原因：** 没有设置 `RUN_REAL_API=1` 或没有可用的API密钥。

**解决方案：**
1. 运行测试时添加 `RUN_REAL_API=1`
2. 确保 `.env.local` 文件中至少有一个提供商的API密钥
3. 运行 `printAvailableProviders()` 检查可用提供商

### 问题：API调用超时

**原因：** 默认超时时间太短。

**解决方案：**
增加测试超时时间（第二个参数）：
```typescript
it('test case', async () => {
  // ...
}, 60000); // 增加到60秒
```

### 问题：找不到模型

**原因：** 提供商的模型列表为空。

**解决方案：**
检查adapter的模型定义，确保提供商至少有一个可用模型。

## 相关文件

- `real-llm.ts` - 核心辅助工具实现
- `real-llm.example.test.ts` - 使用示例测试
- `../integration/variable-extraction/service-real-api.test.ts` - 变量提取服务真实API测试

## 贡献

如需添加新的提供商支持，请在 `SUPPORTED_PROVIDERS` 数组中添加相应配置：

```typescript
{
  id: 'new-provider',
  envKeys: ['VITE_NEW_PROVIDER_API_KEY', 'NEW_PROVIDER_API_KEY'],
  name: 'New Provider'
}
```
