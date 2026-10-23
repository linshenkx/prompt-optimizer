import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceTestBatch } from '../../../src/composables/workspaces/useWorkspaceTestBatch'

const scheduling = vi.hoisted(() => ({ mode: 'parallel' as 'parallel' | 'sequential' }))
vi.mock('../../../src/utils/runTasksSequentially', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/runTasksSequentially')>()
  return {
    ...actual,
    runTasksWithExecutionMode: <T,>(ids: readonly T[], run: (id: T) => Promise<boolean>) =>
      actual.runTasksWithExecutionMode(ids, run, { mode: scheduling.mode }),
  }
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('workspace test batch boundary', () => {
  beforeEach(() => { scheduling.mode = 'parallel' })

  it('does not read or validate configuration while a column is running', async () => {
    const getIds = vi.fn(() => ['a', 'b'])
    const validate = vi.fn(() => true)
    const prepare = vi.fn(() => ({ run: vi.fn(), complete: vi.fn() }))
    await useWorkspaceTestBatch({ isRunning: () => true, getIds, validate, prepare })()
    expect(getIds).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('validates in order and starts no columns or cleanup when a later column is invalid', async () => {
    const validate = vi.fn((id: string) => id !== 'c')
    const prepare = vi.fn(() => ({ run: vi.fn(), complete: vi.fn() }))
    await useWorkspaceTestBatch({
      isRunning: () => false, getIds: () => ['a', 'b', 'c', 'd'], validate, prepare,
    })()
    expect(validate.mock.calls).toEqual([['a'], ['b'], ['c']])
    expect(prepare).not.toHaveBeenCalled()
  })

  it('prepares once after all validation and completes once after every parallel result', async () => {
    const events: string[] = []
    const a = deferred<boolean>()
    const b = deferred<boolean>()
    const complete = vi.fn()
    const execute = useWorkspaceTestBatch({
      isRunning: () => false,
      getIds: () => ['a', 'b'],
      validate: (id) => { events.push(`validate:${id}`); return true },
      prepare: () => {
        events.push('prepare')
        return {
          run: (id) => { events.push(`start:${id}`); return id === 'a' ? a.promise : b.promise },
          complete,
        }
      },
    })
    const pending = execute()
    expect(events).toEqual(['validate:a', 'validate:b', 'prepare', 'start:a', 'start:b'])
    b.resolve(false)
    await Promise.resolve()
    expect(complete).not.toHaveBeenCalled()
    a.resolve(true)
    await pending
    expect(complete).toHaveBeenCalledExactlyOnceWith([true, false])
  })

  it('uses the existing sequential execution policy when selected', async () => {
    scheduling.mode = 'sequential'
    const first = deferred<boolean>()
    const run = vi.fn((id: string) => id === 'a' ? first.promise : Promise.resolve(true))
    const complete = vi.fn()
    const pending = useWorkspaceTestBatch({
      isRunning: () => false, getIds: () => ['a', 'b'], validate: () => true,
      prepare: () => ({ run, complete }),
    })()
    expect(run.mock.calls).toEqual([['a']])
    first.resolve(true)
    await pending
    expect(run.mock.calls).toEqual([['a'], ['b']])
    expect(complete).toHaveBeenCalledExactlyOnceWith([true, true])
  })

  it('captures per-click context while reading fresh IDs for the next run', async () => {
    let ids = ['a', 'b']
    let image = 'first-image'
    const gate = deferred<boolean>()
    const requests: string[] = []
    const complete = vi.fn()
    const execute = useWorkspaceTestBatch({
      isRunning: () => false, getIds: () => ids, validate: () => true,
      prepare: () => {
        const snapshot = image
        return {
          run: async (id) => { await gate.promise; requests.push(`${id}:${snapshot}`); return true },
          complete,
        }
      },
    })
    const firstRun = execute()
    ids = ['a', 'b', 'c', 'd']
    image = 'new-image'
    gate.resolve(true)
    await firstRun
    expect(requests).toEqual(['a:first-image', 'b:first-image'])
    await execute()
    expect(requests.slice(2)).toEqual(['a:new-image', 'b:new-image', 'c:new-image', 'd:new-image'])
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('preserves unexpected rejection propagation without claiming completion or persistence', async () => {
    const error = new Error('unexpected execution failure')
    const complete = vi.fn()
    const execute = useWorkspaceTestBatch({
      isRunning: () => false, getIds: () => ['a', 'b'], validate: () => true,
      prepare: () => ({ run: async () => { throw error }, complete }),
    })
    await expect(execute()).rejects.toBe(error)
    expect(complete).not.toHaveBeenCalled()
  })
})
