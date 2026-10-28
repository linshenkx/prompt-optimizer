import { inject, type InjectionKey, type UnwrapNestedRefs } from 'vue'
import type { useDataManager } from './useDataManager'
export type DataManagerContext = UnwrapNestedRefs<ReturnType<typeof useDataManager>>
export const dataManagerKey: InjectionKey<DataManagerContext> = Symbol('data-manager')
export function useDataManagerContext(): DataManagerContext {
  const context = inject(dataManagerKey)
  if (!context) throw new Error('Data manager context is unavailable')
  return context
}
