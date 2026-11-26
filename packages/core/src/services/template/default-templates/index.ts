/**
 * 默认模板统一导入
 * 
 * 🎯 极简设计：模板自身包含完整信息，无需额外配置
 */

// 导入所有模板
import { template as general_optimize } from './optimize/general-optimize';
import { template as general_optimize_en } from './optimize/general-optimize_en';
import { template as output_format_optimize } from './optimize/output-format-optimize';
import { template as output_format_optimize_en } from './optimize/output-format-optimize_en';
import { template as analytical_optimize } from './optimize/analytical-optimize';
import { template as analytical_optimize_en } from './optimize/analytical-optimize_en';
import { template as soul_openclaw_compose } from './optimize/soul-openclaw-compose';
import { template as soul_openclaw_compose_en } from './optimize/soul-openclaw-compose_en';
import { template as soul_hermes_compose } from './optimize/soul-hermes-compose';
import { template as soul_hermes_compose_en } from './optimize/soul-hermes-compose_en';
import { template as context_iterate } from './iterate/context/context-iterate';
import { template as context_iterate_en } from './iterate/context/context-iterate_en';
// 上下文消息优化模板（多轮对话模式专用）- 通用模板优先
import { template as context_message_optimize } from './optimize/context/context-message-optimize';
import { template as context_message_optimize_en } from './optimize/context/context-message-optimize_en';
// 上下文消息优化模板：分析型/输出格式（中/英）
import { template as context_analytical_optimize } from './optimize/context/context-analytical-optimize';
import { template as context_analytical_optimize_en } from './optimize/context/context-analytical-optimize_en';
import { template as context_output_format_optimize } from './optimize/context/context-output-format-optimize';
import { template as context_output_format_optimize_en } from './optimize/context/context-output-format-optimize_en';
// 新增对齐的用户上下文模板（基础/专业/规划）（中/英）
import { template as context_user_prompt_basic } from './user-optimize/context/context-user-prompt-basic';
import { template as context_user_prompt_basic_en } from './user-optimize/context/context-user-prompt-basic_en';
import { template as context_user_prompt_professional_ctx } from './user-optimize/context/context-user-prompt-professional';
import { template as context_user_prompt_professional_ctx_en } from './user-optimize/context/context-user-prompt-professional_en';
import { template as context_user_prompt_planning_ctx } from './user-optimize/context/context-user-prompt-planning';
import { template as context_user_prompt_planning_ctx_en } from './user-optimize/context/context-user-prompt-planning_en';

import { template as iterate } from './iterate/iterate';
import { template as iterate_en } from './iterate/iterate_en';
import { template as soul_iterate } from './iterate/soul-iterate';
import { template as soul_iterate_en } from './iterate/soul-iterate_en';

import { user_prompt_professional } from './user-optimize/user-prompt-professional';
import { user_prompt_professional_en } from './user-optimize/user-prompt-professional_en';
import { user_prompt_basic } from './user-optimize/user-prompt-basic';
import { user_prompt_basic_en } from './user-optimize/user-prompt-basic_en';
import { user_prompt_planning } from './user-optimize/user-prompt-planning';
import { user_prompt_planning_en } from './user-optimize/user-prompt-planning_en';

// 图像优化模板（重构后的目录结构）
// 文生图
import { template as image_general_optimize } from './image-optimize/text2image/general-image-optimize';
import { template as image_general_optimize_en } from './image-optimize/text2image/general-image-optimize_en';
import { template as video_structured } from './video-optimize/structured';
import { template as video_structured_en } from './video-optimize/structured_en';
import { template as video_natural } from './video-optimize/natural';
import { template as video_natural_en } from './video-optimize/natural_en';
import { template as video_i2v_motion } from './video-optimize/i2v-motion';
import { template as video_i2v_motion_en } from './video-optimize/i2v-motion_en';
import { template as video_seedance } from './video-optimize/seedance';
import { template as video_seedance_en } from './video-optimize/seedance_en';
import { template as video_wan } from './video-optimize/wan';
import { template as video_wan_en } from './video-optimize/wan_en';
import { template as video_feedback } from './video-iterate/feedback';
import { template as video_feedback_en } from './video-iterate/feedback_en';

