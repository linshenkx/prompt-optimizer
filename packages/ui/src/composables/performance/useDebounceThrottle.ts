import { ref, onUnmounted } from 'vue'

/**
 * 防抖和节流 Composable
 * 提供性能优化的事件处理
 */
export function useDebounceThrottle() {
  const timers = ref(new Map<string, number>())

  /**
   * 防抖函数
   * @param fn 要执行的函数
   * @param delay 延迟时间（毫秒）
   * @param immediate 是否立即执行
   * @param key 唯一标识符
   */
  const debounce = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    delay: number = 300,
    immediate: boolean = false,
    key: string = 'default'
  ) => {
    return (...args: Args): void => {
      const timerId = timers.value.get(key)

      if (timerId) {
        clearTimeout(timerId)
      }

      if (immediate && !timerId) {
        fn(...args)
      }

      const newTimerId = window.setTimeout(() => {
        timers.value.delete(key)
        if (!immediate) {
          fn(...args)
        }
      }, delay)

      timers.value.set(key, newTimerId)
    }
  }

  /**
   * 节流函数
   * @param fn 要执行的函数
   * @param delay 节流间隔（毫秒）
   * @param key 唯一标识符
   */
  const throttle = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    delay: number = 100,
    key: string = 'default'
  ) => {
    let lastExecTime = 0

    return (...args: Args): void => {
      const now = Date.now()

      if (now - lastExecTime >= delay) {
        lastExecTime = now
        fn(...args)
      }
    }
  }

  /**
   * requestAnimationFrame 节流
   * 适用于动画和频繁的DOM更新
   */
  const rafThrottle = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    key: string = 'default'
  ) => {
    let rafId: number | null = null

    return (...args: Args): void => {
      if (rafId !== null) {
        return
      }

      rafId = requestAnimationFrame(() => {
        rafId = null
        fn(...args)
      })
    }
  }

  /**
   * 创建一个可取消的延迟执行函数
   */
  const createCancelableDelay = (
    fn: () => void,
    delay: number,
    key: string = 'default'
  ) => {
    const timerId = window.setTimeout(fn, delay)
    timers.value.set(key, timerId)
    
    return {
      cancel: () => {
        clearTimeout(timerId)
        timers.value.delete(key)
      }
    }
  }

  /**
   * 取消指定的防抖/节流计时器
   */
  const cancel = (key: string = 'default') => {
    const timerId = timers.value.get(key)
    if (timerId) {
      clearTimeout(timerId)
      timers.value.delete(key)
    }
  }

  /**
   * 取消所有计时器
   */
  const cancelAll = () => {
    timers.value.forEach((timerId) => {
      clearTimeout(timerId)
    })
    timers.value.clear()
  }

  /**
   * 获取当前活动的计时器数量
   */
  const getActiveTimersCount = () => timers.value.size

  /**
   * 智能防抖 - 根据输入频率自动调整延迟时间
   */
  const smartDebounce = <Args extends unknown[]>(
    fn: (...args: Args) => unknown,
    minDelay: number = 100,
    maxDelay: number = 1000,
    key: string = 'default'
  ) => {
    let callCount = 0
    let lastCallTime = 0

    return (...args: Args): void => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallTime

      callCount++
      lastCallTime = now
      
      // 根据调用频率动态调整延迟时间
      const frequency = callCount / Math.max(1, timeSinceLastCall / 1000)
      let adaptiveDelay = minDelay
      
      if (frequency > 10) {
        adaptiveDelay = maxDelay
      } else if (frequency > 5) {
        adaptiveDelay = Math.min(maxDelay, minDelay * 3)
      } else if (frequency > 2) {
        adaptiveDelay = Math.min(maxDelay, minDelay * 2)
      }
      
      // 重置计数器（每10秒）
      if (timeSinceLastCall > 10000) {
        callCount = 0
      }

      debounce(fn, adaptiveDelay, false, key)(...args)
    }
  }

  /**
   * 批处理执行 - 收集一段时间内的所有调用，然后批量执行
   */
  const batchExecute = <T>(
    fn: (batch: T[]) => void,
    delay: number = 100,
    key: string = 'default'
  ) => {
    const batches = new Map<string, T[]>()
    
    return (item: T) => {
      const batch = batches.get(key) || []
      batch.push(item)
      batches.set(key, batch)
      
      const timerId = timers.value.get(key)
      if (timerId) {
        clearTimeout(timerId)
      }
      
      const newTimerId = window.setTimeout(() => {
        const finalBatch = batches.get(key) || []
        batches.delete(key)
        timers.value.delete(key)
        
        if (finalBatch.length > 0) {
          fn(finalBatch)
        }
      }, delay)
      
      timers.value.set(key, newTimerId)
    }
  }

  // 清理所有计时器
  onUnmounted(() => {
    cancelAll()
  })

  return {
    debounce,
    throttle,
    rafThrottle,
    smartDebounce,
    batchExecute,
    createCancelableDelay,
    cancel,
    cancelAll,
    getActiveTimersCount
  }
}
