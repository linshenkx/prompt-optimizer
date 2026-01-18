import { useI18n } from 'vue-i18n';
import type { IFavoriteManager } from '@prompt-optimizer/core';

/**
 * 收藏功能初始化器
 * 负责创建国际化的默认分类
 */
export function useFavoriteInitializer(manager: IFavoriteManager) {
  const { t } = useI18n();

  /**
   * 确保默认分类存在(仅首次使用时创建)
   */
  const ensureDefaultCategories = async () => {
    const defaultCategories = [
      {
        name: t('favorites.categories.default.uncategorized'),
        description: t('favorites.categories.default.uncategorizedDesc'),
        color: '#6B7280'
      },
      {
        name: t('favorites.categories.default.creativeWriting'),
        description: t('favorites.categories.default.creativeWritingDesc'),
        color: '#8B5CF6'
      },
      {
        name: t('favorites.categories.default.programming'),
        description: t('favorites.categories.default.programmingDesc'),
        color: '#F59E0B'
      },
      {
        name: t('favorites.categories.default.businessAnalysis'),
        description: t('favorites.categories.default.businessAnalysisDesc'),
        color: '#EF4444'
      },
      {
        name: t('favorites.categories.default.learning'),
        description: t('favorites.categories.default.learningDesc'),
        color: '#10B981'
      },
      {
        name: t('favorites.categories.default.dailyAssistant'),
        description: t('favorites.categories.default.dailyAssistantDesc'),
        color: '#3B82F6'
      }
    ];

    await manager.ensureDefaultCategories(defaultCategories);
  };

  return {
    ensureDefaultCategories
  };
}
