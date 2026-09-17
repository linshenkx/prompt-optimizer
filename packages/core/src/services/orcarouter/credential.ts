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
 * The single credential seam for OrcaRouter.
 *
 * Both entry points — pasting an existing `sk-orca-…` key and signing in with
 * OAuth 2.0 + PKCE — are adapters over {@link OrcaCredentialProvider} and both
 * produce the same {@link OrcaCredential}. Provider requests, model discovery
 * and every AI input entry point depend on the credential result only; none of
 * them knows or cares which adapter minted it.
 */

/** Which entry point produced a credential. */
export type OrcaCredentialSource = 'api-key' | 'oauth-pkce'

/** Scope requested from the consent screen. */
export const ORCAROUTER_SCOPE_API = 'api'

/** Everything downstream of the seam consumes exactly this. */
export interface OrcaCredential {
  /** A normal OrcaRouter API key (`sk-orca-…`) belonging to the user. */
  readonly apiKey: string
  /** Which adapter acquired it. Diagnostics/UI only — never a routing input. */
  readonly source: OrcaCredentialSource
  /** Scope actually granted by the consent screen, read back from the response. */
  readonly scope: string
  /** OrcaRouter user id, when the issuer returned one. */
  readonly userId?: string
  /** Monotonic counter, bumped on every successful acquisition. */
  readonly generation: number
}

/** How one credential entry point acquires a credential. */
export interface OrcaCredentialProvider {
  readonly source: OrcaCredentialSource
  /** Acquire a credential, or throw an {@link OrcaAuthError}. */
  acquire(): Promise<OrcaCredential>
}

/**
 * Terminal classification for authentication failures. A `401` from the relay
 * is a reauthentication requirement, not something to retry in a loop.
 */
export type OrcaAuthErrorKind =
  | 'denied'
  | 'state-mismatch'
  | 'timeout'
  | 'cancelled'
  | 'expired-or-reused-code'
  | 'scope-downgrade'
  | 'rate-limited'
  | 'network'
  | 'malformed-response'
  | 'invalid-api-key'
  | 'needs-reauth'

/** Kinds a user can make progress on by simply trying again. */
const RETRYABLE_KINDS: ReadonlySet<OrcaAuthErrorKind> = new Set(['network', 'rate-limited'])

export class OrcaAuthError extends Error {
  readonly kind: OrcaAuthErrorKind
  readonly status?: number
  /** Whether the user can make progress by trying again. */
  readonly retryable: boolean

  constructor(
    kind: OrcaAuthErrorKind,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message)
    this.name = 'OrcaAuthError'
    this.kind = kind
    this.status = options.status
    // Derived from the kind unless a caller overrides it, so a terminal failure
    // can never be accidentally presented as retryable (or vice versa).
    this.retryable = options.retryable ?? RETRYABLE_KINDS.has(kind)
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/**
 * User-facing guidance for a terminal auth failure. Callers surface these
 * strings; they never contain a key, a verifier, or a raw response body.
 */
export function describeOrcaAuthError(error: unknown): string {
  if (!(error instanceof OrcaAuthError)) {
    return error instanceof Error ? error.message : String(error)
  }

  switch (error.kind) {
    case 'denied':
      return 'Authorization was declined in the browser. Nothing was saved.'
    case 'state-mismatch':
      return 'The authorization response did not match this login attempt and was rejected. Please start again.'
    case 'timeout':
      return 'The authorization window expired before it was approved. Please start again.'
    case 'cancelled':
      return 'Login was cancelled.'
    case 'expired-or-reused-code':
      return 'That authorization code is no longer valid. Please start a new login.'
    case 'scope-downgrade':
      return 'The account granted a narrower scope than requested, so the connection was not saved. Ask a workspace owner to grant the "api" scope.'
    case 'rate-limited':
      return 'Too many OrcaRouter authorizations were issued for this account recently. Wait a little and try again, or paste an existing API key instead.'
    case 'network':
      return `Could not reach OrcaRouter: ${error.message}`
    case 'malformed-response':
      return 'OrcaRouter returned a response this build could not read. No credential was saved.'
    case 'invalid-api-key':
      return 'That API key was rejected by OrcaRouter. Check it, or use "Connect with OrcaRouter" instead.'
    case 'needs-reauth':
      return 'This OrcaRouter credential was revoked. Sign in again to issue a new key.'
    default:
      return error.message
  }
}

/** Result of a plain API-key format check. Never a validity claim. */
export interface ApiKeyFormatCheck {
  readonly ok: boolean
  readonly message?: string
}

/**
 * Lightweight input check so an obvious paste mistake is caught before a
 * request is sent. An `sk-orca-…` prefix is not proof the credential works;
 * validity is established by the first real request.
 */
export function checkOrcaRouterApiKeyFormat(value: unknown): ApiKeyFormatCheck {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, message: 'An OrcaRouter API key is required' }
  }
  return { ok: true }
}

/** Options accepted by {@link ApiKeyCredentialProvider}. */
export interface ApiKeyCredentialProviderOptions {
  /** The user-supplied key. Never logged. */
  apiKey: string
  /** Scope label to report for a pasted key. */
  scope?: string
  /** Generation counter owned by the caller's credential store. */
  generation?: number
}

/**
 * Adapter 1: a key the user already has. This path never opens a browser and
 * never starts a PKCE login.
 */
export class ApiKeyCredentialProvider implements OrcaCredentialProvider {
  readonly source: OrcaCredentialSource = 'api-key'
  private readonly options: ApiKeyCredentialProviderOptions

  constructor(options: ApiKeyCredentialProviderOptions) {
    this.options = options
  }

  async acquire(): Promise<OrcaCredential> {
    const check = checkOrcaRouterApiKeyFormat(this.options.apiKey)
    if (!check.ok) {
      throw new OrcaAuthError('invalid-api-key', check.message ?? 'Invalid OrcaRouter API key')
    }

    return {
      apiKey: this.options.apiKey.trim(),
      source: this.source,
      scope: this.options.scope ?? ORCAROUTER_SCOPE_API,
      generation: this.options.generation ?? 0
    }
  }
}

/**
 * Adapter 2: OAuth 2.0 + PKCE. The flow itself lives in `pkce-flow.ts`; this
 * adapter only adapts its result onto the shared seam.
 */
export interface PkceCredentialProviderOptions {
  /** Runs the authorization flow and returns the exchanged credential. */
  runFlow: () => Promise<Omit<OrcaCredential, 'source'>>
}

export class PkceCredentialProvider implements OrcaCredentialProvider {
  readonly source: OrcaCredentialSource = 'oauth-pkce'
  private readonly options: PkceCredentialProviderOptions

  constructor(options: PkceCredentialProviderOptions) {
    this.options = options
  }

  async acquire(): Promise<OrcaCredential> {
    const result = await this.options.runFlow()
    return { ...result, source: this.source }
  }
}
