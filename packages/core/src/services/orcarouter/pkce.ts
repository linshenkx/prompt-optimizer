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
 * PKCE primitives for the OrcaRouter connect flow.
 *
 * The verifier must come from a cryptographic RNG, must be fresh for every
 * authorization attempt, and must never be logged, printed, put in a URL, or
 * included in an error message. Only its S256 challenge travels on the
 * authorize URL.
 */

const VERIFIER_BYTES = 32
const STATE_BYTES = 16

/** RFC 7636 base64url: URL-safe alphabet, no `=` padding. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : // Node fallback; kept dependency-free on purpose.
      Buffer.from(bytes).toString('base64')

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A PKCE verifier plus the S256 challenge derived from it. */
export interface PkceChallenge {
  /** 43-char base64url string. Never send this to the authorization server. */
  readonly verifier: string
  /** `base64url(sha256(verifier))`, no padding. */
  readonly challenge: string
  /** Opaque CSRF token, echoed back by the consent screen. */
  readonly state: string
}

function getCrypto(): Crypto {
  const webcrypto = (globalThis as { crypto?: Crypto }).crypto
  if (!webcrypto || typeof webcrypto.getRandomValues !== 'function') {
    throw new Error('A cryptographic random number generator is required for OrcaRouter login')
  }
  return webcrypto
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  getCrypto().getRandomValues(bytes)
  return bytes
}

/**
 * Derive the S256 challenge for a verifier: `base64url(sha256(verifier))`
 * with no padding.
 */
export async function createS256Challenge(verifier: string): Promise<string> {
  const crypto = getCrypto()
  if (!crypto.subtle) {
    throw new Error('Web Crypto subtle digest is required for OrcaRouter login')
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Build a fresh verifier/state pair for a single authorization attempt.
 * Callers must not reuse the result across attempts.
 */
export async function createPkceChallenge(): Promise<PkceChallenge> {
  const verifier = base64UrlEncode(randomBytes(VERIFIER_BYTES))
  const state = base64UrlEncode(randomBytes(STATE_BYTES))
  const challenge = await createS256Challenge(verifier)
  return { verifier, challenge, state }
}

/**
 * Constant-time string comparison for the Flow A `state` check. A length
 * mismatch short-circuits, which leaks only the length — the values are
 * fixed-length base64url tokens anyway.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

/**
 * Redact a secret for logs and error surfaces. Only a short, non-reversible
 * fingerprint of the shape is exposed.
 */
export function redactSecret(value: string | undefined | null): string {
  if (!value) return ''
  const trimmed = String(value)
  if (trimmed.length <= 8) return '*'.repeat(trimmed.length)
  return `${trimmed.slice(0, 4)}${'*'.repeat(Math.max(1, trimmed.length - 8))}${trimmed.slice(-4)}`
}

/**
 * True when a string looks like an OrcaRouter key. This is a format check to
 * catch obvious paste mistakes, never a validity check.
 */
export function isOrcaRouterKeyFormat(value: unknown): boolean {
  return typeof value === 'string' && /^sk-orca-[A-Za-z0-9._-]{4,}$/.test(value.trim())
}
