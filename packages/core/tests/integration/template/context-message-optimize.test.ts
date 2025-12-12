import { describe, it, beforeEach, beforeAll } from 'vitest';
import { PromptService } from '../../../src/services/prompt/service';
import { ModelManager } from '../../../src/services/model/manager';
import { TemplateManager } from '../../../src/services/template/manager';
import { HistoryManager } from '../../../src/services/history/manager';
import { LocalStorageProvider } from '../../../src/services/storage/localStorageProvider';
import { PreferenceService } from '../../../src/services/preference/service';
import { createLLMService } from '../../../src/services/llm/service';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { createModelManager } from '../../../src/services/model/manager';
import { createHistoryManager } from '../../../src/services/history/manager';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { TextModelConfig } from '../../../src/services/model/types';
import type { MessageOptimizationRequest, ConversationMessage } from '../../../src/services/prompt/types';

/**
 * 高级-多对话模式 优化模板测试（精简版）
 *
 * 本测试用于验证三个上下文消息优化模板的效果：
 * 1. context-message-optimize - 通用消息优化（推荐）
 * 2. context-analytical-optimize - 分析型优化（技术场景）
 * 3. context-output-format-optimize - 格式化优化（数据场景）
 *
 * 测试场景：4场景 × 3模板 = 12测试
 *
 * 运行方式：
 *   pnpm -F @prompt-optimizer/core test -- --run context-message-optimize
 */

// ============================================================================
// 测试用例定义
// ============================================================================

interface TestScenario {
  /** 场景名称 */
  name: string;
  /** 场景描述 */
  description: string;
  /** 对话消息 */
  messages: ConversationMessage[];
  /** 要优化的消息ID */
  selectedMessageId: string;
  /** 评估要点 */
  evaluationPoints: string[];
}

/** 要测试的模板列表 */
const TEMPLATES_TO_TEST = [
  { id: 'context-message-optimize', name: '通用消息优化（推荐）' },
  { id: 'context-analytical-optimize', name: '分析型优化（技术场景）' },
  { id: 'context-output-format-optimize', name: '格式化优化（数据场景）' },
];

/** 测试场景数组 - 精简版（4场景 × 3模板 = 12测试） */
const TEST_SCENARIOS: TestScenario[] = [
  // 场景1: 猫娘风格（有变量）- 风格保持 + 变量保留
  {
    name: '猫娘风格（有变量）',
    description: '测试风格保持和变量保留',
    messages: [
      { id: 'cat-1', role: 'user', content: '今天天气怎么样？' },
      { id: 'cat-2', role: 'assistant', content: '喵～今天天气很不错呢，阳光暖暖的，很适合晒太阳喵！主人要出门的话记得带伞哦～（●\'◡\'●）' },
      { id: 'cat-3', role: 'user', content: '那你现在给我{{要完成的指令}}' },
    ],
    selectedMessageId: 'cat-3',
    evaluationPoints: [
      '是否保持了轻松/可爱风格？',
      '是否保留了变量占位符 {{要完成的指令}}？',
      '是否过度复杂化？',
    ],
  },

  // 场景2: 代码审查风格（有变量）- 技术场景
  {
    name: '代码审查风格（有变量）',
    description: '测试技术场景的优化效果',
    messages: [
      { id: 'tech-1', role: 'user', content: '帮我看看这段代码有什么问题' },
      { id: 'tech-2', role: 'assistant', content: '好的，请把代码发给我，我来帮你分析。' },
      { id: 'tech-3', role: 'user', content: '```javascript\nfunction add(a, b) { return a + b }\n```\n这个函数需要{{优化方向}}' },
    ],
    selectedMessageId: 'tech-3',
    evaluationPoints: [
      '代码块是否被正确保留？',
      '是否保留了变量占位符 {{优化方向}}？',
      '分析型模板是否适度添加了技术分析维度？',
    ],
  },

  // 场景3: 傲娇风格（无变量）- ⚠️ 角色保持测试
  {
    name: '傲娇风格（无变量）',
    description: '⚠️ 关键测试：用户请求不能变成助手回复',
    messages: [
      { id: 'tsun-1', role: 'user', content: '帮我查一下明天的天气' },
      { id: 'tsun-2', role: 'assistant', content: '哼，不是我想帮你查的啦！只是正好闲着没事...明天多云转晴，气温18-25度，别以为我是特意帮你查的！' },
      { id: 'tsun-3', role: 'user', content: '推荐几首歌' },
    ],
    selectedMessageId: 'tsun-3',
    evaluationPoints: [
      '⚠️【关键】输出是否仍然是用户请求？（不能是傲娇回复）',
      '是否保持简洁？',
    ],
  },

  // 场景4: 客服场景（无变量）- ⚠️ 角色对立测试
  {
    name: '客服场景（无变量）',
    description: '⚠️ 关键测试：用户投诉不能变成客服回复',
    messages: [
      { id: 'cs-1', role: 'user', content: '我的订单三天了还没发货' },
      { id: 'cs-2', role: 'assistant', content: '非常抱歉给您带来不便！我已经为您查询了订单状态，目前显示仓库正在加急处理中。请问您的订单号是多少？我帮您催促一下。' },
      { id: 'cs-3', role: 'user', content: '退款' },
    ],
    selectedMessageId: 'cs-3',
    evaluationPoints: [
      '⚠️【关键】输出是否仍然是用户的退款请求？（不能是客服回复）',
      '可以补充退款原因，但角色仍是顾客',
    ],
  },
];

