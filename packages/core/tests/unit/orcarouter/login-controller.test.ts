import { describe, expect, it, vi } from 'vitest'

import { OrcaLoginController, type OrcaLoginState } from '../../../src/services/orcarouter/login-controller'
import type { OrcaCredential } from '../../../src/services/orcarouter/credential'

const CREDENTIAL: OrcaCredential = {
  apiKey: 'sk-orca-from-login',
  source: 'oauth-pkce',
  scope: 'api',
  userId: 'u-1',
  generation: 0
}

/** Fake authorize session that never touches the network. */
function createFakeSession(overrides: Partial<{
  authorizeUrl: string
  redeem: (code: string, state?: string) => Promise<OrcaCredential>
}> = {}) {
  return {
    authorizeUrl: overrides.authorizeUrl ?? 'https://www.orcarouter.ai/auth?callback_url=oob',
    state: 'state-abc',
    authBaseUrl: 'https://www.orcarouter.ai',
    apiBaseUrl: 'https://api.orcarouter.ai/v1',
    isSettled: () => false,
    redeem: overrides.redeem ?? (async () => CREDENTIAL)
  }
}

function createController(overrides: Record<string, unknown> = {}) {
  const states: OrcaLoginState[] = []
  const persist = vi.fn(async () => undefined)

  const controller = new OrcaLoginController({
    getEnv: () => '',
    onStateChange: (state) => states.push(state),
    persist,
    ...overrides
  } as never)

  return { controller, states, persist }
}

