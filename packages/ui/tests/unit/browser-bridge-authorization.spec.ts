import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.resetModules()
})

const ticket = 'a'.repeat(43)

describe('product browser authorization links', () => {
  it('scrubs a cold-start ticket before the consent component mounts and consumes it only once', async () => {
    window.history.replaceState({}, '', `/?keep=yes#/pro/variable?poBridge=4242.${ticket}.read&view=saved`)
    const { takeBrowserAuthorization } = await import('../../src/browser-bridge/client')
    expect(window.location.href).not.toContain('poBridge')
    expect(window.location.search).toBe('?keep=yes')
    expect(window.location.hash).toBe('#/pro/variable?view=saved')
    expect(takeBrowserAuthorization()).toEqual({ port: 4242, ticket, access: 'read' })
    expect(takeBrowserAuthorization()).toBeUndefined()
  })

  it('accepts a fresh same-document link after the product has already initialized', async () => {
    const { takeBrowserAuthorization } = await import('../../src/browser-bridge/client')
    expect(takeBrowserAuthorization()).toBeUndefined()
    window.location.hash = `/pro/variable?poBridge=4343.${ticket}.compare`
    expect(takeBrowserAuthorization()).toEqual({ port: 4343, ticket, access: 'compare' })
    expect(window.location.hash).toBe('#/pro/variable')
    expect(takeBrowserAuthorization()).toBeUndefined()
  })

  it('removes but refuses invalid ports, ticket formats and unrecognized scopes', async () => {
    const { takeBrowserAuthorization } = await import('../../src/browser-bridge/client')
    for (const value of [`0.${ticket}.read`, `65536.${ticket}.read`, '4343.short.read', `4343.${ticket}.admin`]) {
      window.location.hash = `/pro/variable?poBridge=${value}`
      expect(takeBrowserAuthorization()).toBeUndefined()
      expect(window.location.href).not.toContain('poBridge')
    }
  })
})
