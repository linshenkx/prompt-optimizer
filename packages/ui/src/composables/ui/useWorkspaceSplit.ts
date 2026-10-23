import { onUnmounted, ref, watch, type Ref } from 'vue'

interface WorkspaceSplitOptions {
  root: Ref<HTMLElement | null>
  getPercent: () => unknown
  setPercent: (percent: number) => void
}

/** Desktop split interaction only. Layout and persistence remain with the caller. */
export function useWorkspaceSplit(options: WorkspaceSplitOptions) {
  const clamp = (percent: number) => Math.min(50, Math.max(25, percent))
  const mainSplitLeftPct = ref(50)
  watch(options.getPercent, percent => {
    if (typeof percent === 'number' && Number.isFinite(percent)) {
      mainSplitLeftPct.value = clamp(Math.round(percent))
    }
  }, { immediate: true })

  let dragging = false
  let startX = 0
  let startPercent = 0
  const move = (event: PointerEvent) => {
    const width = options.root.value?.getBoundingClientRect().width
    if (!width) return
    mainSplitLeftPct.value = clamp(startPercent + (event.clientX - startX) / width * 100)
  }
  const finish = () => {
    if (!dragging) return
    dragging = false
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', finish)
    document.removeEventListener('pointercancel', finish)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    options.setPercent(mainSplitLeftPct.value)
  }
  const onSplitPointerDown = (event: PointerEvent) => {
    if (!options.root.value) return
    startX = event.clientX
    startPercent = mainSplitLeftPct.value
    dragging = true
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', finish)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  const onSplitKeydown = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') mainSplitLeftPct.value = 25
    else if (event.key === 'End') mainSplitLeftPct.value = 50
    else mainSplitLeftPct.value = clamp(mainSplitLeftPct.value + (event.key === 'ArrowLeft' ? -1 : 1))
    options.setPercent(mainSplitLeftPct.value)
  }
  onUnmounted(finish)

  return { mainSplitLeftPct, onSplitPointerDown, onSplitKeydown }
}
