/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * OrcaRouter credential lifecycle.
 *
 * An OrcaRouter key obtained through PKCE is a **durable API key**, not an
 * OAuth access token: there is no refresh endpoint and no refresh grant. A
 * revoked key therefore has exactly one remedy — reauthenticate — and the
 * relay's `401` is a terminal signal, never a retry loop.
 *
 * The store below is the project's existing secret home for provider
 * credentials (`connectionConfig.apiKey`, persisted by the model manager).
 * This module only adds the status bookkeeping around it; it introduces no
 * second credential store.
 */

import type { OrcaCredential, OrcaCredentialSource } from './credential'

export type OrcaCredentialStatus = 'ready' | 'needsReauth'

export interface OrcaCredentialRecord {
  /** A normal `sk-orca-…` key. Never logged or rendered unmasked. */
  readonly apiKey: string
  readonly source: OrcaCredentialSource
  readonly scope: string
  readonly userId?: string
  /**
   * Bumped on every successful acquisition. A `401` may only demote the exact
   * generation that produced the rejected request.
   */
  readonly generation: number
  readonly status: OrcaCredentialStatus
  /** Epoch milliseconds of the last acquisition, supplied by the caller. */
  readonly acquiredAt?: number
}

/** The account a credential belongs to, for exact-account bookkeeping. */
export function getOrcaAccountKey(record: Pick<OrcaCredentialRecord, 'source' | 'userId'>): string {
  return record.userId ? `${record.source}:${record.userId}` : record.source
}

/**
 * Create a `ready` record from a freshly acquired credential. The generation
 * is derived from the previous record for the same account so a late failure
 * from an old request can be told apart from the current credential.
 */
export function createOrcaCredentialRecord(
  credential: OrcaCredential,
  previous?: OrcaCredentialRecord,
  acquiredAt?: number
): OrcaCredentialRecord {
  const sameAccount = previous && getOrcaAccountKey(previous) === getOrcaAccountKey(credential)
  const generation = (sameAccount ? previous!.generation : 0) + 1

  return {
    apiKey: credential.apiKey,
    source: credential.source,
    scope: credential.scope,
    userId: credential.userId,
    generation,
    status: 'ready',
    acquiredAt
  }
}

export interface OrcaReauthDecision {
  /** Whether the stored record should be demoted to `needsReauth`. */
  readonly shouldMarkNeedsReauth: boolean
  /** The record to persist. Unchanged when `shouldMarkNeedsReauth` is false. */
  readonly record?: OrcaCredentialRecord
  /** Safe, secret-free explanation for the UI. */
  readonly reason?: string
}

/**
 * Decide what a relay `401` means for one stored credential.
 *
 * `requestGeneration` is the generation the rejected request was sent with.
 * A generation mismatch means the request belonged to a credential that has
 * already been replaced — the freshly reauthorized credential must not be
 * demoted by the late failure of its predecessor.
 */
export function applyOrcaUnauthorized(
  record: OrcaCredentialRecord | undefined,
  requestGeneration: number | undefined
): OrcaReauthDecision {
  if (!record) {
    return { shouldMarkNeedsReauth: false, record: undefined }
  }

  if (requestGeneration !== undefined && requestGeneration !== record.generation) {
    return {
      shouldMarkNeedsReauth: false,
      record,
      reason: 'A stale request failed after this credential was already replaced'
    }
  }

  if (record.status === 'needsReauth') {
    return { shouldMarkNeedsReauth: false, record }
  }

  return {
    shouldMarkNeedsReauth: true,
    record: { ...record, status: 'needsReauth' },
    reason: 'OrcaRouter revoked this key. Sign in again to issue a new one.'
  }
}

/**
 * Whether a stored credential may be used for a request. A `needsReauth`
 * record is kept on disk (so the user does not lose it silently) but is not
 * usable until a new login succeeds.
 */
export function isOrcaCredentialUsable(record: OrcaCredentialRecord | undefined): boolean {
  return !!record && record.status === 'ready' && record.apiKey.trim().length > 0
}

/**
 * Replace a stored credential after a successful login. The previous secret is
 * only overwritten here — never deleted up front — so a cancelled or failed
 * login cannot turn a transient problem into irreversible account loss.
 */
export function replaceOrcaCredential(
  credential: OrcaCredential,
  previous?: OrcaCredentialRecord,
  acquiredAt?: number
): OrcaCredentialRecord {
  return createOrcaCredentialRecord(credential, previous, acquiredAt)
}

/**
 * There is deliberately no `refresh` helper in this module. Adding one would
 * imply a grant OrcaRouter does not offer; a `needsReauth` credential is
 * recovered by running the connect flow again.
 */
export const ORCAROUTER_DURABLE_KEY_LIFECYCLE_NOTE =
  'Refreshable OAuth tokens rotate automatically; durable key grants such as OrcaRouter are reused until the provider revokes them.'
