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
 * Login lifecycle for the "Connect with OrcaRouter" button.
 *
 * Every terminal path must release both the busy flag and the authorization
 * hint: success, denial, exchange error, timeout, explicit cancel, switching
 * provider, closing the modal, unmount, reload and `pagehide`.
 *
 * `pagehide` is the subtle one. Browsers may restore the mounted page from the
 * back-forward cache, so the invalidated request's guarded `finally` block will
 * correctly refuse to mutate state — leaving the restored page busy forever.
 * The `pagehide` handler therefore clears busy/hint synchronously itself, and
 * only then asks the server-side work to stop.
 */

import { OrcaAuthError, describeOrcaAuthError, type OrcaCredential } from './credential'
import { startOrcaRouterAuthorize } from './pkce-flow'
import type {
  OrcaRouterAuthorizeParams,
  OrcaRouterAuthorizeSession,
  StartOrcaRouterAuthorizeOptions
} from './pkce-flow'

export type OrcaLoginPhase =
  | 'idle'
  | 'authorizing'
  | 'awaiting-code'
  | 'exchanging'
  | 'success'
  | 'error'

export interface OrcaLoginState {
  readonly phase: OrcaLoginPhase
  /** Masked authorization URL for browsers that do not open automatically. */
  readonly authorizeUrl?: string
  /** True while a login occupies the single-login lock. */
  readonly busy: boolean
  /** User-facing, secret-free status text. */
  readonly hint?: string
  readonly error?: string
}

export interface OrcaLoginControllerOptions extends StartOrcaRouterAuthorizeOptions, OrcaRouterAuthorizeParams {
  /** Called on every state transition. Must not throw. */
  onStateChange: (state: OrcaLoginState) => void
  /** Opens the consent screen. Rejections are reported through `hint`. */
  openBrowser?: (url: string) => void | Promise<void>
  /** Performs the final persistence of the credential. */
  persist: (credential: OrcaCredential) => Promise<void> | void
  /** Injected for tests. */
  startAuthorize?: typeof startOrcaRouterAuthorize
  /** Clock, injected for tests. */
  now?: () => number
  /** Attempt timeout; the auth code itself is valid for 10 minutes. */
  timeoutMs?: number
}

const DEFAULT_LOGIN_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Owns one provider's login attempt at a time. A second `start()` while busy is
 * rejected rather than silently superseding the first.
 */
export class OrcaLoginController {
  private readonly options: OrcaLoginControllerOptions
  private session?: OrcaRouterAuthorizeSession
  private generation = 0
  private state: OrcaLoginState = { phase: 'idle', busy: false }
  private timer?: ReturnType<typeof setTimeout>

  constructor(options: OrcaLoginControllerOptions) {
    this.options = options
  }

  getState(): OrcaLoginState {
    return this.state
  }

  /** Current generation. Exposed so tests can assert staleness handling. */
  getGeneration(): number {
    return this.generation
  }

  private emit(next: Partial<OrcaLoginState>, generation: number): void {
    // A response from a superseded attempt must never touch current state.
    if (generation !== this.generation) return
    this.state = { ...this.state, ...next }
    try {
      this.options.onStateChange(this.state)
    } catch {
      // UI callbacks must not break the flow.
    }
  }

  /** The URL the user can copy when the browser does not open automatically. */
  getAuthorizeUrl(): string | undefined {
    return this.state.authorizeUrl
  }

