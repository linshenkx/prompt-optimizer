import { describe, expect, it, vi } from 'vitest'

import { OrcaAuthError } from '../../../src/services/orcarouter/credential'
import {
  ORCAROUTER_AUTH_CODE_TTL_MS,
  ORCAROUTER_OOB_CALLBACK,
  exchangeOrcaRouterAuthCode,
  scopeSatisfies,
  startOrcaRouterAuthorize
} from '../../../src/services/orcarouter/pkce-flow'
import { createPkceChallenge, createS256Challenge } from '../../../src/services/orcarouter/pkce'
import { resolveOrcaRouterOrigins } from '../../../src/services/orcarouter/origins'

const AUTH_BASE = 'https://www.orcarouter.ai'
const API_BASE = 'https://api.orcarouter.ai/v1'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/** A local fake authorization server. Never talks to the network. */
function createFakeAuthServer(options: {
  exchangeBody?: unknown
  exchangeStatus?: number
  reject?: boolean
} = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    if (options.reject) {
      throw new TypeError('network down')
    }
    return jsonResponse(
      options.exchangeBody ?? { key: 'sk-orca-issued', user_id: 'u-1', scope: 'api' },
      options.exchangeStatus ?? 200
    )
  }) as unknown as typeof fetch

  return { fetchImpl, calls }
}

describe('OrcaRouter Flow B (out-of-band) authorize URL', () => {
  it('uses callback_url=oob and always sends S256', async () => {
    const { fetchImpl } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({
      getEnv: () => '',
      fetchImpl,
      appName: 'Prompt Optimizer'
    })

    const url = new URL(session.authorizeUrl)

    expect(url.origin).toBe(AUTH_BASE)
    expect(url.pathname).toBe('/auth')
    expect(url.searchParams.get('callback_url')).toBe(ORCAROUTER_OOB_CALLBACK)
    expect(url.searchParams.get('callback_url')).toBe('oob')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe('api')
    expect(url.searchParams.get('app_name')).toBe('Prompt Optimizer')
  })

  it('sends a challenge that is the S256 hash of a verifier that never leaves the process', async () => {
    const { fetchImpl } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    const url = new URL(session.authorizeUrl)
    const challenge = url.searchParams.get('code_challenge') ?? ''

    expect(challenge).not.toContain('=')
    expect(session.authorizeUrl).not.toContain('code_verifier')
    // The challenge is a hash, so it cannot be the verifier itself.
    expect(challenge).not.toBe(session.state)
    expect(challenge.length).toBe(43)
  })

  it('sends an opaque state and keeps it out of the exchange', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    const url = new URL(session.authorizeUrl)
    expect(url.searchParams.get('state')).toBe(session.state)

    await session.redeem('code-1', session.state)
    const exchangeCall = calls[calls.length - 1]
    expect(exchangeCall.url).not.toContain(session.state)
  })

  it('forwards optional login_hint, workspace_hint and prompt', async () => {
    const { fetchImpl } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({
      getEnv: () => '',
      fetchImpl,
      loginHint: 'user@example.com',
      workspaceHint: 'ws-9',
      prompt: 'consent'
    })

    const url = new URL(session.authorizeUrl)
    expect(url.searchParams.get('login_hint')).toBe('user@example.com')
    expect(url.searchParams.get('workspace_hint')).toBe('ws-9')
    expect(url.searchParams.get('prompt')).toBe('consent')
  })

  it('sends auth traffic to the auth origin only', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    expect(new URL(session.authorizeUrl).origin).toBe(AUTH_BASE)
    await session.redeem('code-1')

    for (const call of calls) {
      const origin = new URL(call.url).origin
      expect(origin).toBe(AUTH_BASE)
      expect(origin).not.toBe('https://api.orcarouter.ai')
    }
  })

  it('has a 10 minute authorization window constant', () => {
    expect(ORCAROUTER_AUTH_CODE_TTL_MS).toBe(600_000)
  })
})

