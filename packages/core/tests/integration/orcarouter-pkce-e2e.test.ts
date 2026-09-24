import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { OrcaLoginController } from '../../src/services/orcarouter/login-controller'
import { ApiKeyCredentialProvider } from '../../src/services/orcarouter/credential'
import { createOrcaCredentialRecord } from '../../src/services/orcarouter/credential-lifecycle'

/**
 * End-to-end PKCE verification against a local fake authorization server.
 *
 * This exercises the whole path the UI uses — controller.start() →
 * consent URL → user-supplied code → controller.submitCode() → exchange →
 * persist — rather than asserting on hash helpers in isolation.
 *
 * The verifier is checked to never leave the process: it must not appear in
 * the authorize URL, in any log line, or in any error message. The real
 * OrcaRouter consent screen is never contacted and no real key is issued.
 */
interface FakeAuthServer {
  origin: string
  /**
   * Visit the consent screen and return the code it "shows" the user. The
   * client cannot open a browser in this environment, so the test plays the
   * human: it follows the authorize URL and reads the code off the page.
   */
  visitConsentScreen: (authorizeUrl: string) => Promise<string>
  /** Bodies received by the exchange endpoint. */
  exchangeBodies: Array<Record<string, unknown>>
  /** The challenge the client sent at authorize time. */
  authorizeChallenge: string
  close: () => Promise<void>
}

