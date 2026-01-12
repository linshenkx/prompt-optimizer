import { ref, watch, type ComputedRef } from 'vue'


export function useFullscreen(
  modelValue: ComputedRef<string> | { value: string }, 
  emitUpdateValue: (value: string) => void
) {
  // 全屏状态
  const isFullscreen = ref(false)
  
  // 全屏模式下的文本值
  const fullscreenValue = ref(modelValue.value || '')

  // 防止“外部同步 -> 触发回写 -> 再同步”的回路
  // 仅在用户处于全屏编辑状态时才允许回写外部值
  const isSyncingFromModel = ref(false)
  
  // 监听外部值变化，同步到全屏值
  watch(() => modelValue.value, (newValue) => {
    isSyncingFromModel.value = true
    fullscreenValue.value = newValue || ''
    queueMicrotask(() => {
      isSyncingFromModel.value = false
    })
  })
  
  // 监听全屏值变化，同步到外部
  watch(fullscreenValue, (newValue) => {
    // 仅在全屏编辑时回写；非全屏输入由原组件自身的 v-model/update 处理
    if (!isFullscreen.value) return
    // 外部同步导致的变更不回写（避免循环/重复写入）
    if (isSyncingFromModel.value) return

    emitUpdateValue(newValue)
  })
  
  // 打开全屏
  const openFullscreen = () => {
    isFullscreen.value = true
  }
  
  // 关闭全屏
  const closeFullscreen = () => {
    isFullscreen.value = false
  }
  
  return {
    isFullscreen,
    fullscreenValue,
    openFullscreen,
    closeFullscreen
  }
} 
