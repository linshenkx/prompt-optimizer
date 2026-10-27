import { describe, expect, it } from 'vitest'

import {
  detectTaskExecutionMode,
  runTasksSequentially,
  runTasksWithExecutionMode,
} from '../../../src/utils/runTasksSequentially'

describe('runTasksSequentially', () => {
  it('按输入顺序依次执行异步任务', async () => {
    const started: number[] = []
    const completed: number[] = []

    const results = await runTasksSequentially([1, 2, 3], async (value) => {
      started.push(value)
      await new Promise((resolve) => setTimeout(resolve, 5))
      completed.push(value)
      return value * 10
    })

    expect(started).toEqual([1, 2, 3])
    expect(completed).toEqual([1, 2, 3])
    expect(results).toEqual([10, 20, 30])
  })
})

describe('runTasksWithExecutionMode', () => {
  it('并行模式下会同时启动所有任务', async () => {
    const started: number[] = []
    let releaseAll: (() => void) | null = null
    const gate = new Promise<void>((resolve) => {
      releaseAll = resolve
    })

    const promise = runTasksWithExecutionMode(
      [1, 2, 3],
      async (value) => {
        started.push(value)
        await gate
        return value * 10
      },
      { mode: 'parallel' },
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(started).toEqual([1, 2, 3])

    releaseAll?.()

    await expect(promise).resolves.toEqual([10, 20, 30])
  })

  it('在自动化和普通浏览器中使用相同的并发调度', () => {
    expect(detectTaskExecutionMode()).toBe('parallel')
  })
})