describe('OrcaLoginController', () => {
  it('reaches awaiting-code, persists, and becomes not-busy on success', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller, states, persist } = createController({ startAuthorize })

    const url = await controller.start()
    expect(url).toContain('/auth')
    expect(controller.getState()).toMatchObject({ phase: 'awaiting-code', busy: true })

    await controller.submitCode('the-code')

    expect(persist).toHaveBeenCalledTimes(1)
    expect(controller.getState()).toMatchObject({ phase: 'success', busy: false })
    expect(states[states.length - 1].busy).toBe(false)
  })

  it('rejects a second start while a login is in progress', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller } = createController({ startAuthorize })

    await controller.start()

    await expect(controller.start()).rejects.toMatchObject({ kind: 'cancelled' })
    expect(startAuthorize).toHaveBeenCalledTimes(1)
  })

  it('releases the lock on a denial', async () => {
    const startAuthorize = vi.fn(async () =>
      createFakeSession({
        redeem: async () => {
          throw Object.assign(new Error('denied'), { kind: 'denied', retryable: false })
        }
      })
    )
    const { controller, states, persist } = createController({ startAuthorize })

    await controller.start()
    await expect(controller.submitCode('code')).rejects.toBeDefined()

    const last = states[states.length - 1]
    expect(last.busy).toBe(false)
    expect(last.phase).toBe('error')
    expect(persist).not.toHaveBeenCalled()
  })

  it('releases the lock on an explicit cancel and allows a fresh login', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller, states } = createController({ startAuthorize })

    await controller.start()
    controller.cancel()

    expect(controller.getState()).toMatchObject({ phase: 'idle', busy: false })
    expect(states[states.length - 1].busy).toBe(false)

    // A second login starts without remounting anything.
    await controller.start()
    expect(controller.getState().busy).toBe(true)
    expect(startAuthorize).toHaveBeenCalledTimes(2)
  })

  it('never commits the credential when the user cancelled mid-exchange', async () => {
    let release: ((value: OrcaCredential) => void) | undefined
    const startAuthorize = vi.fn(async () =>
      createFakeSession({
        redeem: () =>
          new Promise<OrcaCredential>((resolve) => {
            release = resolve
          })
      })
    )
    const { controller, persist } = createController({ startAuthorize })

    await controller.start()
    const pending = controller.submitCode('code')
    // Attach early so the expected rejection is observed, not unhandled.
    const settled = pending.catch((error) => error)

    controller.cancel()
    release?.(CREDENTIAL)
    await settled

    expect(persist).not.toHaveBeenCalled()
    expect(controller.getState()).toMatchObject({ phase: 'idle', busy: false })
  })

  it('ignores a stale authorize URL from a superseded attempt', async () => {
    let releaseUrl: ((value: ReturnType<typeof createFakeSession>) => void) | undefined
    const startAuthorize = vi.fn(
      () =>
        new Promise<ReturnType<typeof createFakeSession>>((resolve) => {
          releaseUrl = resolve
        })
    )
    const { controller } = createController({ startAuthorize })

    const first = controller.start()
    controller.cancel()
    releaseUrl?.(createFakeSession({ authorizeUrl: 'https://www.orcarouter.ai/auth?stale=1' }))

    // The superseded attempt must not leave the controller busy.
    await first.catch(() => undefined)
    expect(controller.getState().busy).toBe(false)
  })

  it('times out and releases the lock', async () => {
    vi.useFakeTimers()
    try {
      const startAuthorize = vi.fn(async () => createFakeSession())
      const { controller, states } = createController({ startAuthorize, timeoutMs: 1000 })

      await controller.start()
      expect(controller.getState().busy).toBe(true)

      vi.advanceTimersByTime(1001)

      const last = states[states.length - 1]
      expect(last).toMatchObject({ phase: 'error', busy: false })
      expect(last.error).toMatch(/expired/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it('surfaces a start failure without leaving the lock held', async () => {
    const startAuthorize = vi.fn(async () => {
      throw Object.assign(new Error('nope'), { kind: 'network', retryable: true })
    })
    const { controller, states } = createController({ startAuthorize })

    await expect(controller.start()).rejects.toBeDefined()
    expect(controller.getState().busy).toBe(false)
    expect(states[states.length - 1].phase).toBe('error')
  })

  it('clears busy and hint synchronously on pagehide', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller, states } = createController({ startAuthorize })

    await controller.start()
    const generationBefore = controller.getGeneration()
    expect(controller.getState().busy).toBe(true)

    controller.handlePageHide()

    // Synchronous: no await, because the bfcache-restored page must not be
    // stuck busy when the guarded finally refuses to run.
    expect(controller.getState()).toMatchObject({ phase: 'idle', busy: false })
    expect(states[states.length - 1].busy).toBe(false)
    expect(controller.getGeneration()).toBeGreaterThan(generationBefore)
  })

  it('starts a second login after pagehide without remounting', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller } = createController({ startAuthorize })

    await controller.start()
    controller.handlePageHide()
    const url = await controller.start()

    expect(url).toContain('/auth')
    expect(controller.getState().busy).toBe(true)
    expect(startAuthorize).toHaveBeenCalledTimes(2)
  })

  it('clears busy even when no cancellation URL is configured', () => {
    const { controller } = createController()

    // Nothing pending: a pagehide with no login still must not throw.
    expect(() => controller.handlePageHide()).not.toThrow()
    expect(controller.getState().busy).toBe(false)
  })

  it('exposes the authorize URL for browsers that do not open automatically', async () => {
    const startAuthorize = vi.fn(async () =>
      createFakeSession({ authorizeUrl: 'https://www.orcarouter.ai/auth?callback_url=oob&state=s' })
    )
    const { controller } = createController({ startAuthorize })

    await controller.start()

    expect(controller.getAuthorizeUrl()).toBe(
      'https://www.orcarouter.ai/auth?callback_url=oob&state=s'
    )
    expect(controller.getState().hint).toMatch(/paste the code/i)
  })

  it('reports a browser-open failure without losing the URL', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller } = createController({
      startAuthorize,
      openBrowser: () => {
        throw new Error('no browser')
      }
    })

    await controller.start()

    expect(controller.getState().busy).toBe(true)
    expect(controller.getState().hint).toMatch(/copy the authorization url/i)
    expect(controller.getAuthorizeUrl()).toBeDefined()
  })

  it('refuses to submit a code when no login is in progress', async () => {
    const { controller } = createController()

    await expect(controller.submitCode('code')).rejects.toMatchObject({ kind: 'cancelled' })
  })

  it('keeps the verifier out of the UI state and hint text', async () => {
    const startAuthorize = vi.fn(async () => createFakeSession())
    const { controller, states } = createController({ startAuthorize })

    await controller.start()
    await controller.submitCode('the-code')

    for (const state of states) {
      const serialized = JSON.stringify(state)
      expect(serialized).not.toContain('code_verifier')
      expect(serialized).not.toContain('sk-orca-')
    }
  })
})