  /**
   * Begin a login. Returns the authorize URL, or throws when a login is
   * already running or the attempt could not be started.
   */
  async start(): Promise<string> {
    if (this.state.busy) {
      throw new OrcaAuthError('cancelled', 'An OrcaRouter login is already in progress')
    }

    this.generation += 1
    const generation = this.generation
    this.session = undefined
    this.clearTimer()

    this.state = {
      phase: 'authorizing',
      busy: true,
      hint: 'Opening the OrcaRouter consent screen…'
    }
    this.options.onStateChange(this.state)

    const start = this.options.startAuthorize ?? startOrcaRouterAuthorize

    try {
      const session = await start({
        sharedBaseUrl: this.options.sharedBaseUrl,
        authBaseUrl: this.options.authBaseUrl,
        apiBaseUrl: this.options.apiBaseUrl,
        appName: this.options.appName,
        scope: this.options.scope,
        loginHint: this.options.loginHint,
        workspaceHint: this.options.workspaceHint,
        prompt: this.options.prompt,
        getEnv: this.options.getEnv,
        fetchImpl: this.options.fetchImpl,
        createChallenge: this.options.createChallenge
      })

      if (generation !== this.generation) {
        // A cancel or a newer attempt landed while we awaited the URL.
        return session.authorizeUrl
      }

      this.session = session
      this.emit(
        {
          phase: 'awaiting-code',
          busy: true,
          authorizeUrl: session.authorizeUrl,
          hint: 'Authorize in the browser, then paste the code OrcaRouter shows you.'
        },
        generation
      )

      this.armTimeout(generation)

      try {
        await this.options.openBrowser?.(session.authorizeUrl)
      } catch {
        this.emit(
          { hint: 'Copy the authorization URL below into a browser to continue.' },
          generation
        )
      }

      return session.authorizeUrl
    } catch (error) {
      this.clearTimer()
      this.session = undefined
      if (generation === this.generation) {
        const message = describeOrcaAuthError(error)
        this.state = { phase: 'error', busy: false, hint: undefined, error: message }
        this.options.onStateChange(this.state)
      }
      throw error
    }
  }

  /**
   * Redeem the code the user pasted. Only the code travels here; the verifier
   * stays inside the session created by `start()`.
   */
  async submitCode(code: string, returnedState?: string): Promise<OrcaCredential> {
    const session = this.session
    const generation = this.generation

    if (!session) {
      throw new OrcaAuthError('cancelled', 'No OrcaRouter login is in progress')
    }

    this.emit({ phase: 'exchanging', busy: true, hint: 'Exchanging the code…' }, generation)

    try {
      const credential = await session.redeem(code, returnedState)
      if (generation !== this.generation) {
        // Cancelled mid-exchange: do not persist.
        throw new OrcaAuthError('cancelled', 'Login was cancelled')
      }

      await this.options.persist(credential)
      this.clearTimer()
      this.session = undefined
      this.emit(
        { phase: 'success', busy: false, hint: 'Connected to OrcaRouter.', error: undefined },
        generation
      )
      return credential
    } catch (error) {
      this.clearTimer()
      if (generation === this.generation) {
        const message = describeOrcaAuthError(error)
        this.session = undefined
        this.state = { phase: 'error', busy: false, hint: undefined, error: message }
        this.options.onStateChange(this.state)
      }
      throw error
    }
  }

  /**
   * Explicit user cancel, provider switch, modal close, or unmount.
   * Always releases the single-login lock.
   */
  cancel(reason = 'Login was cancelled'): void {
    this.generation += 1
    this.session = undefined
    this.clearTimer()
    this.state = { phase: 'idle', busy: false }
    try {
      this.options.onStateChange(this.state)
    } catch {
      // ignore
    }
    void reason
  }

  /**
   * Back-forward-cache safe teardown. Clears busy/hint synchronously — the
   * invalidated request's own cleanup will refuse to run, so nothing else can
   * un-busy the restored page — then fires a `keepalive` cancellation so the
   * server-side attempt does not linger.
   *
   * Returns the promise for the server cancellation so tests can await it; the
   * UI must not await it before clearing state.
   */
  handlePageHide(): Promise<void> | undefined {
    const hadPending = !!this.session && this.state.busy
    this.generation += 1
    this.session = undefined
    this.clearTimer()

    // Synchronous, unconditional: the restored page must not be stuck busy.
    this.state = { phase: 'idle', busy: false }
    try {
      this.options.onStateChange(this.state)
    } catch {
      // ignore
    }

    if (!hadPending) return undefined
    return this.cancelServerWork()
  }

  /** Best-effort server-side cancellation; never throws. */
  private async cancelServerWork(): Promise<void> {
    const cancelUrl = (this.options as { cancelUrl?: string }).cancelUrl
    if (!cancelUrl) return

    try {
      await fetch(cancelUrl, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch {
      // A cancelled attempt that cannot report back is still cancelled locally.
    }
  }

  private armTimeout(generation: number): void {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return
      this.session = undefined
      const message = describeOrcaAuthError(
        new OrcaAuthError('timeout', 'The authorization window closed')
      )
      this.state = { phase: 'error', busy: false, hint: undefined, error: message }
      this.options.onStateChange(this.state)
    }, timeoutMs)
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }
}
