import { locks } from 'node:worker_threads'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireSessionRestoreLock, completeSessionRestore, withSessionAccess } from '../../../../src/stores/session/sessionConcurrency'
import { useSessionManager } from '../../../../src/stores/session/useSessionManager'
import { runSessionWrite } from '../../../../src/stores/session/sessionPersistence'
import { IMAGE_TEXT2IMAGE_SESSION_KEY, queueImageStorageMaintenance, scheduleImageStorageGc } from '../../../../src/stores/session/imageStorageMaintenance'
import { createPreferenceServiceStub, createTestPinia } from '../../../utils/pinia-test-helpers'
import type { IImageStorageService } from '@prompt-optimizer/core'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 10)) }
beforeEach(() => vi.stubGlobal('navigator', { locks }))
afterEach(() => vi.unstubAllGlobals())

describe('origin-wide session access', () => {
  it('drains in-flight writes and keeps other windows out until restore completes', async () => {
    const running = deferred()
    const entered = deferred()
    const save = withSessionAccess(async () => { entered.resolve(); await running.promise })
    await entered.promise
    const acquired = vi.fn()
    const acquiring = acquireSessionRestoreLock(new AbortController().signal).then(release => { acquired(); return release })
    await settle()
    expect(acquired).not.toHaveBeenCalled()
    running.resolve()
    await save
    const release = await acquiring
    const write = vi.fn(async () => {})
    const waiting = withSessionAccess(write)
    try {
      await settle()
      expect(write).not.toHaveBeenCalled()
    } finally { release() }
    await waiting
    expect(write).toHaveBeenCalledOnce()
  })

  it('cancels a queued restore without leaking a later exclusive lock', async () => {
    const release = await acquireSessionRestoreLock(new AbortController().signal)
    const controller = new AbortController()
    const waiting = acquireSessionRestoreLock(controller.signal)
    controller.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    release()
    await expect(withSessionAccess(async () => 'usable')).resolves.toBe('usable')
  })

  it('releases other windows after success while keeping the old local stores frozen', async () => {
    const { pinia, services } = createTestPinia({ imageStorageService: {
      getImage: vi.fn(async () => null), getMetadata: vi.fn(async () => null),
      listAllMetadata: vi.fn(async () => []), deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService })
    const manager = useSessionManager(pinia)
    const lease = await manager.beginSessionRestore()
    try {
      completeSessionRestore(lease)
      expect(await runSessionWrite(services.preferenceService, async () => true)).toBe(false)
      const otherWindow = createPreferenceServiceStub()
      expect(await runSessionWrite(otherWindow, async () => true)).toBe(true)
    } finally { lease() }
  })

  it.each(['save', 'restore'] as const)('keeps another window GC out of a pending image %s', async operation => {
    const imageSaved = deferred()
    const commit = deferred()
    let snapshot: unknown = null
    const release = operation === 'restore'
      ? await acquireSessionRestoreLock(new AbortController().signal)
      : undefined
    const saving = operation === 'save'
      ? withSessionAccess(async () => { imageSaved.resolve(); await commit.promise; snapshot = { image: { _type: 'image-ref', id: 'new-image' } } })
      : Promise.resolve()
    if (operation === 'save') await imageSaved.promise
    const preferenceService = createPreferenceServiceStub({
      get: vi.fn(async key => key === IMAGE_TEXT2IMAGE_SESSION_KEY ? snapshot : null),
      compareAndSet: vi.fn(async () => true),
    })
    const imageStorageService = {
      listAllMetadata: vi.fn(async () => [{ id: 'new-image' }, { id: 'old-orphan' }]),
      deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService
    try {
      scheduleImageStorageGc(preferenceService, imageStorageService, { getFavoritesPayload: null })
      await settle()
      expect(imageStorageService.listAllMetadata).not.toHaveBeenCalled()
    } finally {
      snapshot = { image: { _type: 'image-ref', id: 'new-image' } }
      commit.resolve()
      release?.()
      await saving
    }
    await vi.waitFor(() => expect(imageStorageService.deleteImages).toHaveBeenCalledWith(['old-orphan']))
    await queueImageStorageMaintenance(async () => {})
  })

  it('defers automatic orphan deletion when the browser cannot coordinate windows', async () => {
    vi.stubGlobal('navigator', {})
    const preferenceService = createPreferenceServiceStub({ compareAndSet: vi.fn(async () => true) })
    const imageStorageService = {
      listAllMetadata: vi.fn(async () => [{ id: 'possibly-importing' }]),
      deleteImages: vi.fn(async () => {}),
    } as unknown as IImageStorageService
    scheduleImageStorageGc(preferenceService, imageStorageService)
    await settle()
    await queueImageStorageMaintenance(async () => {})
    expect(imageStorageService.deleteImages).not.toHaveBeenCalled()
    expect(imageStorageService.listAllMetadata).not.toHaveBeenCalled()
  })
})
