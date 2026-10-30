const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readMagpiePort, discoverDesktopLocalServices } = require('./local-discovery');

test('reads only a valid port from the documented configuration location', async () => {
  let actual;
  const port = await readMagpiePort(async file => { actual = file; return '{"port":4567,"private":"not returned"}'; }, {}, '/test-home');
  assert.equal(port, 4567);
  assert.equal(actual, path.join('/test-home', '.config', 'magpie', 'settings.json'));
  await readMagpiePort(async file => { actual = file; return '{}'; }, { XDG_CONFIG_HOME: '/xdg' }, '/test-home');
  assert.equal(actual, path.join('/xdg', 'magpie', 'settings.json'));
});

test('missing, malformed, or invalid settings fall back to the default port', async () => {
  for (const data of ['bad json', '{}', '{"port":"3425"}', '{"port":0}', '{"port":65536}']) {
    assert.equal(await readMagpiePort(async () => data, {}, '/home'), undefined);
  }
  assert.equal(await readMagpiePort(async () => { throw new Error('missing'); }), undefined);
});

test('desktop discovery verifies a real loopback HTTP response and ignores redirects', async () => {
  const http = require('node:http');
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    assert.equal(req.headers.authorization, undefined);
    if (req.url === '/') { res.writeHead(302, { Location: 'http://example.com/' }); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/lmstudio-greeting') { res.end('{"lmstudio":true}'); return; }
    if (req.url === '/health') { res.end('{"status":"healthy","timestamp":"2026-10-29T00:00:00Z"}'); return; }
    if (req.url === '/status') { res.end(JSON.stringify({ running: true, address: '127.0.0.1', port: server.address().port, active_connections: 0, total_requests: 0, success_requests: 0, failed_requests: 0, uptime_seconds: 1, failover_count: 0, active_targets: [] })); return; }
    if (req.url === '/api/hello') res.end('{"name":"magpie"}');
    else {
      res.writeHead(404); res.end('{}');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const found = await discoverDesktopLocalServices({ ollama: port, magpie: port, lmstudio: port, 'cc-switch': port, cliproxyapi: port, litellm: port, llamacpp: port });
    assert.equal(found[0].status, 'unavailable');
    assert.equal(found[1].status, 'ready');
    assert.equal(found.find(service => service.kind === 'cliproxyapi').status, 'unavailable');
    assert.ok(found.every(service => service.models.length === 0));
    assert.ok(requests.every(url => !url.includes('models') && url !== '/api/tags'));
    assert.ok(found.every(service => !['lmstudio', 'cc-switch'].includes(service.kind)));
    assert.ok(requests.every(url => !['/lmstudio-greeting', '/status'].includes(url)));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
