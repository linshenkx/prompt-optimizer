import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { isPublicShellResponse } from '../packages/web/src/pwa/policy.ts'

const exec = promisify(execFile)
const repository = path.resolve(import.meta.dirname, '..')
// This image only executes Nginx for configuration regression tests. Production
// still uses the runtime specified by Dockerfile. A local image can be reused.
const image = process.env.DOCKER_PWA_TEST_IMAGE || 'nginx:1.28.0-alpine'
const credential = `pwa-test:${randomUUID()}`
const authorization = `Basic ${Buffer.from(credential).toString('base64')}`
const evidence = { image, runtime: '', probes: [] }

async function docker(...args) {
  return exec('docker', args, { timeout: 120_000, maxBuffer: 1024 * 1024 })
}

test('Docker serves a public PWA shell without caching configuration, APIs or authenticated responses', { timeout: 180_000 }, async (t) => {
  try {
    await exec('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 10_000 })
  } catch (error) {
    if (process.env.CI || process.env.DOCKER_PWA_TEST_REQUIRED === '1') throw error
    t.skip('Docker daemon unavailable: Nginx HTTP regression was not executed (required in CI).')
    return
  }

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-optimizer-nginx-'))
  const containers = []
  try {
    try {
      await docker('image', 'inspect', image)
    } catch {
      await docker('pull', image)
    }
    evidence.runtime = (await docker('run', '--rm', '--entrypoint', 'nginx', image, '-v')).stderr.trim()

    const html = path.join(temp, 'html')
    await fs.cp(path.join(repository, 'packages/web/public'), html, { recursive: true })
    await fs.mkdir(path.join(html, 'assets'), { recursive: true })
    await fs.mkdir(path.join(html, 'unlisted'), { recursive: true })
    const fixtureEntry = '<!doctype html><title>PWA Nginx regression fixture</title>'
    await Promise.all([
      fs.writeFile(path.join(html, 'index.html'), fixtureEntry),
      fs.writeFile(path.join(html, '50x.html'), '<title>Upstream unavailable</title>'),
      fs.writeFile(path.join(html, 'sw.js'), 'self.addEventListener("install", () => {});'),
      fs.writeFile(path.join(html, 'config.js'), 'window.runtime_config = { regression: true };'),
      fs.writeFile(path.join(html, 'manifest.webmanifest'), '{"name":"PWA Nginx regression fixture"}'),
      fs.writeFile(path.join(html, 'assets', 'app-test.js'), 'export const fixture = true;'),
      fs.writeFile(path.join(html, 'assets', 'app-test.css'), 'body { color: black; }'),
      fs.writeFile(path.join(html, 'assets', '.private.js'), 'private fixture'),
      fs.writeFile(path.join(html, 'unlisted', 'existing.png'), 'uncategorized static fixture'),
      fs.writeFile(path.join(html, 'unlisted', '.private.js'), 'private fixture'),
      fs.writeFile(path.join(temp, 'nginx.conf'), [
        'pid /tmp/nginx.pid;',
        'error_log /dev/stderr warn;',
        'events {}',
        'http {',
        '  include /etc/nginx/mime.types;',
        '  default_type application/octet-stream;',
        // Match the Alpine runtime: auth.conf and default.conf both live here.
        '  include /etc/nginx/http.d/*.conf;',
        '}',
      ].join('\n')),
      fs.writeFile(path.join(temp, 'htpasswd'), `pwa-test:{SHA}${createHash('sha1').update(credential.slice('pwa-test:'.length)).digest('base64')}\n`),
    ])
    const configuration = (await fs.readFile(path.join(repository, 'docker/nginx.conf'), 'utf8'))
      .replaceAll('${NGINX_PORT}', '80')

    async function start(authenticated, index) {
      const conf = path.join(temp, authenticated ? 'basic' : 'open')
      await fs.mkdir(conf)
      await fs.writeFile(path.join(conf, 'default.conf'), configuration)
      await fs.writeFile(path.join(conf, 'auth.conf'), authenticated
        ? 'auth_basic "PWA regression";\nauth_basic_user_file /etc/nginx/pwa-test.htpasswd;\n'
        : 'auth_basic off;\n')
      const name = `po-pwa-regression-${randomUUID().slice(0, 8)}`
      containers.push(name)
      const basePort = Number(process.env.DOCKER_PWA_TEST_PORT || 0)
      const port = basePort ? String(basePort + index) : ''
      await docker('run', '--detach', '--pull=never', '--name', name,
        '--publish', `127.0.0.1:${port}:80`,
        '--mount', `type=bind,src=${conf},dst=/etc/nginx/http.d,readonly`,
        '--mount', `type=bind,src=${html},dst=/usr/share/nginx/html,readonly`,
        // mkdtemp is 0700 on Linux. Mount the generated credential file directly
        // so unprivileged Nginx workers need not traverse the private temp root.
        '--mount', `type=bind,src=${path.join(temp, 'htpasswd')},dst=/etc/nginx/pwa-test.htpasswd,readonly`,
        '--mount', `type=bind,src=${temp},dst=/verify,readonly`,
        '--entrypoint', 'nginx', image, '-c', '/verify/nginx.conf', '-g', 'daemon off;')
      const bindings = JSON.parse((await docker('inspect', '--format', '{{json .NetworkSettings.Ports}}', name)).stdout)
      const origin = `http://127.0.0.1:${bindings['80/tcp'][0].HostPort}`
      const readyBy = Date.now() + 15_000
      while (true) {
        try {
          await fetch(origin, { signal: AbortSignal.timeout(2000) })
          return origin
        } catch (error) {
          if (Date.now() >= readyBy) {
            t.diagnostic((await docker('logs', name)).stderr)
            throw error
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    const open = await start(false, 0)
    const basic = await start(true, 1)
    t.diagnostic(`${evidence.runtime}; public=${open}; Basic Auth=${basic}`)

    async function probe(origin, resource, options = {}) {
      const response = await fetch(`${origin}${resource}`, { ...options, signal: AbortSignal.timeout(5000) })
      const body = await response.text()
      evidence.probes.push({
        authenticatedDeployment: origin === basic,
        resource,
        method: options.method || 'GET',
        credentialsSent: Boolean(options.headers?.Authorization),
        status: response.status,
        headers: Object.fromEntries(response.headers),
        bodySha256: createHash('sha256').update(body).digest('hex'),
        publicShellAccepted: isPublicShellResponse(response),
      })
      return { response, body }
    }

    async function probeRawPath(origin, resource) {
      // fetch/new URL normalize dot segments before transmission. http.request's
      // path option preserves the original request target for Nginx to process.
      const response = await new Promise((resolve, reject) => {
        const request = http.request(origin, { path: resource }, incoming => {
          const chunks = []
          incoming.on('data', chunk => chunks.push(chunk))
          incoming.on('end', () => resolve(new Response(Buffer.concat(chunks), {
            status: incoming.statusCode,
            headers: incoming.headers,
          })))
          incoming.on('error', reject)
        })
        request.setTimeout(5000, () => request.destroy(new Error('Raw-path HTTP probe timed out')))
        request.on('error', reject)
        request.end()
      })
      const body = await response.text()
      evidence.probes.push({ resource, rawRequestTarget: true, status: response.status,
        headers: Object.fromEntries(response.headers),
        bodySha256: createHash('sha256').update(body).digest('hex'),
        publicShellAccepted: isPublicShellResponse(response) })
      return { response, body }
    }

    function assertSafetyHeaders(response) {
      assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN')
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert.ok(response.headers.get('content-security-policy'))
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer-when-downgrade')
    }

    await t.test('public build files retain MIME types and security headers and are accepted by the real worker policy', async () => {
      for (const [resource, mime] of [
        ['/', /text\/html/], ['/index.html', /text\/html/],
        ['/manifest.webmanifest', /application\/manifest\+json/],
        ['/favicon.ico', /image\//], ['/pwa/icon-192.png', /image\/png/],
        ['/pwa/icon-512.png', /image\/png/], ['/pwa/maskable-512.png', /image\/png/],
        ['/pwa/apple-touch-icon.png', /image\/png/],
        ['/assets/app-test.js', /(?:application|text)\/javascript/], ['/assets/app-test.css', /text\/css/],
      ]) {
        const { response } = await probe(open, resource)
        assert.equal(response.status, 200, resource)
        assert.match(response.headers.get('content-type'), mime, resource)
        assertSafetyHeaders(response)
        assert.equal(isPublicShellResponse(response), true, resource)
        assert.match(response.headers.get('cache-control'), resource.startsWith('/assets/')
          ? /max-age=604800/ : /max-age=0, must-revalidate/)
      }
      // Catch newly added public build files that the deployment allowlist would
      // reject during a real precache installation. Runtime config is excluded.
      const publicFiles = await fs.readdir(path.join(repository, 'packages/web/public'), { recursive: true })
      for (const file of publicFiles.filter(file => file !== 'config.js' && /\.(html|js|css|png|svg|ico|woff|woff2)$/.test(file))) {
        const resource = `/${file.replaceAll(path.sep, '/')}`
        const { response } = await probe(open, resource)
        assert.equal(response.status, 200, resource)
        assert.equal(isPublicShellResponse(response), true, `public build resource ${resource} must be precacheable`)
      }
    })

    await t.test('conditional requests retain cache policy and security headers on 304 responses', async () => {
      for (const resource of ['/index.html', '/assets/app-test.js', '/pwa/icon-192.png']) {
        const first = (await probe(open, resource)).response
        assert.ok(first.headers.get('etag'), resource)
        const { response } = await probe(open, resource, { headers: { 'If-None-Match': first.headers.get('etag') } })
        assert.equal(response.status, 304, resource)
        assert.equal(response.headers.get('cache-control'), first.headers.get('cache-control'), resource)
        assertSafetyHeaders(response)
      }
    })

    await t.test('worker, runtime configuration, unknown paths, API-like paths and queries stay uncached', async () => {
      for (const resource of ['/sw.js', '/config.js', '/?query=1', '/index.html?query=1',
        '/assets/app-test.js?query=1', '/nested/workspace', '/api/session', '/api/result.png',
        '/unlisted/existing.png']) {
        const { response } = await probe(open, resource)
        assert.equal(response.headers.get('cache-control'), 'no-store', resource)
        assert.equal(isPublicShellResponse(response), false, resource)
        assertSafetyHeaders(response)
      }
      for (const resource of ['/sw.js', '/config.js']) {
        const { response } = await probe(open, resource)
        assert.equal(response.status, 200, resource)
        assert.match(response.headers.get('content-type'), /(?:application|text)\/javascript/, resource)
      }
      for (const [resource, method] of [['/mcp', 'GET'], ['/mcp/result.js', 'GET'], ['/mcp', 'OPTIONS'], ['/healthz', 'GET']]) {
        const { response } = await probe(open, resource, { method })
        assert.equal(response.status, method === 'OPTIONS' ? 204 : 502, `${method} ${resource} preserves proxy routing`)
        assert.equal(response.headers.get('cache-control'), 'no-store', `${method} ${resource}`)
      }
      const authorized = (await probe(open, '/index.html', { headers: { Authorization: authorization } })).response
      assert.equal(authorized.headers.get('cache-control'), 'no-store')
    })

    await t.test('missing build resources return 404 without a successful SPA fallback or cache permission', async () => {
      for (const resource of ['/missing.js', '/assets/missing.js', '/pwa/missing.png', '/missing.webmanifest']) {
        const { response, body } = await probe(open, resource)
        assert.equal(response.status, 404, resource)
        assert.equal(response.headers.get('cache-control'), 'no-store', resource)
        assert.notEqual(body, fixtureEntry, resource)
        assertSafetyHeaders(response)
      }
      const { response, body } = await probe(open, '/nested/workspace')
      assert.equal(response.status, 200)
      assert.equal(body, fixtureEntry)
      for (const resource of ['/assets/.private.js', '/unlisted/.private.js', '/mcp/.private.js']) {
        const result = await probe(open, resource)
        assert.equal(result.response.status, 403, resource)
        assert.equal(result.response.headers.get('cache-control'), 'no-store', resource)
        assert.equal(result.body.includes('private fixture'), false, resource)
      }
    })

    await t.test('encoded and dot-segment paths cannot borrow a public prefix for private resources', async () => {
      for (const target of ['config.js', 'sw.js', 'unlisted/existing.png']) {
        const normal = await probe(open, `/${target}`)
        for (const prefix of ['/assets/../', '/assets/%2e%2e%2f', '/assets/..%2F',
          '/assets/%2E%2E/', '/assets/./../', '/pwa/../']) {
          const resource = `${prefix}${target}`
          const { response, body } = await probeRawPath(open, resource)
          assert.equal(response.status, 200, resource)
          assert.equal(body, normal.body, `${resource} resolves to ${target}`)
          assert.equal(response.headers.get('cache-control'), 'no-store', resource)
          assert.equal(isPublicShellResponse(response), false, resource)
        }
      }
    })

    await t.test('Basic Auth keeps the protected shell online but never exposes it to credential-free worker installs', async () => {
      for (const resource of ['/', '/index.html', '/sw.js', '/config.js', '/manifest.webmanifest',
        '/pwa/icon-192.png', '/assets/app-test.js', '/nested/workspace']) {
        const anonymous = (await probe(basic, resource)).response
        assert.equal(anonymous.status, 401, resource)
        assert.match(anonymous.headers.get('www-authenticate'), /^Basic /, resource)
        assert.equal(anonymous.headers.get('cache-control'), 'no-store', resource)
        assert.equal(isPublicShellResponse(anonymous), false, resource)
        const { response } = await probe(basic, resource, { headers: { Authorization: authorization } })
        assert.equal(response.status, 200, resource)
        assert.equal(response.headers.get('cache-control'), 'no-store', resource)
        assert.equal(isPublicShellResponse(response), false, resource)
        assertSafetyHeaders(response)
      }
    })
  } finally {
    const cleanupErrors = []
    for (const name of containers) {
      try {
        await docker('rm', '--force', name)
      } catch (error) {
        // A failed run may not have created its named container. Other cleanup
        // failures are surfaced after attempting every container and temp file.
        if (!/No such container/i.test(error.stderr || '')) cleanupErrors.push(error)
      }
    }
    if (process.env.DOCKER_PWA_TEST_EVIDENCE_DIR) {
      const directory = path.resolve(process.env.DOCKER_PWA_TEST_EVIDENCE_DIR)
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(path.join(directory, 'http-regression.json'), `${JSON.stringify(evidence, null, 2)}\n`)
    }
    // Only remove this test's freshly-created temporary directory.
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()))
    assert.ok(path.basename(temp).startsWith('prompt-optimizer-nginx-'))
    await fs.rm(temp, { recursive: true, force: true })
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Nginx regression container cleanup failed')
  }
})
