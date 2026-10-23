import { computed } from 'vue'
import type { DynamicTestPanelVersionValue } from '../../utils/testPanelVersion'

const ALL_VARIANT_IDS = ['a', 'b', 'c', 'd'] as const
type VariantId = typeof ALL_VARIANT_IDS[number]
type ColumnCount = 2 | 3 | 4
interface VariantConfig {
  id: VariantId
  version: DynamicTestPanelVersionValue
  modelKey: string
}
interface TestVariantBindingOptions {
  getVariants: () => readonly VariantConfig[]
  getCount: () => unknown
  setVariant: (id: VariantId, patch: Partial<Pick<VariantConfig, 'version' | 'modelKey'>>) => void
  setCount: (count: ColumnCount) => void
  /** Multi-image historically uses workspace when the A entry is absent. */
  originalVersionFallback?: DynamicTestPanelVersionValue
}

/** Live proxies only: no copied session state, model fallback or layout policy. */
export function useTestVariantBindings(options: TestVariantBindingOptions) {
  const getVariant = (id: VariantId): VariantConfig | undefined => {
    const variants = options.getVariants()
    return Array.isArray(variants) ? variants.find(variant => variant.id === id) : undefined
  }
  const testColumnCountModel = computed<ColumnCount>({
    get: () => {
      const count = options.getCount()
      return count === 3 || count === 4 ? count : 2
    },
    set: options.setCount,
  })
  const versionModel = (id: VariantId) => computed<DynamicTestPanelVersionValue>({
    get: () => getVariant(id)?.version ?? (id === 'a' ? options.originalVersionFallback ?? 0 : 'workspace'),
    set: version => options.setVariant(id, { version }),
  })
  const modelKeyModel = (id: VariantId) => computed<string>({
    get: () => getVariant(id)?.modelKey ?? '',
    set: modelKey => options.setVariant(id, { modelKey }),
  })

  return {
    allVariantIds: ALL_VARIANT_IDS,
    activeVariantIds: computed(() => ALL_VARIANT_IDS.slice(0, testColumnCountModel.value)),
    testColumnCountModel,
    variantVersionModels: { a: versionModel('a'), b: versionModel('b'), c: versionModel('c'), d: versionModel('d') },
    variantModelKeyModels: { a: modelKeyModel('a'), b: modelKeyModel('b'), c: modelKeyModel('c'), d: modelKeyModel('d') },
  }
}
