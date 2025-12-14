/**
 * App-level Composables
 *
 * 这些 composables 专门用于 App.vue 级别的复杂业务逻辑，
 * 帮助减少 App.vue 的代码量并提高可维护性。
 */

export { useAppHistoryRestore } from './useAppHistoryRestore'
export { useAppFavorite } from './useAppFavorite'

// 导出类型
export type {
    AppHistoryRestoreOptions,
    AppHistoryRestoreReturn,
    HistoryContext,
} from './useAppHistoryRestore'

export type {
    AppFavoriteOptions,
    AppFavoriteReturn,
} from './useAppFavorite'
