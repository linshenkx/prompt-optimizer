import { computed, ref, shallowRef } from 'vue'

type TestVariantId = 'a' | 'b' | 'c' | 'd'

type SourceView = 'original' | 'workspace'

interface TestSourcePreview {
  content: string
  editable: boolean
  view: SourceView
  title?: string
}

interface TestSourcePreviewOptions {
  /** Basic modes follow edits live; context/image modes retain the opened snapshot. */
  mode: 'live' | 'snapshot'
  readSource: (id: TestVariantId) => TestSourcePreview
  onEdit: (view: SourceView) => Promise<void>
}

/** Only owns preview state. Source resolution and navigation belong to the page. */
export function useTestSourcePreview(options: TestSourcePreviewOptions) {
  const show = ref(false)
  const selectedId = ref<TestVariantId>('a')
  const snapshot = shallowRef<TestSourcePreview>({ content: '', editable: false, view: 'original' })
  const source = computed(() => options.mode === 'live'
    ? options.readSource(selectedId.value)
    : snapshot.value)

  const preview = (id: TestVariantId) => {
    selectedId.value = id
    if (options.mode === 'snapshot') snapshot.value = options.readSource(id)
    show.value = true
  }
  const edit = async () => {
    const view = source.value.view
    show.value = false
    await options.onEdit(view)
  }

  return {
    show, selectedId, preview, edit,
    content: computed(() => source.value.content),
    editable: computed(() => source.value.editable),
    title: computed(() => source.value.title ?? ''),
  }
}