import { template as image_chinese_optimize } from './image-optimize/text2image/chinese-model-optimize';
import { template as image_chinese_optimize_en } from './image-optimize/text2image/chinese-model-optimize_en';
import { template as image_photography_optimize } from './image-optimize/text2image/photography-optimize';
import { template as image_photography_optimize_en } from './image-optimize/text2image/photography-optimize_en';
import { template as image_creative_text2image } from './image-optimize/text2image/creative-text2image';
import { template as image_creative_text2image_en } from './image-optimize/text2image/creative-text2image_en';
import { template as image_json_structured_optimize } from './image-optimize/text2image/json-structured-optimize';
import { template as image_json_structured_optimize_en } from './image-optimize/text2image/json-structured-optimize_en';
// 图生图
import { template as image2image_optimize } from './image-optimize/image2image/image2image-optimize';
import { template as image2image_optimize_en } from './image-optimize/image2image/image2image-optimize_en';
import { template as image2image_design_text_edit_optimize } from './image-optimize/image2image/design-text-edit-optimize';
import { template as image2image_design_text_edit_optimize_en } from './image-optimize/image2image/design-text-edit-optimize_en';
import { template as image2image_json_structured_optimize } from './image-optimize/image2image/json-structured-optimize';
import { template as image2image_json_structured_optimize_en } from './image-optimize/image2image/json-structured-optimize_en';
// 多图生图
import { template as multiimage_optimize } from './image-optimize/multiimage/multiimage-optimize';
import { template as multiimage_optimize_en } from './image-optimize/multiimage/multiimage-optimize_en';
// 图像迭代
import { template as image_iterate_general } from './image-optimize/iterate/image-iterate-general';
import { template as image_iterate_general_en } from './image-optimize/iterate/image-iterate-general_en';

