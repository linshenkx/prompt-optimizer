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
 * OrcaRouter OAuth 2.0 + PKCE connect flow.
 *
 * This build ships **Flow B — out-of-band code**. The primary surfaces (the web
 * app and the browser extension) cannot listen on `127.0.0.1`, and a
 * self-hosted deployment address differs on every install, so there is no
 * predictable callback to register. Flow B exists precisely so no address has
 * to be predictable: the consent screen shows a code and the user pastes it
 * back. S256 is therefore mandatory here, never merely advisable.
 *
 * No client secret is involved and no redirect URI has to be pre-registered.
 * The exchanged credential is a durable `sk-orca-…` API key — it is *not* a
 * refresh token and there is no refresh grant to call later.
 */

import {
  ORCAROUTER_SCOPE_API,
  OrcaAuthError,
  type OrcaCredential
} from './credential'
import { createPkceChallenge, timingSafeEqual, type PkceChallenge } from './pkce'
import {
  buildOrcaRouterAuthorizeUrl,
  buildOrcaRouterExchangeUrl,
  resolveOrcaRouterOrigins,
  type OrcaRouterOriginOptions
} from './origins'

/** The literal `callback_url` value that selects the out-of-band flow. */
export const ORCAROUTER_OOB_CALLBACK = 'oob'

/** Auth codes are single-use with a 10 minute TTL. */
export const ORCAROUTER_AUTH_CODE_TTL_MS = 10 * 60 * 1000

/** Default label shown on the consent screen. */
export const ORCAROUTER_APP_NAME = 'Prompt Optimizer'

export interface OrcaRouterAuthorizeParams {
  /** Label the consent screen shows as a claim. */
  appName?: string
  /** `api` (default) or `connector`. Anything else is refused server-side. */
  scope?: string
  /** Pre-fills the email field when the user has to sign in. */
  loginHint?: string
  /** Pre-selects a workspace. */
  workspaceHint?: string
  /** `consent` forces re-approval even if the user approved before. */
  prompt?: string
}

/**
 * A login attempt in progress. One instance per attempt; the verifier inside
 * must never be reused.
 */
export interface OrcaRouterAuthorizeSession {
  /** URL to open in the browser (or show for manual copy). */
  readonly authorizeUrl: string
  /** The state echoed back by the consent screen. Compared before exchange. */
  readonly state: string
  /** The origin pair this attempt resolved to, for diagnostics. */
  readonly authBaseUrl: string
  readonly apiBaseUrl: string
  /**
   * Redeem a code the user pasted. Validates state when the issuer supplied
   * one, exchanges at the auth origin, and reads the granted scope back.
   */
  redeem(code: string, returnedState?: string): Promise<OrcaCredential>
  /** True once a credential was issued or the attempt was cancelled. */
  isSettled(): boolean
}

export interface StartOrcaRouterAuthorizeOptions extends OrcaRouterOriginOptions, OrcaRouterAuthorizeParams {
  /** Injected for tests; defaults to the platform `fetch`. */
  fetchImpl?: typeof fetch
  /** Injected for tests; defaults to `createPkceChallenge`. */
  createChallenge?: () => Promise<PkceChallenge>
}

export type { OrcaRouterOriginOptions }

function pickFetch(fetchImpl?: typeof fetch): typeof fetch {
  const resolved = fetchImpl ?? (globalThis.fetch as typeof fetch | undefined)
  if (!resolved) {
    throw new OrcaAuthError('network', 'No fetch implementation is available')
  }
  return resolved
}

/**
 * Build the consent-screen URL and the single-use verifier for one attempt.
 *
 * The verifier never leaves this process and is deliberately absent from the
 * returned URL, from logs, and from every error surfaced to the UI.
 */
export async function startOrcaRouterAuthorize(
  options: StartOrcaRouterAuthorizeOptions = {}
): Promise<OrcaRouterAuthorizeSession> {
  const origins = resolveOrcaRouterOrigins(options)
  const createChallenge = options.createChallenge ?? createPkceChallenge
  const fetchImpl = pickFetch(options.fetchImpl)

  const { verifier, challenge, state } = await createChallenge()

  const authorizeUrl = new URL(buildOrcaRouterAuthorizeUrl(origins.authBaseUrl))
  authorizeUrl.searchParams.set('callback_url', ORCAROUTER_OOB_CALLBACK)
  authorizeUrl.searchParams.set('code_challenge', challenge)
  // Mandatory for a displayed code, and sent for every flow: a Flow A user can
  // still choose "Show me a code" on the consent screen.
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('app_name', options.appName?.trim() || ORCAROUTER_APP_NAME)
  authorizeUrl.searchParams.set('scope', options.scope?.trim() || ORCAROUTER_SCOPE_API)

  if (options.loginHint?.trim()) {
    authorizeUrl.searchParams.set('login_hint', options.loginHint.trim())
  }
  if (options.workspaceHint?.trim()) {
    authorizeUrl.searchParams.set('workspace_hint', options.workspaceHint.trim())
  }
  if (options.prompt?.trim()) {
    authorizeUrl.searchParams.set('prompt', options.prompt.trim())
  }

  let settled = false
  const requestedScope = options.scope?.trim() || ORCAROUTER_SCOPE_API

  return {
    authorizeUrl: authorizeUrl.toString(),
    state,
    authBaseUrl: origins.authBaseUrl,
    apiBaseUrl: origins.apiBaseUrl,
    isSettled: () => settled,
    async redeem(code: string, returnedState?: string): Promise<OrcaCredential> {
      if (settled) {
        throw new OrcaAuthError('expired-or-reused-code', 'This login attempt already finished')
      }

      if (returnedState !== undefined && !timingSafeEqual(returnedState, state)) {
        settled = true
        throw new OrcaAuthError(
          'state-mismatch',
          'Authorization response did not match this login attempt'
        )
      }

      const trimmedCode = (code ?? '').trim()
      if (!trimmedCode) {
        throw new OrcaAuthError('expired-or-reused-code', 'An authorization code is required')
      }

      const credential = await exchangeOrcaRouterAuthCode({
        code: trimmedCode,
        codeVerifier: verifier,
        authBaseUrl: origins.authBaseUrl,
        requestedScope,
        fetchImpl
      })

      settled = true
      return credential
    }
  }
}

