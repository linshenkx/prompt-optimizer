import { computed, ref } from 'vue'
import { createSharedComposable, useEventListener, useWindowSize } from '@vueuse/core'

export const WORKSPACE_SPLIT_MIN_WIDTH = 1024

export const useWorkspaceLayout = createSharedComposable(() => {
  const { width, height } = useWindowSize()
  const containerWidth = ref<number>()
  const contentHeight = ref<number>()
  // Budget input height from the space below the navigation, not device pixels.
  const compactInputRows = computed(() => Math.max(2, Math.min(5,
    Math.floor((contentHeight.value ?? height.value - 64) * 0.16 / 27.2),
  )))
  const isCompact = computed(() =>
    (containerWidth.value ?? width.value) < WORKSPACE_SPLIT_MIN_WIDTH,
  )
  const keyboardOpen = ref(false)
  const keyboardViewportHeight = ref<number>()
  const keyboardViewportTop = ref(0)
  let restingHeight = 0
  let restingWidth = 0

  const updateKeyboard = () => {
    if (typeof window === 'undefined') return
    const element = document.activeElement
    const editing = element instanceof HTMLElement &&
      (element.matches('input, textarea') || element.isContentEditable ||
        !!element.closest('.cm-editor'))
    if ((!editing && !keyboardOpen.value) || Math.abs(width.value - restingWidth) > 80) {
      restingHeight = height.value
      restingWidth = width.value
    }
    const viewport = window.visualViewport
    const visibleHeight = viewport?.height ?? height.value
    // Android Chrome keeps 100dvh unchanged when the IME overlays the page.
    // Pinch zoom also shrinks visualViewport, but must retain native panning.
    // Keep the frame stable between touch-down (input blur) and button click;
    // restore it only after the keyboard's actual resize has completed.
    keyboardOpen.value = (editing || keyboardOpen.value) && Math.abs((viewport?.scale ?? 1) - 1) < 0.05 &&
      Math.max(restingHeight, height.value) - visibleHeight > 150
    keyboardViewportHeight.value = keyboardOpen.value ? visibleHeight : undefined
    keyboardViewportTop.value = keyboardOpen.value ? viewport?.offsetTop ?? 0 : 0
  }
  useEventListener('resize', updateKeyboard)
  useEventListener('focusin', updateKeyboard)
  useEventListener('focusout', updateKeyboard)
  if (typeof window !== 'undefined') {
    useEventListener(window.visualViewport, 'resize', updateKeyboard)
    useEventListener(window.visualViewport, 'scroll', updateKeyboard)
  }

  return { isCompact, keyboardOpen, keyboardViewportHeight, keyboardViewportTop, containerWidth, contentHeight, compactInputRows }
})
