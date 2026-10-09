import { describe, expect, it } from 'vitest'

import {
  ORCAROUTER_DURABLE_KEY_LIFECYCLE_NOTE,
  applyOrcaUnauthorized,
  createOrcaCredentialRecord,
  getOrcaAccountKey,
  isOrcaCredentialUsable,
  replaceOrcaCredential,
  type OrcaCredentialRecord
} from '../../../src/services/orcarouter/credential-lifecycle'
import type { OrcaCredential } from '../../../src/services/orcarouter/credential'

function credential(overrides: Partial<OrcaCredential> = {}): OrcaCredential {
  return {
    apiKey: 'sk-orca-test',
    source: 'oauth-pkce',
    scope: 'api',
    userId: 'user-1',
    generation: 0,
    ...overrides
  }
}

describe('OrcaRouter credential lifecycle', () => {
  it('creates a ready record and bumps the generation for the same account', () => {
    const first = createOrcaCredentialRecord(credential(), undefined, 1000)
    const second = createOrcaCredentialRecord(credential({ apiKey: 'sk-orca-test-2' }), first, 2000)

    expect(first.generation).toBe(1)
    expect(first.status).toBe('ready')
    expect(second.generation).toBe(2)
    expect(second.status).toBe('ready')
  })

  it('keeps independent generations per account', () => {
    const accountA = createOrcaCredentialRecord(credential({ userId: 'a' }))
    const accountB = createOrcaCredentialRecord(credential({ userId: 'b' }), accountA)

    expect(getOrcaAccountKey(accountA)).toBe('oauth-pkce:a')
    expect(getOrcaAccountKey(accountB)).toBe('oauth-pkce:b')
    expect(accountB.generation).toBe(1)
  })

  it('treats a pasted key and a PKCE key as different accounts', () => {
    const pkce = createOrcaCredentialRecord(credential({ userId: 'x' }))
    const pasted = createOrcaCredentialRecord(
      credential({ source: 'api-key', userId: 'x' }),
      pkce
    )

    expect(pasted.generation).toBe(1)
  })

  it('marks the exact rejected generation as needsReauth', () => {
    const record = createOrcaCredentialRecord(credential())
    const decision = applyOrcaUnauthorized(record, record.generation)

    expect(decision.shouldMarkNeedsReauth).toBe(true)
    expect(decision.record?.status).toBe('needsReauth')
    expect(decision.reason).toMatch(/revoked/i)
  })

  it('does not let a late failure from an old generation poison a new credential', () => {
    const old = createOrcaCredentialRecord(credential())
    const fresh = replaceOrcaCredential(credential({ apiKey: 'sk-orca-new' }), old)

    // The request was sent with the *old* generation and failed afterwards.
    const decision = applyOrcaUnauthorized(fresh, old.generation)

    expect(decision.shouldMarkNeedsReauth).toBe(false)
    expect(decision.record?.status).toBe('ready')
    expect(decision.record?.generation).toBe(fresh.generation)
    expect(decision.reason).toMatch(/stale/i)
  })

  it('is idempotent when the credential is already needsReauth', () => {
    const record = createOrcaCredentialRecord(credential())
    const first = applyOrcaUnauthorized(record, record.generation)
    const second = applyOrcaUnauthorized(first.record, first.record!.generation)

    expect(second.shouldMarkNeedsReauth).toBe(false)
    expect(second.record?.status).toBe('needsReauth')
  })

  it('reports no decision at all when nothing is stored', () => {
    const decision = applyOrcaUnauthorized(undefined, 1)

    expect(decision.shouldMarkNeedsReauth).toBe(false)
    expect(decision.record).toBeUndefined()
  })

  it('treats a missing request generation as the current one', () => {
    const record = createOrcaCredentialRecord(credential())
    expect(applyOrcaUnauthorized(record, undefined).shouldMarkNeedsReauth).toBe(true)
  })

  it('keeps a needsReauth record on disk but unusable', () => {
    const record = createOrcaCredentialRecord(credential())
    const demoted = applyOrcaUnauthorized(record, record.generation).record as OrcaCredentialRecord

    // The secret is still there — it is not silently deleted before a
    // successful replacement — but it cannot be used for requests.
    expect(demoted.apiKey).toBe('sk-orca-test')
    expect(isOrcaCredentialUsable(demoted)).toBe(false)
    expect(isOrcaCredentialUsable(record)).toBe(true)
    expect(isOrcaCredentialUsable(undefined)).toBe(false)
  })

  it('never invents a refresh grant, and says so in the documented wording', () => {
    expect(ORCAROUTER_DURABLE_KEY_LIFECYCLE_NOTE).toMatch(/reused until the provider revokes/i)
    expect(ORCAROUTER_DURABLE_KEY_LIFECYCLE_NOTE).not.toMatch(/refresh token/i)
  })
})
