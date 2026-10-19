const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { Agent, ProxyAgent, Socks5ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = require('undici');
const { ModelNetworkDispatcher } = require('./model-network');

test('system routing uses each complete target URL and direct rules precede proxy selection', async t => {
  const seen = [];
  const dispatcher = new ModelNetworkDispatcher({
    settings: { mode: 'system', proxyUrl: '', bypassRules: ['llm.company.com', '*.internal.company.com'] },
    fallbackDispatcher: new Agent(), Agent, ProxyAgent, Socks5ProxyAgent,
    resolveProxy: async url => {
      seen.push(url);
      return url.includes('company.net') ? 'DIRECT' : 'PROXY 127.0.0.1:7890';
    },
  });
  t.after(() => dispatcher.close());
  for (const url of ['https://llm.company.com/v1/models', 'https://a.internal.company.com/v1/chat/completions',
    'http://192.168.1.1:8000/v1/models']) {
    assert.equal((await dispatcher.selectRoute(new URL(url))).mode, 'direct');
  }
  assert.equal(seen.length, 0);
  assert.equal((await dispatcher.selectRoute(new URL('https://llm.company.net/v1/models'))).mode, 'direct');
  const first = await dispatcher.selectRoute(new URL('https://api.example.com/v1/models'));
  const second = await dispatcher.selectRoute(new URL('https://api.example.com/v1/chat/completions'));
  assert.equal(first.mode, 'system-proxy');
  assert.equal(first.dispatcher, second.dispatcher);
  assert.deepEqual(seen, ['https://llm.company.net/v1/models', 'https://api.example.com/v1/models',
    'https://api.example.com/v1/chat/completions']);
  assert.equal((await dispatcher.selectRoute(new URL('https://[2001:4860:4860::8888]/models'))).mode, 'system-proxy');
  assert.equal((await dispatcher.selectRoute(new URL('http://[fd12:3456::1]/models'))).mode, 'direct');
});

test('system routing supports HTTPS and SOCKS5 without silently bypassing unsupported decisions', async t => {
  let decision = 'HTTPS localhost:7890';
  const dispatcher = new ModelNetworkDispatcher({
    settings: { mode: 'system', proxyUrl: '', bypassRules: [] },
    fallbackDispatcher: new Agent(), Agent, ProxyAgent, Socks5ProxyAgent, resolveProxy: async () => decision,
  });
  t.after(() => dispatcher.close());
  await dispatcher.selectRoute(new URL('https://example.com'));
  assert.equal(dispatcher.proxies.has('https://localhost:7890'), true);
  decision = 'SOCKS5 localhost:7891';
  await dispatcher.selectRoute(new URL('https://example.com'));
  assert.equal(dispatcher.proxies.has('socks5://localhost:7891'), true);
  decision = 'SOCKS localhost:7892';
  await assert.rejects(dispatcher.selectRoute(new URL('https://example.com')), /unsupportedSystemProxy/);
  decision = 'SOCKS localhost:7892; DIRECT';
  assert.equal((await dispatcher.selectRoute(new URL('https://example.com'))).mode, 'direct');
});

test('real fetch and streamed responses use manual proxy only inside model scope; concurrent unrelated fetch stays on its original route', async t => {
  const target = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: first\n\n');
    setTimeout(() => res.end('data: done\n\n'), 5);
  });
  await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
  const targetPort = target.address().port;
  const tunnels = [];
  const proxy = http.createServer();
  proxy.on('connect', (req, socket, head) => {
    tunnels.push(req.url);
    const upstream = net.connect(targetPort, '127.0.0.1', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    socket.on('error', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => upstream.destroy());
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  class TestAgent extends Agent {
    constructor() {
      super({ connect: { lookup: (_host, options, callback) => {
        if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
        else callback(null, '127.0.0.1', 4);
      } } });
    }
  }
  const baseline = getGlobalDispatcher();
  const dispatcher = new ModelNetworkDispatcher({
    settings: { mode: 'manual', proxyUrl: `http://127.0.0.1:${proxy.address().port}`, bypassRules: ['llm.company.com'] },
    fallbackDispatcher: new TestAgent(), Agent: TestAgent, ProxyAgent, Socks5ProxyAgent,
    resolveProxy: async () => { throw new Error('manual mode must not resolve system proxy'); },
  });
  setGlobalDispatcher(dispatcher);
  t.after(async () => {
    setGlobalDispatcher(baseline);
    await dispatcher.close();
    await Promise.all([new Promise(resolve => proxy.close(resolve)), new Promise(resolve => target.close(resolve))]);
  });
  let observed;
  const [model, unrelated] = await Promise.all([
    dispatcher.run(async () => {
      assert.equal(dispatcher.activeRequests, 1);
      const response = await fetch(`http://model.example:${targetPort}/v1/chat/completions`);
      return response.text();
    }, { connectionTest: true, onConnectionTest: value => { observed = value; } }),
    fetch(`http://backup.example:${targetPort}/backup`).then(response => response.text()),
  ]);
  assert.match(model, /first[\s\S]*done/);
  assert.match(unrelated, /done/);
  assert.deepEqual(tunnels, [`model.example:${targetPort}`]);
  assert.equal(dispatcher.activeRequests, 0);
  assert.deepEqual(observed.routes, [{ host: `model.example:${targetPort}`, mode: 'manual-proxy' }]);
  await dispatcher.run(async () => {
    const response = await fetch(`http://llm.company.com:${targetPort}/v1/models`);
    await response.text();
  }, { connectionTest: true });
  assert.equal(tunnels.length, 1);
  assert.equal(dispatcher.lastConnection.routes[0].mode, 'direct');
  dispatcher.settings = { mode: 'direct', proxyUrl: '', bypassRules: [] };
  await dispatcher.run(async () => {
    const response = await fetch(`http://model.example:${targetPort}/v1/models`);
    await response.text();
  });
  assert.equal(tunnels.length, 1);
});

test('model activity is released after errors and empty tests report no network request', async t => {
  const dispatcher = new ModelNetworkDispatcher({
    settings: { mode: 'direct', proxyUrl: '', bypassRules: [] },
    fallbackDispatcher: new Agent(), Agent, ProxyAgent,
  });
  t.after(() => dispatcher.close());
  await assert.rejects(dispatcher.run(async () => {
    assert.equal(dispatcher.activeRequests, 1);
    throw new Error('failed');
  }, { connectionTest: true }), /failed/);
  assert.equal(dispatcher.activeRequests, 0);
  assert.deepEqual(dispatcher.lastConnection.routes, []);
});