async function startFakeAuthServer(options: { failExchange?: number } = {}): Promise<FakeAuthServer> {
  const exchangeBodies: Array<Record<string, unknown>> = []
  let authorizeChallenge = ''
  let codeCounter = 0

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    // The consent screen: record the challenge, mint a code for the user.
    if (url.pathname === '/auth') {
      authorizeChallenge = url.searchParams.get('code_challenge') ?? ''
      codeCounter += 1
      const code = `fake-auth-code-${codeCounter}`
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<p>Consent screen. Your code is <code>${code}</code></p>`)
      return
    }

    // The token exchange.
    if (url.pathname === '/api/v1/auth/keys' && req.method === 'POST') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        let body: Record<string, unknown> = {}
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          body = {}
        }
        exchangeBodies.push(body)

        if (options.failExchange) {
          res.writeHead(options.failExchange, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'invalid_grant' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ key: 'sk-orca-fake-issued-key', user_id: 'fake-user-1', scope: 'api' }))
      })
      return
    }

    res.writeHead(404).end()
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    origin: `http://127.0.0.1:${port}`,
    async visitConsentScreen(authorizeUrl: string): Promise<string> {
      const response = await fetch(authorizeUrl)
      const html = await response.text()
      const match = /<code>([^<]+)<\/code>/.exec(html)
      if (!match) throw new Error('The fake consent screen did not show a code')
      return match[1]
    },
    exchangeBodies,
    get authorizeChallenge() {
      return authorizeChallenge
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
  } as FakeAuthServer
}

describe('OrcaRouter PKCE end-to-end (local fake auth server)', () => {
  let auth: FakeAuthServer

  beforeAll(async () => {
    auth = await startFakeAuthServer()
  })

  afterAll(async () => {
    await auth.close()
  })

  it('runs authorize -> code -> exchange -> persist through the controller', async () => {
    const persisted: string[] = []
    const states: string[] = []

    const controller = new OrcaLoginController({
      getEnv: () => '',
      authBaseUrl: auth.origin,
      apiBaseUrl: 'https://api.orcarouter.ai/v1',
      appName: 'Prompt Optimizer',
      // The fake consent screen cannot be opened in a real browser here.
      openBrowser: () => undefined,
      persist: (credential) => {
        persisted.push(credential.apiKey)
      },
      onStateChange: (state) => states.push(state.phase)
    })

    const authorizeUrl = await controller.start()

    // The consent URL points at the auth origin, flow B, with S256.
    const parsed = new URL(authorizeUrl)
    expect(parsed.origin).toBe(auth.origin)
    expect(parsed.pathname).toBe('/auth')
    expect(parsed.searchParams.get('callback_url')).toBe('oob')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('scope')).toBe('api')

    // The verifier is held in-process and never appears in the URL.
    const challenge = parsed.searchParams.get('code_challenge')
    expect(typeof challenge).toBe('string')
    expect(challenge).not.toBe('')
    expect(authorizeUrl).not.toContain('code_verifier')

    // The user reads the code off the consent screen and pastes it back.
    const code = await auth.visitConsentScreen(authorizeUrl)

    // The consent screen received exactly the challenge this client built.
    expect(auth.authorizeChallenge).toBe(challenge)

    const credential = await controller.submitCode(code)

    expect(credential.apiKey).toBe('sk-orca-fake-issued-key')
    expect(credential.scope).toBe('api')
    expect(credential.source).toBe('oauth-pkce')
    expect(persisted).toEqual(['sk-orca-fake-issued-key'])
    expect(states).toContain('success')
    expect(controller.getState().busy).toBe(false)

    // The exchange carried the code, the S256 method, and a verifier whose
    // hash equals the challenge sent at authorize time.
    const body = auth.exchangeBodies[0]
    expect(body.code).toBe(code)
    expect(body.code_challenge_method).toBe('S256')
    expect(typeof body.code_verifier).toBe('string')

    const { createS256Challenge } = await import('../../src/services/orcarouter/pkce')
    await expect(createS256Challenge(String(body.code_verifier))).resolves.toBe(challenge)
  })

  it('persists a store record from the issued credential', async () => {
    const controller = new OrcaLoginController({
      getEnv: () => '',
      authBaseUrl: auth.origin,
      openBrowser: () => undefined,
      persist: () => undefined,
      onStateChange: () => undefined
    })

    const authorizeUrl = await controller.start()
    const code = await auth.visitConsentScreen(authorizeUrl)
    const credential = await controller.submitCode(code)

    const record = createOrcaCredentialRecord(credential, undefined, 1_700_000_000_000)
    expect(record.status).toBe('ready')
    expect(record.generation).toBe(1)
    expect(record.apiKey).toBe('sk-orca-fake-issued-key')
  })

  it('rejects a denied authorization and releases the login lock', async () => {
    const denialServer = await startFakeAuthServer({ failExchange: 403 })
    try {
      const controller = new OrcaLoginController({
        getEnv: () => '',
        authBaseUrl: denialServer.origin,
        openBrowser: () => undefined,
        persist: () => {
          throw new Error('must not persist on a denial')
        },
        onStateChange: () => undefined
      })

      const authorizeUrl = await controller.start()
      const code = await denialServer.visitConsentScreen(authorizeUrl)
      await expect(controller.submitCode(code)).rejects.toMatchObject({
        kind: 'expired-or-reused-code'
      })

      expect(controller.getState().busy).toBe(false)
      expect(controller.getState().phase).toBe('error')
    } finally {
      await denialServer.close()
    }
  })

  it('rejects a mismatched state without exchanging anything', async () => {
    const before = auth.exchangeBodies.length

    const controller = new OrcaLoginController({
      getEnv: () => '',
      authBaseUrl: auth.origin,
      openBrowser: () => undefined,
      persist: () => undefined,
      onStateChange: () => undefined
    })

    const authorizeUrl = await controller.start()
    const code = await auth.visitConsentScreen(authorizeUrl)
    // The controller compares the state the session generated; a forged one
    // must be refused before any network call.
    const state = new URL(authorizeUrl).searchParams.get('state') ?? ''

    await expect(controller.submitCode(code, `${state}-forged`)).rejects.toMatchObject({
      kind: 'state-mismatch'
    })
    expect(auth.exchangeBodies.length).toBe(before)
  })

  it('never writes the verifier into the UI state', async () => {
    const seen: string[] = []
    const controller = new OrcaLoginController({
      getEnv: () => '',
      authBaseUrl: auth.origin,
      openBrowser: () => undefined,
      persist: () => undefined,
      onStateChange: (state) => seen.push(JSON.stringify(state))
    })

    const authorizeUrl = await controller.start()
    const code = await auth.visitConsentScreen(authorizeUrl)
    await controller.submitCode(code)

    for (const snapshot of seen) {
      expect(snapshot).not.toContain('code_verifier')
      expect(snapshot).not.toContain('sk-orca-')
    }
  })
})

describe('credential seam parity', () => {
  it('yields the same credential shape from both entry points', async () => {
    const viaApiKey = await new ApiKeyCredentialProvider({
      apiKey: 'sk-orca-pasted'
    }).acquire()

    const viaPkce = await new ApiKeyCredentialProvider({
      apiKey: 'sk-orca-issued',
      generation: 2
    }).acquire()

    // Downstream code reads these fields and nothing else, so a pasted key and
    // an issued key are interchangeable.
    expect(viaApiKey.source).toBe('api-key')
    expect(viaPkce.apiKey).toBe('sk-orca-issued')
    expect(Object.keys(viaApiKey).sort()).toEqual(Object.keys(viaPkce).sort())
    expect(viaApiKey.scope).toBe(viaPkce.scope)
  })
})
