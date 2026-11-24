import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { SubModeKey } from '../../../src/stores/session/useSessionManager'
import { createWorkspaceRouteSwitchController } from '../../../src/components/app-layout/workspaceRouteSwitch'

const parseSubModeKey = (path: string): SubModeKey | null => {
  const match = path.split(/[?#]/)[0].match(/^\/(basic|pro|image)\/([^/]+)$/)
  return match ? (match[1] + '-' + match[2]) as SubModeKey : null
}

const setup = () => {
  const flushWorkspace = vi.fn(async (_key: SubModeKey) => true)
  const restoreSessionToUI = vi.fn(async () => {})
  const controller = createWorkspaceRouteSwitchController({
    hasRestoredInitialState: ref(true),
    parseSubModeKey,
    flushWorkspace,
    restoreSessionToUI,
  })
  return { controller, flushWorkspace, restoreSessionToUI }
}

describe('createWorkspaceRouteSwitchController', () => {
  it('flushes the source when the active route already points at the destination', async () => {
    const { controller, flushWorkspace, restoreSessionToUI } = setup()
    await controller.handleRouteChange('/basic/system', '/basic/user')
    expect(flushWorkspace).toHaveBeenCalledExactlyOnceWith('basic-user')
    expect(restoreSessionToUI).toHaveBeenCalledOnce()
  })

  it('flushes before leaving for favorites and does not save an unrelated workspace on return', async () => {
    const { controller, flushWorkspace, restoreSessionToUI } = setup()
    await controller.handleRouteChange('/favorites?from=/basic/user', '/basic/user')
    expect(flushWorkspace).toHaveBeenCalledExactlyOnceWith('basic-user')
    expect(restoreSessionToUI).not.toHaveBeenCalled()
    await controller.run('/basic/system', '/favorites?from=/basic/user')
    expect(flushWorkspace).toHaveBeenCalledOnce()
    expect(restoreSessionToUI).toHaveBeenCalledOnce()
  })

  it('lets explicit external-data navigation run the transaction skipped by the watcher', async () => {
    const { controller, flushWorkspace } = setup()
    await controller.handleRouteChange('/basic/system', '/basic/user', {
      externalDataLoading: true,
    })
    expect(flushWorkspace).not.toHaveBeenCalled()
    await controller.run('/basic/system', '/basic/user')
    expect(flushWorkspace).toHaveBeenCalledExactlyOnceWith('basic-user')
  })

  it('shares the same pending route transaction between the watcher and explicit navigation', async () => {
    const { controller, flushWorkspace, restoreSessionToUI } = setup()
    const first = controller.run('/pro/variable', '/basic/user')
    const second = controller.run('/pro/variable', '/basic/user')
    expect(second).toBe(first)
    await first
    expect(flushWorkspace).toHaveBeenCalledOnce()
    expect(restoreSessionToUI).toHaveBeenCalledOnce()
  })

  it('keeps rapid departures in order even if the first draft could not be saved', async () => {
    const { controller, flushWorkspace, restoreSessionToUI } = setup()
    let release!: (saved: boolean) => void
    flushWorkspace.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const first = controller.run('/pro/variable', '/basic/user')
    await Promise.resolve()
    expect(restoreSessionToUI).toHaveBeenCalledOnce()
    const back = controller.run('/basic/user', '/pro/variable')
    const again = controller.run('/pro/variable', '/basic/user')
    const last = controller.run('/image/text2image', '/pro/variable')
    expect(flushWorkspace.mock.calls).toEqual([['basic-user']])
    release(false)
    await Promise.all([first, back, again, last])
    expect(flushWorkspace.mock.calls).toEqual([
      ['basic-user'], ['pro-variable'], ['basic-user'], ['pro-variable'],
    ])
    expect(restoreSessionToUI).toHaveBeenCalledTimes(4)
  })
})