// ============================================================================
// 测试主体
// ============================================================================

describe('Context Message Optimize Templates - Real API Tests', () => {
  // 检查可用的 API 密钥
  const hasDeepSeekKey = !!process.env.VITE_DEEPSEEK_API_KEY;
  const hasOpenAIKey = !!process.env.VITE_OPENAI_API_KEY;

  // 选择可用的模型（优先 DeepSeek chat 模型）
  const availableModel = hasDeepSeekKey ? 'deepseek'
    : hasOpenAIKey ? 'openai'
    : null;

  const TEST_TIMEOUT = 120000; // 2分钟超时

  let promptService: PromptService;
  let modelManager: ModelManager;
  let llmService: any;
  let templateManager: TemplateManager;
  let historyManager: HistoryManager;
  let storage: LocalStorageProvider;
  let registry: TextAdapterRegistry;
  let testModelKey: string;

  beforeAll(() => {
    console.log('\n📋 环境变量检查:');
    console.log('  - DEEPSEEK_API_KEY:', hasDeepSeekKey ? '✓' : '✗');
    console.log('  - OPENAI_API_KEY:', hasOpenAIKey ? '✓' : '✗');
    console.log('  - 选择的模型:', availableModel || '无可用模型');
    console.log(`\n📦 测试场景数量: ${TEST_SCENARIOS.length}`);
    console.log(`📦 测试模板数量: ${TEMPLATES_TO_TEST.length}`);

    if (!availableModel) {
      console.log('\n⚠️ 跳过测试：未设置任何 API 密钥环境变量');
    }
  });

  beforeEach(async () => {
    // 初始化存储
    storage = new LocalStorageProvider();
    await storage.clearAll();

    // 初始化各管理器
    registry = new TextAdapterRegistry();
    modelManager = createModelManager(storage);
    llmService = createLLMService(modelManager);

    // 创建 PreferenceService 和语言服务
    const preferenceService = new PreferenceService(storage);
    const languageService = createTemplateLanguageService(preferenceService);
    await languageService.initialize();
    await languageService.setLanguage('zh-CN');

    templateManager = createTemplateManager(storage, languageService);
    historyManager = createHistoryManager(storage, modelManager);

    // 初始化服务
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager);

    // 根据可用的 API 配置模型
    if (availableModel === 'deepseek') {
      const adapter = registry.getAdapter('deepseek');
      const models = adapter.getModels();
      const chatModel = models.find(m => m.id === 'deepseek-chat') || models[0];
      const modelConfig: TextModelConfig = {
        id: 'test-deepseek',
        name: 'Test DeepSeek Chat',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: chatModel,
        connectionConfig: {
          apiKey: process.env.VITE_DEEPSEEK_API_KEY!
        },
        paramOverrides: {}
      };
      await modelManager.addModel('test-deepseek', modelConfig);
      testModelKey = 'test-deepseek';
    } else if (availableModel === 'openai') {
      const adapter = registry.getAdapter('openai');
      const modelConfig: TextModelConfig = {
        id: 'test-openai',
        name: 'Test OpenAI',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: process.env.VITE_OPENAI_API_KEY!,
          baseURL: process.env.VITE_OPENAI_BASE_URL
        },
        paramOverrides: {}
      };
      await modelManager.addModel('test-openai', modelConfig);
      testModelKey = 'test-openai';
    }
  });

  /**
   * 格式化输出优化结果
   */
  const printOptimizationResult = (
    scenarioName: string,
    templateName: string,
    originalContent: string,
    optimizedContent: string,
    evaluationPoints: string[]
  ) => {
    console.log('\n' + '='.repeat(80));
    console.log(`🎭 场景: ${scenarioName}`);
    console.log(`📝 模板: ${templateName}`);
    console.log('='.repeat(80));
    console.log('\n📌 原始消息:');
    console.log('  ' + originalContent.split('\n').join('\n  '));
    console.log('\n✨ 优化结果:');
    console.log('  ' + optimizedContent.split('\n').join('\n  '));
    console.log('\n' + '-'.repeat(80));
    console.log('💡 评估要点:');
    evaluationPoints.forEach((point, index) => {
      console.log(`  ${index + 1}. ${point}`);
    });
    console.log('='.repeat(80) + '\n');
  };

  // 自动遍历所有场景和模板生成测试
  TEST_SCENARIOS.forEach((scenario) => {
    describe(`场景: ${scenario.name}`, () => {
      TEMPLATES_TO_TEST.forEach((template) => {
        it.runIf(!!availableModel)(
          `${template.name} - ${scenario.description}`,
          async () => {
            const request: MessageOptimizationRequest = {
              selectedMessageId: scenario.selectedMessageId,
              messages: scenario.messages,
              modelKey: testModelKey,
              templateId: template.id
            };

            const result = await promptService.optimizeMessage(request);
            const originalMessage = scenario.messages.find(
              m => m.id === scenario.selectedMessageId
            )!;

            printOptimizationResult(
              scenario.name,
              template.name,
              originalMessage.content,
              result,
              scenario.evaluationPoints
            );
          },
          TEST_TIMEOUT
        );
      });
    });
  });

  // 跳过测试的占位
  it.skipIf(!availableModel)('跳过测试 - 未设置 API 密钥', () => {
    console.log('⚠️ 请设置以下环境变量之一来运行测试:');
    console.log('  - VITE_DEEPSEEK_API_KEY');
    console.log('  - VITE_OPENAI_API_KEY');
  });
});
