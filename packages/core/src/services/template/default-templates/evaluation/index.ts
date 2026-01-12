/**
 * 评估模板导出
 */

// 基础模式 - 系统提示词评估
export {
  evaluationBasicSystemOriginal,
  evaluationBasicSystemOriginalEn,
  evaluationBasicSystemOptimized,
  evaluationBasicSystemOptimizedEn,
  evaluationBasicSystemCompare,
  evaluationBasicSystemCompareEn,
  evaluationBasicSystemPromptOnly,
  evaluationBasicSystemPromptOnlyEn,
  evaluationBasicSystemPromptIterate,
  evaluationBasicSystemPromptIterateEn,
} from './basic/system';

// 基础模式 - 用户提示词评估
export {
  evaluationBasicUserOriginal,
  evaluationBasicUserOriginalEn,
  evaluationBasicUserOptimized,
  evaluationBasicUserOptimizedEn,
  evaluationBasicUserCompare,
  evaluationBasicUserCompareEn,
  evaluationBasicUserPromptOnly,
  evaluationBasicUserPromptOnlyEn,
  evaluationBasicUserPromptIterate,
  evaluationBasicUserPromptIterateEn,
} from './basic/user';

// 高级模式 - 系统提示词评估（多消息模式）
export {
  evaluationProSystemOriginal,
  evaluationProSystemOriginalEn,
  evaluationProSystemOptimized,
  evaluationProSystemOptimizedEn,
  evaluationProSystemCompare,
  evaluationProSystemCompareEn,
  evaluationProSystemPromptOnly,
  evaluationProSystemPromptOnlyEn,
  evaluationProSystemPromptIterate,
  evaluationProSystemPromptIterateEn,
} from './pro/system';

// 高级模式 - 用户提示词评估（变量模式）
export {
  evaluationProUserOriginal,
  evaluationProUserOriginalEn,
  evaluationProUserOptimized,
  evaluationProUserOptimizedEn,
  evaluationProUserCompare,
  evaluationProUserCompareEn,
  evaluationProUserPromptOnly,
  evaluationProUserPromptOnlyEn,
  evaluationProUserPromptIterate,
  evaluationProUserPromptIterateEn,
} from './pro/user';

// 图像模式 - 文生图评估
export {
  evaluationImageText2ImagePromptOnly,
  evaluationImageText2ImagePromptOnlyEn,
} from './image/text2image';

// 图像模式 - 图生图评估
export {
  evaluationImageImage2ImagePromptOnly,
  evaluationImageImage2ImagePromptOnlyEn,
} from './image/image2image';
