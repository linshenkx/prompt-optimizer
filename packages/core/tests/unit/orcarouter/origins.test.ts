import { describe, expect, it } from 'vitest'

import {
  ORCAROUTER_AUTHORIZE_PATH,
  ORCAROUTER_DEFAULT_API_BASE_URL,
  ORCAROUTER_DEFAULT_AUTH_BASE_URL,
  ORCAROUTER_EXCHANGE_PATH,
  OrcaRouterOriginError,
  buildOrcaRouterAuthorizeUrl,
  buildOrcaRouterExchangeUrl,
  buildOrcaRouterModelsUrl,
  isLoopbackHostname,
  normalizeOrcaRouterApiBaseUrl,
  resolveOrcaRouterOrigins
} from '../../../src/services/orcarouter/origins'
import { ORCAROUTER_API_KEY_PROVIDER_ID, ORCAROUTER_PKCE_PROVIDER_ID } from '../../../src/services/llm/adapters/orcarouter-adapter'

describe('OrcaRouter origin policy', () => {
  it('uses the public defaults when nothing is configured', () => {
    const origins = resolveOrcaRouterOrigins({ getEnv: () => '' })

    expect(origins.authBaseUrl).toBe(ORCAROUTER_DEFAULT_AUTH_BASE_URL)
    expect(origins.apiBaseUrl).toBe(ORCAROUTER_DEFAULT_API_BASE_URL)
  })

  it('never derives the auth origin from the api origin or vice versa', () => {
    const origins = resolveOrcaRouterOrigins({ getEnv: () => '' })

    // The relay lives at /v1; the auth API does not. Appending /v1 to the auth
    // origin, or stripping it from the API origin, must not happen.
    expect(buildOrcaRouterExchangeUrl(origins.authBaseUrl)).toBe(
      'https://www.orcarouter.ai/api/v1/auth/keys'
    )
    expect(buildOrcaRouterExchangeUrl(origins.authBaseUrl)).not.toContain('api.orcarouter.ai')
    expect(buildOrcaRouterModelsUrl(origins.apiBaseUrl)).toBe('https://api.orcarouter.ai/v1/models')
    expect(buildOrcaRouterModelsUrl(origins.apiBaseUrl)).not.toContain('www.orcarouter.ai')
    expect(ORCAROUTER_AUTHORIZE_PATH).toBe('/auth')
    expect(ORCAROUTER_EXCHANGE_PATH).toBe('/api/v1/auth/keys')
  })

  it('accepts a shared self-hosted base for both origins', () => {
    const origins = resolveOrcaRouterOrigins({
      sharedBaseUrl: 'https://orca.internal.example',
      getEnv: () => ''
    })

    expect(origins.authBaseUrl).toBe('https://orca.internal.example')
    expect(origins.apiBaseUrl).toBe('https://orca.internal.example/v1')
    expect(buildOrcaRouterAuthorizeUrl(origins.authBaseUrl)).toBe(
      'https://orca.internal.example/auth'
    )
  })

  it('lets explicit per-origin overrides win over the shared base', () => {
    const origins = resolveOrcaRouterOrigins({
      sharedBaseUrl: 'https://orca.internal.example',
      authBaseUrl: 'https://login.self-hosted.example',
      apiBaseUrl: 'https://relay.self-hosted.example/v1',
      getEnv: () => ''
    })

    expect(origins.authBaseUrl).toBe('https://login.self-hosted.example')
    expect(origins.apiBaseUrl).toBe('https://relay.self-hosted.example/v1')
  })

  it('prefers explicit options over environment variables', () => {
    const env: Record<string, string> = {
      ORCA_AUTH_BASE_URL: 'https://env-auth.example',
      ORCA_API_BASE_URL: 'https://env-api.example/v1'
    }
    const origins = resolveOrcaRouterOrigins({
      authBaseUrl: 'https://explicit-auth.example',
      apiBaseUrl: 'https://explicit-api.example/v1',
      getEnv: (key) => env[key] ?? ''
    })

    expect(origins.authBaseUrl).toBe('https://explicit-auth.example')
    expect(origins.apiBaseUrl).toBe('https://explicit-api.example/v1')
  })

  it('reads the ORCA_BASE_URL shared fallback from the environment', () => {
    const env: Record<string, string> = { ORCA_BASE_URL: 'https://shared.example' }
    const origins = resolveOrcaRouterOrigins({ getEnv: (key) => env[key] ?? '' })

    expect(origins.authBaseUrl).toBe('https://shared.example')
    expect(origins.apiBaseUrl).toBe('https://shared.example/v1')
  })

  it('requires HTTPS for non-loopback origins', () => {
    expect(() => normalizeOrcaRouterApiBaseUrl('http://api.orcarouter.ai')).toThrow(
      OrcaRouterOriginError
    )
    expect(() => normalizeOrcaRouterApiBaseUrl('http://api.orcarouter.ai')).toThrow(/HTTPS/)
  })

  it('permits HTTP only for loopback development hosts', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('api.orcarouter.ai')).toBe(false)

    expect(normalizeOrcaRouterApiBaseUrl('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080/v1')
    expect(normalizeOrcaRouterApiBaseUrl('http://localhost:8080/v1')).toBe(
      'http://localhost:8080/v1'
    )
  })

  it('rejects origins carrying userinfo', () => {
    expect(() => normalizeOrcaRouterApiBaseUrl('https://user:pass@api.orcarouter.ai')).toThrow(
      /userinfo/
    )
  })

  it('rejects unparseable and empty origins instead of silently defaulting', () => {
    expect(() => normalizeOrcaRouterApiBaseUrl('not-a-url')).toThrow(OrcaRouterOriginError)
    expect(() => normalizeOrcaRouterApiBaseUrl('')).toThrow(OrcaRouterOriginError)
  })

  it('normalizes the API base to exactly one /v1 suffix', () => {
    expect(normalizeOrcaRouterApiBaseUrl('https://api.orcarouter.ai')).toBe(
      'https://api.orcarouter.ai/v1'
    )
    expect(normalizeOrcaRouterApiBaseUrl('https://api.orcarouter.ai/v1')).toBe(
      'https://api.orcarouter.ai/v1'
    )
    expect(normalizeOrcaRouterApiBaseUrl('https://api.orcarouter.ai/v1/')).toBe(
      'https://api.orcarouter.ai/v1'
    )
  })

  it('builds the catalog URL with an optional capability filter', () => {
    expect(buildOrcaRouterModelsUrl('https://api.orcarouter.ai/v1')).toBe(
      'https://api.orcarouter.ai/v1/models'
    )
    expect(buildOrcaRouterModelsUrl('https://api.orcarouter.ai/v1', 'chat')).toBe(
      'https://api.orcarouter.ai/v1/models?capability=chat'
    )
    expect(buildOrcaRouterModelsUrl('https://api.orcarouter.ai/v1', 'embedding')).toBe(
      'https://api.orcarouter.ai/v1/models?capability=embedding'
    )
  })

  it('keeps the two provider entries distinct and first-class', () => {
    expect(ORCAROUTER_API_KEY_PROVIDER_ID).toBe('orcarouter')
    expect(ORCAROUTER_PKCE_PROVIDER_ID).toBe('orcarouter-oauth')
    expect(ORCAROUTER_API_KEY_PROVIDER_ID).not.toBe(ORCAROUTER_PKCE_PROVIDER_ID)
  })
})
