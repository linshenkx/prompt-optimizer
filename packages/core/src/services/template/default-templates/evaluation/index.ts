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
} from './basic/system';

// 基础模式 - 用户提示词评估
export {
  evaluationBasicUserOriginal,
  evaluationBasicUserOriginalEn,
  evaluationBasicUserOptimized,
  evaluationBasicUserOptimizedEn,
  evaluationBasicUserCompare,
  evaluationBasicUserCompareEn,
} from './basic/user';

// 高级模式 - 系统提示词评估（多消息模式）
export {
  evaluationProSystemOriginal,
  evaluationProSystemOriginalEn,
  evaluationProSystemOptimized,
  evaluationProSystemOptimizedEn,
  evaluationProSystemCompare,
  evaluationProSystemCompareEn,
} from './pro/system';

// 高级模式 - 用户提示词评估（变量模式）
export {
  evaluationProUserOriginal,
  evaluationProUserOriginalEn,
  evaluationProUserOptimized,
  evaluationProUserOptimizedEn,
  evaluationProUserCompare,
  evaluationProUserCompareEn,
} from './pro/user';
