import { describe, expect, it } from 'vitest'

import {
  ApiKeyCredentialProvider,
  OrcaAuthError,
  PkceCredentialProvider,
  checkOrcaRouterApiKeyFormat,
  describeOrcaAuthError,
  type OrcaCredential
} from '../../../src/services/orcarouter/credential'
import { base64UrlEncode, createPkceChallenge, createS256Challenge, redactSecret, timingSafeEqual } from '../../../src/services/orcarouter/pkce'

describe('credential seam', () => {
  it('produces the same credential shape from the API-key adapter', async () => {
    const provider = new ApiKeyCredentialProvider({ apiKey: 'sk-orca-fake-key-value', generation: 3 })
    const credential = await provider.acquire()

    expect(credential.source).toBe('api-key')
    expect(credential.apiKey).toBe('sk-orca-fake-key-value')
    expect(credential.scope).toBe('api')
    expect(credential.generation).toBe(3)
  })

  it('produces the same credential shape from the PKCE adapter', async () => {
    const provider = new PkceCredentialProvider({
      runFlow: async () => ({
        apiKey: 'sk-orca-from-pkce',
        scope: 'api',
        userId: '42',
        generation: 1
      })
    })
    const credential = await provider.acquire()

    expect(credential.source).toBe('oauth-pkce')
    expect(credential.scope).toBe('api')

    // The seam is source-agnostic: downstream consumers read the same fields
    // regardless of which adapter produced the credential.
    const apiKeyCredential = await new ApiKeyCredentialProvider({ apiKey: 'sk-orca-x' }).acquire()
    for (const key of ['apiKey', 'source', 'scope', 'generation'] as const) {
      expect(Object.keys(credential)).toContain(key)
      expect(Object.keys(apiKeyCredential)).toContain(key)
    }
    expect(credential.source).not.toBe(apiKeyCredential.source)
  })

  it('reports a missing key as a terminal invalid-api-key error', async () => {
    const provider = new ApiKeyCredentialProvider({ apiKey: '   ' })

    await expect(provider.acquire()).rejects.toBeInstanceOf(OrcaAuthError)
    await expect(provider.acquire()).rejects.toMatchObject({ kind: 'invalid-api-key' })
  })

  it('treats the key prefix as a format check, never a validity claim', () => {
    expect(checkOrcaRouterApiKeyFormat('not-a-key-at-all').ok).toBe(true)
    expect(checkOrcaRouterApiKeyFormat('').ok).toBe(false)
    expect(checkOrcaRouterApiKeyFormat(undefined).ok).toBe(false)
  })

  it('never echoes the secret in an auth error message', () => {
    const secret = 'sk-orca-super-secret-value'
    const error = new OrcaAuthError('invalid-api-key', `Rejected ${redactSecret(secret)}`)

    expect(error.message).not.toContain(secret)
    expect(error.message).toContain('****')
    expect(redactSecret(secret)).not.toContain('super-secret')
  })

  it('describes each terminal failure with an actionable message', () => {
    expect(describeOrcaAuthError(new OrcaAuthError('denied', 'x'))).toMatch(/declined/i)
    expect(describeOrcaAuthError(new OrcaAuthError('state-mismatch', 'x'))).toMatch(
      /did not match this login attempt/i
    )
    expect(describeOrcaAuthError(new OrcaAuthError('timeout', 'x'))).toMatch(/expired/i)
    expect(describeOrcaAuthError(new OrcaAuthError('expired-or-reused-code', 'x'))).toMatch(
      /no longer valid/i
    )
    expect(describeOrcaAuthError(new OrcaAuthError('rate-limited', 'x'))).toMatch(/too many/i)
    expect(describeOrcaAuthError(new OrcaAuthError('needs-reauth', 'x'))).toMatch(/revoked/i)
    expect(describeOrcaAuthError(new OrcaAuthError('scope-downgrade', 'x'))).toMatch(/scope/i)
  })

  it('does not mark ordinary failures as retryable', () => {
    expect(new OrcaAuthError('denied', 'x').retryable).toBe(false)
    expect(new OrcaAuthError('expired-or-reused-code', 'x').retryable).toBe(false)
    expect(new OrcaAuthError('network', 'x').retryable).toBe(true)
  })

  it('exposes a real credential value only through the seam result', async () => {
    const credential: OrcaCredential = await new ApiKeyCredentialProvider({
      apiKey: 'sk-orca-seam'
    }).acquire()

    expect(credential.apiKey).toBe('sk-orca-seam')
  })
})

describe('PKCE primitives', () => {
  it('encodes base64url with no padding', () => {
    const encoded = base64UrlEncode(new Uint8Array([251, 255, 190, 0, 1]))

    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('=')
  })

  it('derives a stable S256 challenge for a known verifier', async () => {
    // RFC 7636 appendix B test vector.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

    await expect(createS256Challenge(verifier)).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    )
  })

  it('generates a fresh verifier and state for every attempt', async () => {
    const first = await createPkceChallenge()
    const second = await createPkceChallenge()

    expect(first.verifier).not.toBe(second.verifier)
    expect(first.state).not.toBe(second.state)

    // Verifier entropy must be full-length, not a fixed or truncated value.
    expect(first.verifier.length).toBeGreaterThanOrEqual(43)
    expect(first.state.length).toBeGreaterThanOrEqual(20)
  })

  it('never reuses a verifier across repeated calls', async () => {
    const verifiers = new Set<string>()
    for (let index = 0; index < 25; index += 1) {
      verifiers.add((await createPkceChallenge()).verifier)
    }
    expect(verifiers.size).toBe(25)
  })

  it('compares state in constant time semantics', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false)
    expect(timingSafeEqual('abc123', 'abc12')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
  })
})
