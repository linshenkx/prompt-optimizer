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
 * OrcaRouter origin policy.
 *
 * OrcaRouter exposes two *different* public origins:
 *   - the authorization host, which serves the consent screen and the
 *     `/api/v1/auth/*` endpoints (default `https://www.orcarouter.ai`);
 *   - the inference host, which serves the OpenAI-compatible relay and the
 *     model catalog (default `https://api.orcarouter.ai/v1`).
 *
 * They must never be derived from one another by swapping a hostname or by
 * blindly appending `/v1`: `https://api.orcarouter.ai/v1/auth/keys` is a 404.
 * The only supported way to point both at one self-hosted deployment is the
 * shared `ORCA_BASE_URL` fallback, with `ORCA_AUTH_BASE_URL` /
 * `ORCA_API_BASE_URL` taking precedence over it.
 */

/** Public default for the consent screen and the auth API. */
export const ORCAROUTER_DEFAULT_AUTH_BASE_URL = 'https://www.orcarouter.ai'

/** Public default for inference and model discovery (already includes `/v1`). */
export const ORCAROUTER_DEFAULT_API_BASE_URL = 'https://api.orcarouter.ai/v1'

/** Consent screen path, appended to the auth base. */
export const ORCAROUTER_AUTHORIZE_PATH = '/auth'

/** Auth-code exchange path. Note the `/api/v1/auth` prefix, not `/v1`. */
export const ORCAROUTER_EXCHANGE_PATH = '/api/v1/auth/keys'

/** Model catalog path, relative to the API base. */
export const ORCAROUTER_MODELS_PATH = '/models'

export interface OrcaRouterOriginOptions {
  /** Shared self-hosted base, used when a specific override is absent. */
  sharedBaseUrl?: string
  /** Explicit auth origin override. Wins over `sharedBaseUrl`. */
  authBaseUrl?: string
  /** Explicit API origin override. Wins over `sharedBaseUrl`. */
  apiBaseUrl?: string
  /** Env lookup, injectable for tests. */
  getEnv?: (key: string) => string
}

export interface OrcaRouterOrigins {
  /** Origin used for `/auth` and `/api/v1/auth/keys`. No trailing slash. */
  readonly authBaseUrl: string
  /** Inference base. Always ends with `/v1`. No trailing slash. */
  readonly apiBaseUrl: string
}

export class OrcaRouterOriginError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrcaRouterOriginError'
  }
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Loopback hosts are allowed over plain HTTP for local development; every
 * other remote origin must be HTTPS.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (LOOPBACK_HOSTNAMES.has(normalized)) return true
  return normalized === '::1' || normalized.startsWith('127.')
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Validate one configurable origin. Throws rather than silently downgrading so
 * a misconfigured deployment cannot send credentials in the clear.
 */
export function normalizeOrcaRouterOrigin(raw: string, label: string): string {
  const value = stripTrailingSlash((raw || '').trim())
  if (!value) {
    throw new OrcaRouterOriginError(`${label} must not be empty`)
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new OrcaRouterOriginError(`${label} is not a valid absolute URL: ${value}`)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new OrcaRouterOriginError(`${label} must use http or https, got ${parsed.protocol}`)
  }

  if (parsed.protocol === 'http:' && !isLoopbackHostname(parsed.hostname)) {
    throw new OrcaRouterOriginError(
      `${label} must use HTTPS for non-loopback hosts (got ${value})`
    )
  }

  if (parsed.username || parsed.password) {
    throw new OrcaRouterOriginError(`${label} must not contain userinfo`)
  }

  return stripTrailingSlash(parsed.toString())
}

/** The inference base always carries the `/v1` relay prefix. */
export function normalizeOrcaRouterApiBaseUrl(raw: string, label = 'ORCA_API_BASE_URL'): string {
  const normalized = normalizeOrcaRouterOrigin(raw, label)
  return /\/v1$/.test(normalized) ? normalized : `${normalized}/v1`
}

/**
 * Resolve both origins. Explicit per-origin overrides take precedence over the
 * shared self-hosted fallback; absent all overrides the public defaults apply.
 */
export function resolveOrcaRouterOrigins(
  options: OrcaRouterOriginOptions = {}
): OrcaRouterOrigins {
  const getEnv = options.getEnv ?? (() => '')
  const pick = (explicit: string | undefined, envKey: string): string =>
    (explicit ?? '').trim() || (getEnv(envKey) ?? '').trim()

  const sharedBaseUrl = pick(options.sharedBaseUrl, 'ORCA_BASE_URL')
  const authRaw =
    pick(options.authBaseUrl, 'ORCA_AUTH_BASE_URL') || sharedBaseUrl || ORCAROUTER_DEFAULT_AUTH_BASE_URL
  const apiRaw =
    pick(options.apiBaseUrl, 'ORCA_API_BASE_URL') || sharedBaseUrl || ORCAROUTER_DEFAULT_API_BASE_URL

  return {
    authBaseUrl: normalizeOrcaRouterOrigin(authRaw, 'ORCA_AUTH_BASE_URL'),
    apiBaseUrl: normalizeOrcaRouterApiBaseUrl(apiRaw)
  }
}

/** Absolute URL of the consent screen. */
export function buildOrcaRouterAuthorizeUrl(authBaseUrl: string): string {
  return `${stripTrailingSlash(authBaseUrl)}${ORCAROUTER_AUTHORIZE_PATH}`
}

/** Absolute URL of the auth-code exchange endpoint. */
export function buildOrcaRouterExchangeUrl(authBaseUrl: string): string {
  return `${stripTrailingSlash(authBaseUrl)}${ORCAROUTER_EXCHANGE_PATH}`
}

/** Absolute URL of the model catalog, optionally filtered by capability. */
export function buildOrcaRouterModelsUrl(apiBaseUrl: string, capability?: string): string {
  const base = `${stripTrailingSlash(apiBaseUrl)}${ORCAROUTER_MODELS_PATH}`
  if (!capability) return base
  return `${base}?capability=${encodeURIComponent(capability)}`
}