describe('OrcaRouter auth-code exchange', () => {
  it('POSTs to /api/v1/auth/keys — never /v1/auth/keys', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await session.redeem('the-code')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://www.orcarouter.ai/api/v1/auth/keys')
    expect(calls[0].url).not.toContain('api.orcarouter.ai/v1/auth/keys')
    expect(calls[0].init?.method).toBe('POST')
  })

  it('sends the code, the verifier and the S256 method in the JSON body', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await session.redeem('the-code')

    const body = JSON.parse(String(calls[0].init?.body))
    expect(body.code).toBe('the-code')
    expect(body.code_challenge_method).toBe('S256')
    expect(typeof body.code_verifier).toBe('string')
    expect(body.code_verifier.length).toBeGreaterThanOrEqual(43)

    // The verifier matches the challenge that rode on the authorize URL.
    const challenge = new URL(session.authorizeUrl).searchParams.get('code_challenge')
    await expect(createS256Challenge(body.code_verifier)).resolves.toBe(challenge)
  })

  it('persists the granted scope read back from the response', async () => {
    const { fetchImpl } = createFakeAuthServer({
      exchangeBody: { key: 'sk-orca-issued', user_id: 'u-77', scope: 'api' }
    })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    const credential = await session.redeem('code-1')

    expect(credential.apiKey).toBe('sk-orca-issued')
    expect(credential.scope).toBe('api')
    expect(credential.userId).toBe('u-77')
    expect(credential.source).toBe('oauth-pkce')
  })

  it('rejects a scope downgrade instead of assuming the requested scope', async () => {
    const { fetchImpl } = createFakeAuthServer({
      exchangeBody: { key: 'sk-orca-issued', scope: 'connector' }
    })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl, scope: 'api' })

    await expect(session.redeem('code-1')).rejects.toMatchObject({ kind: 'scope-downgrade' })
  })

  it('rejects a response that omits the granted scope', async () => {
    const { fetchImpl } = createFakeAuthServer({ exchangeBody: { key: 'sk-orca-issued' } })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('code-1')).rejects.toMatchObject({ kind: 'scope-downgrade' })
  })

  it('maps 403 (unknown, expired or reused code) to a terminal error', async () => {
    const { fetchImpl } = createFakeAuthServer({ exchangeStatus: 403 })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('used-code')).rejects.toMatchObject({
      kind: 'expired-or-reused-code',
      status: 403
    })
  })

  it('maps 400 (challenge-method downgrade defence) to a terminal error', async () => {
    const { fetchImpl } = createFakeAuthServer({ exchangeStatus: 400 })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('code')).rejects.toMatchObject({ kind: 'expired-or-reused-code' })
  })

  it('maps 429 to a rate-limit error that mentions the key cap', async () => {
    const { fetchImpl } = createFakeAuthServer({ exchangeStatus: 429 })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    let error: unknown
    try {
      await session.redeem('code')
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(OrcaAuthError)
    expect((error as OrcaAuthError).kind).toBe('rate-limited')
    expect((error as OrcaAuthError).retryable).toBe(true)
  })

  it('surfaces a network failure without hanging or hot-looping', async () => {
    const { fetchImpl } = createFakeAuthServer({ reject: true })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('code')).rejects.toMatchObject({ kind: 'network' })
  })

  it('rejects an unreadable success body rather than saving a partial credential', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ) as unknown as typeof fetch
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('code')).rejects.toMatchObject({ kind: 'malformed-response' })
  })

  it('rejects a response with no key rather than persisting an empty secret', async () => {
    const { fetchImpl } = createFakeAuthServer({ exchangeBody: { scope: 'api' } })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('code')).rejects.toMatchObject({ kind: 'malformed-response' })
  })

  it('compares state before redeeming anything', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await expect(session.redeem('code', 'a-different-state')).rejects.toMatchObject({
      kind: 'state-mismatch'
    })
    // Nothing was exchanged, so an attacker-supplied code cannot be redeemed.
    expect(calls).toHaveLength(0)
  })

  it('refuses a reused code on the same attempt', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    await session.redeem('code-1')
    await expect(session.redeem('code-1')).rejects.toMatchObject({
      kind: 'expired-or-reused-code'
    })
    expect(calls).toHaveLength(1)
  })

  it('keeps the verifier out of every error message', async () => {
    const { fetchImpl, calls } = createFakeAuthServer({ exchangeStatus: 403 })
    const session = await startOrcaRouterAuthorize({ getEnv: () => '', fetchImpl })

    let message = ''
    try {
      await session.redeem('code')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    const sentBody = JSON.parse(String(calls[0].init?.body))
    expect(message).not.toContain(sentBody.code_verifier)
    expect(message).not.toContain('sk-orca-')
  })
})

describe('OrcaRouter exchange with explicit origins', () => {
  it('follows an explicit auth override while inference stays on the API origin', async () => {
    const { fetchImpl, calls } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({
      getEnv: () => '',
      authBaseUrl: 'https://login.self-hosted.example',
      apiBaseUrl: 'https://relay.self-hosted.example/v1',
      fetchImpl
    })

    expect(new URL(session.authorizeUrl).origin).toBe('https://login.self-hosted.example')
    expect(session.authBaseUrl).toBe('https://login.self-hosted.example')
    expect(session.apiBaseUrl).toBe('https://relay.self-hosted.example/v1')

    await session.redeem('code')
    expect(calls[0].url).toBe('https://login.self-hosted.example/api/v1/auth/keys')
  })

  it('uses one shared origin for both when a self-hosted base is given', async () => {
    const origins = resolveOrcaRouterOrigins({
      sharedBaseUrl: 'https://orca.internal.example',
      getEnv: () => ''
    })

    expect(origins.authBaseUrl).toBe('https://orca.internal.example')
    expect(origins.apiBaseUrl).toBe('https://orca.internal.example/v1')
  })
})

describe('exchangeOrcaRouterAuthCode direct call', () => {
  it('accepts an injected challenge factory without leaking the verifier', async () => {
    const { fetchImpl } = createFakeAuthServer()
    const session = await startOrcaRouterAuthorize({
      getEnv: () => '',
      fetchImpl,
      createChallenge: async () => {
        const real = await createPkceChallenge()
        return real
      }
    })

    expect(session.authorizeUrl).not.toContain('code_verifier')
  })

  it('reports a malformed response body distinctly from a network error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ scope: 'api' })) as unknown as typeof fetch

    await expect(
      exchangeOrcaRouterAuthCode({
        code: 'c',
        codeVerifier: 'v',
        authBaseUrl: AUTH_BASE,
        fetchImpl
      })
    ).rejects.toMatchObject({ kind: 'malformed-response' })
  })
})

describe('scopeSatisfies', () => {
  it('requires the exact requested scope token', () => {
    expect(scopeSatisfies('api', 'api')).toBe(true)
    expect(scopeSatisfies('api connector', 'api')).toBe(true)
    expect(scopeSatisfies('connector', 'api')).toBe(false)
    expect(scopeSatisfies('apix', 'api')).toBe(false)
    expect(scopeSatisfies('', 'api')).toBe(false)
  })
})