// 评估模板 - 基础模式/系统提示词
import { template as evaluation_basic_system_result } from './evaluation/basic/system/evaluation-result';
import { template as evaluation_basic_system_result_en } from './evaluation/basic/system/evaluation-result_en';
import { template as evaluation_basic_system_compare } from './evaluation/basic/system/evaluation-compare';
import { template as evaluation_basic_system_compare_en } from './evaluation/basic/system/evaluation-compare_en';
// 评估模板 - 基础模式/用户提示词
import { template as evaluation_basic_user_result } from './evaluation/basic/user/evaluation-result';
import { template as evaluation_basic_user_result_en } from './evaluation/basic/user/evaluation-result_en';
import { template as evaluation_basic_user_compare } from './evaluation/basic/user/evaluation-compare';
import { template as evaluation_basic_user_compare_en } from './evaluation/basic/user/evaluation-compare_en';
// 评估模板 - 高级模式/系统提示词（多消息模式）
import { template as evaluation_pro_system_result } from './evaluation/pro/system/evaluation-result';
import { template as evaluation_pro_system_result_en } from './evaluation/pro/system/evaluation-result_en';
import { template as evaluation_pro_system_compare } from './evaluation/pro/system/evaluation-compare';
import { template as evaluation_pro_system_compare_en } from './evaluation/pro/system/evaluation-compare_en';
// 评估模板 - 高级模式/用户提示词（变量模式）
import { template as evaluation_pro_user_result } from './evaluation/pro/user/evaluation-result';
import { template as evaluation_pro_user_result_en } from './evaluation/pro/user/evaluation-result_en';
import { template as evaluation_pro_user_compare } from './evaluation/pro/user/evaluation-compare';
import { template as evaluation_pro_user_compare_en } from './evaluation/pro/user/evaluation-compare_en';
// 评估模板 - 仅提示词评估（无需测试结果）
import { template as evaluation_basic_system_prompt_only } from './evaluation/basic/system/evaluation-prompt-only';
import { template as evaluation_basic_system_prompt_only_en } from './evaluation/basic/system/evaluation-prompt-only_en';
import { template as evaluation_basic_system_prompt_iterate } from './evaluation/basic/system/evaluation-prompt-iterate';
import { template as evaluation_basic_system_prompt_iterate_en } from './evaluation/basic/system/evaluation-prompt-iterate_en';
import { template as evaluation_video_prompt_only } from './evaluation/video/create/evaluation-prompt-only';
import { template as evaluation_video_prompt_only_en } from './evaluation/video/create/evaluation-prompt-only_en';
import { template as evaluation_basic_user_prompt_only } from './evaluation/basic/user/evaluation-prompt-only';
import { template as evaluation_basic_user_prompt_only_en } from './evaluation/basic/user/evaluation-prompt-only_en';
import { template as evaluation_basic_user_prompt_iterate } from './evaluation/basic/user/evaluation-prompt-iterate';
import { template as evaluation_basic_user_prompt_iterate_en } from './evaluation/basic/user/evaluation-prompt-iterate_en';
import { template as evaluation_pro_system_prompt_only } from './evaluation/pro/system/evaluation-prompt-only';
import { template as evaluation_pro_system_prompt_only_en } from './evaluation/pro/system/evaluation-prompt-only_en';
import { template as evaluation_pro_system_prompt_iterate } from './evaluation/pro/system/evaluation-prompt-iterate';
import { template as evaluation_pro_system_prompt_iterate_en } from './evaluation/pro/system/evaluation-prompt-iterate_en';
import { template as evaluation_pro_user_prompt_only } from './evaluation/pro/user/evaluation-prompt-only';
import { template as evaluation_pro_user_prompt_only_en } from './evaluation/pro/user/evaluation-prompt-only_en';
import { template as evaluation_pro_user_prompt_iterate } from './evaluation/pro/user/evaluation-prompt-iterate';
import { template as evaluation_pro_user_prompt_iterate_en } from './evaluation/pro/user/evaluation-prompt-iterate_en';
// 评估模板 - 图像模式/文生图
import { template as evaluation_image_text2image_prompt_only } from './evaluation/image/text2image/evaluation-prompt-only';
import { template as evaluation_image_text2image_prompt_only_en } from './evaluation/image/text2image/evaluation-prompt-only_en';
import { template as evaluation_image_text2image_prompt_iterate } from './evaluation/image/text2image/evaluation-prompt-iterate';
import { template as evaluation_image_text2image_prompt_iterate_en } from './evaluation/image/text2image/evaluation-prompt-iterate_en';
import { template as evaluation_image_text2image_result } from './evaluation/image/text2image/evaluation-result';
import { template as evaluation_image_text2image_result_en } from './evaluation/image/text2image/evaluation-result_en';
import { template as evaluation_image_text2image_compare } from './evaluation/image/text2image/evaluation-compare';
import { template as evaluation_image_text2image_compare_en } from './evaluation/image/text2image/evaluation-compare_en';
// 评估模板 - 图像模式/图生图
import { template as evaluation_image_image2image_prompt_only } from './evaluation/image/image2image/evaluation-prompt-only';
import { template as evaluation_image_image2image_prompt_only_en } from './evaluation/image/image2image/evaluation-prompt-only_en';
// 评估模板 - 图像模式/多图生图
import { template as evaluation_image_multiimage_prompt_only } from './evaluation/image/multiimage/evaluation-prompt-only';
import { template as evaluation_image_multiimage_prompt_only_en } from './evaluation/image/multiimage/evaluation-prompt-only_en';

// 变量提取模板
import { variableExtractionTemplate } from './variable-extraction';
import { variableExtractionTemplateEn } from './variable-extraction';

