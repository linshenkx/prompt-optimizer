<template><div ref="container" class="output-source-view" :style="fitContent ? { height: 'min(70vh, 640px)', flex: 'none' } : undefined" data-testid="output-source-view" /></template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorState, Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { OutputDocument, OutputField } from '../utils/output-document'
import { scheduleOutputView, cancelOutputView } from '../utils/output-view-scheduler'

const props = withDefaults(defineProps<{
  document?: OutputDocument
  field?: OutputField
  content?: string
  fitContent?: boolean
  suspended?: boolean
}>(), { field: 'result', content: '' })
const container = ref<HTMLElement>()
let view: EditorView | undefined
let unsubscribe: (() => void) | undefined
const scheduleOwner = {}
let visible = true
let observer: IntersectionObserver | undefined
let previousContent = ''
let rawOffset = 0
let endedWithCarriageReturn = false
let disposed = false
const synchronize = () => {
  if (!view || disposed || !visible || props.suspended || document.visibilityState === 'hidden') return
  if (props.document) {
    const next = props.document.text(props.field)
    if (next.length > rawOffset) {
      let delta = next.sliceString(rawOffset)
      const lastCarriageReturn = delta.endsWith('\r')
      if (endedWithCarriageReturn && delta.startsWith('\n')) delta = delta.slice(1)
      view.dispatch({ changes: { from: view.state.doc.length, insert: delta.replace(/\r\n?/g, '\n') } })
      rawOffset = next.length
      endedWithCarriageReturn = lastCarriageReturn
    } else if (next.length < rawOffset) bindDocument()
  } else if (previousContent !== props.content) {
    // Legacy string callers remain supported; new streams use the tree/delta path.
    const append = props.content.startsWith(previousContent)
    let delta = append ? props.content.slice(previousContent.length) : props.content
    if (append && endedWithCarriageReturn && delta.startsWith('\n')) delta = delta.slice(1)
    view.dispatch({ changes: { from: append ? view.state.doc.length : 0, to: view.state.doc.length, insert: delta.replace(/\r\n?/g, '\n') } })
    endedWithCarriageReturn = props.content.endsWith('\r')
    previousContent = props.content
  }
}
const schedule = () => {
  if (!disposed && visible && !props.suspended && document.visibilityState !== 'hidden') scheduleOutputView(scheduleOwner, synchronize)
}
const bindDocument = (reset = true) => {
  unsubscribe?.()
  if (view && reset) {
    const source = props.document?.read(props.field) ?? props.content
    const doc = Text.of(source.split(/\r\n?|\n/))
    if (view.state.doc !== doc) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } })
    previousContent = props.content
    rawOffset = props.document?.size(props.field) ?? 0
    endedWithCarriageReturn = source.endsWith('\r')
  }
  if (!reset) {
    rawOffset = props.document?.size(props.field) ?? 0
    endedWithCarriageReturn = (props.document?.read(props.field) ?? props.content).endsWith('\r')
  }
  unsubscribe = props.document?.subscribe(schedule)
}
onMounted(() => {
  previousContent = props.content
  view = new EditorView({
    parent: container.value,
    state: EditorState.create({
      doc: props.document?.read(props.field) ?? props.content,
      extensions: [
        EditorState.readOnly.of(true), EditorView.editable.of(false),
        EditorView.contentAttributes.of({ tabindex: '0', 'aria-label': 'Output source' }),
        EditorView.theme({
          '&': { height: props.fitContent ? 'min(70vh, 640px)' : '100%', minHeight: '160px', color: 'inherit', backgroundColor: 'transparent' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', lineHeight: '1.7' },
          '.cm-content': { padding: '12px' },
          '.cm-line': { padding: '0' },
        }),
      ],
    }),
  })
  bindDocument(false)
  if (typeof IntersectionObserver !== 'undefined' && container.value) {
    observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true
      if (visible) schedule()
      else cancelOutputView(scheduleOwner)
    })
    observer.observe(container.value)
  }
  document.addEventListener('visibilitychange', schedule)
})
watch(() => [props.document, props.field], () => bindDocument())
watch(() => props.content, schedule)
watch(() => props.suspended, value => value ? cancelOutputView(scheduleOwner) : schedule())
onBeforeUnmount(() => {
  disposed = true
  unsubscribe?.()
  cancelOutputView(scheduleOwner)
  observer?.disconnect()
  document.removeEventListener('visibilitychange', schedule)
  view?.destroy()
  view = undefined
})
</script>

<style scoped>
.output-source-view { flex: 1; min-height: 0; min-width: 0; height: 100%; overflow: hidden; contain: strict; }
</style>
