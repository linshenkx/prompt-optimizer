import { describe, expect, it, vi } from 'vitest'

import { createRetryableLoader } from '../../../src/services/llm/adapters/sdk-loaders'

describe('createRetryableLoader', () => {
  it('coalesces concurrent loads and reuses the resolved module', async () => {
    const loadedModule = { name: 'sdk' }
    let resolveLoad: ((value: typeof loadedModule) => void) | undefined
    const factory = vi.fn(
      () => new Promise<typeof loadedModule>((resolve) => {
        resolveLoad = resolve
      }),
    )
    const load = createRetryableLoader(factory)

    const first = load()
    const second = load()

    expect(second).toBe(first)
    expect(factory).toHaveBeenCalledTimes(1)

    resolveLoad?.(loadedModule)
    await expect(first).resolves.toBe(loadedModule)
    expect(load()).toBe(first)
  })

  it('allows a later request to retry after a failed import', async () => {
    const importError = new Error('chunk load failed')
    const loadedModule = { name: 'sdk' }
    const factory = vi
      .fn<() => Promise<typeof loadedModule>>()
      .mockRejectedValueOnce(importError)
      .mockResolvedValueOnce(loadedModule)
    const load = createRetryableLoader(factory)

    await expect(load()).rejects.toBe(importError)
    await expect(load()).resolves.toBe(loadedModule)
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