// 变量值生成模板
import { variableValueGenerationTemplate } from './variable-value-generation';
import { variableValueGenerationTemplateEn } from './variable-value-generation';
// 基于评估结果的智能改写模板
import { template as evaluation_rewrite_basic_system } from './evaluation-rewrite/basic-system';
import { template as evaluation_rewrite_basic_system_en } from './evaluation-rewrite/basic-system_en';
import { template as evaluation_rewrite_basic_user } from './evaluation-rewrite/basic-user';
import { template as evaluation_rewrite_basic_user_en } from './evaluation-rewrite/basic-user_en';
import { template as evaluation_rewrite_pro_multi } from './evaluation-rewrite/pro-multi';
import { template as evaluation_rewrite_pro_multi_en } from './evaluation-rewrite/pro-multi_en';
import { template as evaluation_rewrite_pro_variable } from './evaluation-rewrite/pro-variable';
import { template as evaluation_rewrite_pro_variable_en } from './evaluation-rewrite/pro-variable_en';
import { template as evaluation_rewrite_generic } from './evaluation-rewrite/generic';
import { template as evaluation_rewrite_generic_en } from './evaluation-rewrite/generic_en';
import { template as evaluation_structured_compare_pair_judge } from './evaluation-structured-compare/pair-judge';
import { template as evaluation_structured_compare_pair_judge_en } from './evaluation-structured-compare/pair-judge_en';
import { template as evaluation_structured_compare_synthesis } from './evaluation-structured-compare/synthesis';
import { template as evaluation_structured_compare_synthesis_en } from './evaluation-structured-compare/synthesis_en';

import { imagePromptCompositionTemplate } from './image-prompt-composition';
import { imagePromptCompositionTemplateEn } from './image-prompt-composition';
import { imagePromptMigrationTemplate } from './image-prompt-migration';
import { imagePromptMigrationTemplateEn } from './image-prompt-migration';