export interface ExchangeOrcaRouterAuthCodeOptions {
  code: string
  /** Never logged, never placed in a URL. */
  codeVerifier: string
  authBaseUrl: string
  requestedScope?: string
  fetchImpl?: typeof fetch
}

interface ExchangeSuccessBody {
  key?: unknown
  user_id?: unknown
  scope?: unknown
}

/**
 * POST the auth code and verifier to `/api/v1/auth/keys` (never `/v1/auth/keys`)
 * and map every documented failure onto a terminal {@link OrcaAuthError}.
 */
export async function exchangeOrcaRouterAuthCode(
  options: ExchangeOrcaRouterAuthCodeOptions
): Promise<OrcaCredential> {
  const fetchImpl = pickFetch(options.fetchImpl)
  const requestedScope = options.requestedScope?.trim() || ORCAROUTER_SCOPE_API

  let response: Response
  try {
    response = await fetchImpl(buildOrcaRouterExchangeUrl(options.authBaseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: options.code,
        code_verifier: options.codeVerifier,
        code_challenge_method: 'S256'
      })
    })
  } catch (error) {
    // Transport failure: give up rather than hot-loop.
    throw new OrcaAuthError('network', 'Could not reach the OrcaRouter authorization service', {
      retryable: true,
      cause: error
    })
  }

  if (!response.ok) {
    throw mapExchangeFailure(response.status, requestedScope)
  }

  let body: ExchangeSuccessBody
  try {
    body = (await response.json()) as ExchangeSuccessBody
  } catch (error) {
    throw new OrcaAuthError('malformed-response', 'OrcaRouter returned an unreadable response', {
      cause: error
    })
  }

  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key) {
    throw new OrcaAuthError(
      'malformed-response',
      'OrcaRouter did not return a key for this authorization'
    )
  }

  // `scope` is what was *granted*, not what was asked for. A narrower grant
  // than the caller needs must be reported, not silently assumed away.
  const grantedScope = typeof body.scope === 'string' && body.scope.trim()
    ? body.scope.trim()
    : ''
  if (!grantedScope) {
    throw new OrcaAuthError(
      'scope-downgrade',
      'OrcaRouter did not report the granted scope, so the authorization was not accepted'
    )
  }
  if (!scopeSatisfies(grantedScope, requestedScope)) {
    throw new OrcaAuthError(
      'scope-downgrade',
      `OrcaRouter granted scope "${grantedScope}" but "${requestedScope}" is required`
    )
  }

  return {
    apiKey: key,
    source: 'oauth-pkce',
    scope: grantedScope,
    userId: typeof body.user_id === 'string' ? body.user_id : undefined,
    generation: 0
  }
}

/**
 * A grant satisfies the request when it contains the requested scope. The
 * comparison is exact per token: `connector` does not imply `api`.
 */
export function scopeSatisfies(grantedScope: string, requestedScope: string): boolean {
  const granted = grantedScope.split(/\s+/).filter(Boolean)
  return granted.includes(requestedScope)
}

function mapExchangeFailure(status: number, requestedScope: string): OrcaAuthError {
  if (status === 400) {
    return new OrcaAuthError(
      'expired-or-reused-code',
      'OrcaRouter rejected the PKCE challenge method for this authorization'
    )
  }
  if (status === 401 || status === 403) {
    return new OrcaAuthError(
      'expired-or-reused-code',
      'The authorization code is unknown, expired, already used, or does not match this attempt',
      { status }
    )
  }
  if (status === 429) {
    return new OrcaAuthError(
      'rate-limited',
      'Too many OrcaRouter authorizations were issued recently for this account',
      { status, retryable: true }
    )
  }
  return new OrcaAuthError(
    'malformed-response',
    `OrcaRouter rejected the authorization exchange (HTTP ${status}) for scope "${requestedScope}"`,
    { status }
  )
}