// 简单的模板集合 - 模板自身已包含完整信息（id、name、language、type等）
export const ALL_TEMPLATES = {
  general_optimize,
  general_optimize_en,
  output_format_optimize,
  output_format_optimize_en,
  analytical_optimize,
  analytical_optimize_en,
  soul_openclaw_compose,
  soul_openclaw_compose_en,
  soul_hermes_compose,
  soul_hermes_compose_en,
  context_iterate,
  context_iterate_en,
  context_message_optimize,
  context_message_optimize_en,
  context_analytical_optimize,
  context_analytical_optimize_en,
  context_output_format_optimize,
  context_output_format_optimize_en,
  context_user_prompt_basic,
  context_user_prompt_basic_en,
  context_user_prompt_professional_ctx,
  context_user_prompt_professional_ctx_en,
  context_user_prompt_planning_ctx,
  context_user_prompt_planning_ctx_en,
  user_prompt_professional,
  user_prompt_professional_en,
  iterate,
  iterate_en,
  soul_iterate,
  soul_iterate_en,
  user_prompt_basic,
  user_prompt_basic_en,
  user_prompt_planning,
  user_prompt_planning_en,
  // 图像优化模板
  image_general_optimize,
  image_general_optimize_en,
  video_natural,
  video_natural_en,
  video_structured,
  video_structured_en,
  video_i2v_motion,
  video_i2v_motion_en,
  video_seedance,
  video_seedance_en,
  video_wan,
  video_wan_en,
  video_feedback,
  video_feedback_en,
  image_chinese_optimize,
  image_chinese_optimize_en,
  image_photography_optimize,
  image_photography_optimize_en,
  image_creative_text2image,
  image_creative_text2image_en,
  image_json_structured_optimize,
  image_json_structured_optimize_en,
  // 图生图模板
  image2image_optimize,
  image2image_optimize_en,
  image2image_design_text_edit_optimize,
  image2image_design_text_edit_optimize_en,
  image2image_json_structured_optimize,
  image2image_json_structured_optimize_en,
  multiimage_optimize,
  multiimage_optimize_en,
  // 图像迭代模板
  image_iterate_general,
  image_iterate_general_en,
  // 评估模板 - 基础模式/系统提示词
  evaluation_basic_system_result,
  evaluation_basic_system_result_en,
  evaluation_basic_system_compare,
  evaluation_basic_system_compare_en,
  // 评估模板 - 基础模式/用户提示词
  evaluation_basic_user_result,
  evaluation_basic_user_result_en,
  evaluation_basic_user_compare,
  evaluation_basic_user_compare_en,
  // 评估模板 - 高级模式/系统提示词（多消息模式）
  evaluation_pro_system_result,
  evaluation_pro_system_result_en,
  evaluation_pro_system_compare,
  evaluation_pro_system_compare_en,
  // 评估模板 - 高级模式/用户提示词（变量模式）
  evaluation_pro_user_result,
  evaluation_pro_user_result_en,
  evaluation_pro_user_compare,
  evaluation_pro_user_compare_en,
  // 评估模板 - 仅提示词评估（无需测试结果）
  evaluation_basic_system_prompt_only,
  evaluation_basic_system_prompt_only_en,
  evaluation_basic_system_prompt_iterate,
  evaluation_basic_system_prompt_iterate_en,
  evaluation_video_prompt_only,
  evaluation_video_prompt_only_en,
  evaluation_basic_user_prompt_only,
  evaluation_basic_user_prompt_only_en,
  evaluation_basic_user_prompt_iterate,
  evaluation_basic_user_prompt_iterate_en,
  evaluation_pro_system_prompt_only,
  evaluation_pro_system_prompt_only_en,
  evaluation_pro_system_prompt_iterate,
  evaluation_pro_system_prompt_iterate_en,
  evaluation_pro_user_prompt_only,
  evaluation_pro_user_prompt_only_en,
  evaluation_pro_user_prompt_iterate,
  evaluation_pro_user_prompt_iterate_en,
  // 评估模板 - 图像模式/文生图
  evaluation_image_text2image_prompt_only,
  evaluation_image_text2image_prompt_only_en,
  evaluation_image_text2image_prompt_iterate,
  evaluation_image_text2image_prompt_iterate_en,
  evaluation_image_text2image_result,
  evaluation_image_text2image_result_en,
  evaluation_image_text2image_compare,
  evaluation_image_text2image_compare_en,
  // 评估模板 - 图像模式/图生图
  evaluation_image_image2image_prompt_only,
  evaluation_image_image2image_prompt_only_en,
  // 评估模板 - 图像模式/多图生图
  evaluation_image_multiimage_prompt_only,
  evaluation_image_multiimage_prompt_only_en,
  // 变量提取模板
  variableExtractionTemplate,
  variableExtractionTemplateEn,
  // 变量值生成模板
  variableValueGenerationTemplate,
  variableValueGenerationTemplateEn,
  // 基于评估结果的智能改写模板
  evaluation_rewrite_basic_system,
  evaluation_rewrite_basic_system_en,
  evaluation_rewrite_basic_user,
  evaluation_rewrite_basic_user_en,
  evaluation_rewrite_pro_multi,
  evaluation_rewrite_pro_multi_en,
  evaluation_rewrite_pro_variable,
  evaluation_rewrite_pro_variable_en,
  evaluation_rewrite_generic,
  evaluation_rewrite_generic_en,
  evaluation_structured_compare_pair_judge,
  evaluation_structured_compare_pair_judge_en,
  evaluation_structured_compare_synthesis,
  evaluation_structured_compare_synthesis_en,
  // 参考图内部模板
  imagePromptCompositionTemplate,
  imagePromptCompositionTemplateEn,
  imagePromptMigrationTemplate,
  imagePromptMigrationTemplateEn,
};
