import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connect, refine, SEARCH_URL, USER_AGENT } from './research-prompt.mjs';

async function fixture(t, { failSearch = false, emptySearch = false, failOptimizer = false, failFetch = false } = {}) {
  const requests = [];
  const calls = [];
  const sessions = new Map();
  const server = createServer(async (req, res) => {
    requests.push({ path: req.url, method: req.method, headers: req.headers });
    let body = '';
    for await (const chunk of req) body += chunk;
    const existing = sessions.get(req.headers['mcp-session-id']);
    if (existing) {
      await existing.transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      return;
    }
    const mcp = new Server({ name: 'example-test', version: '1.0.0' }, { capabilities: { tools: {} } });
    const search = req.url === '/search';
    mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: (search
      ? ['web_search', 'web_fetch'] : ['iterate-prompt']).map(name => ({ name, inputSchema: { type: 'object' } })) }));
    mcp.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      calls.push(params);
      if ((search && failSearch) || (!search && failOptimizer)) {
        return { isError: true, content: [{ type: 'text', text: 'fixture tool failure' }] };
      }
      if (!search) return { content: [{ type: 'text', text: 'Refined migration checklist prompt with source links.' }] };
      const data = { results: emptySearch ? [] : [{ url: 'https://nodejs.org/en/about/previous-releases',
        excerpts: [params.name === 'web_fetch' ? 'Exact release policy excerpt.' : 'Current LTS release support excerpt.'] }] };
      if (params.name === 'web_fetch' && failFetch) {
        data.errors = [{ url: 'https://example.org/missing', error_type: 'http_error', http_status_code: 404, content: null }];
      }
      // Exercise structured output for search and the JSON text fallback for fetch.
      return { ...(params.name === 'web_search' ? { structuredContent: data } : {}),
        content: [{ type: 'text', text: JSON.stringify(data) }] };
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: id => sessions.set(id, { mcp, transport }) });
    try {
      await mcp.connect(transport);
      const onclose = transport.onclose;
      transport.onclose = () => { sessions.delete(transport.sessionId); onclose?.(); };
      await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
    } catch (error) {
      if (!res.headersSent) res.writeHead(500).end(error.message);
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const { mcp } of sessions.values()) await mcp.close();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const observed = [];
  const open = url => connect(url, (input, init) => {
    observed.push({ url: String(input), headers: new Headers(init.headers), body: init.body });
    return fetch(url === SEARCH_URL ? `${base}/search` : input, init);
  });
  return { open, requests, calls, observed, sessions, options: { prompt: 'Write a migration checklist.',
    objective: 'Find Node.js LTS release policy', queries: ['Node.js LTS release policy'],
    optimizerUrl: `${base}/optimizer` } };
}

test('SDK discovery/search/fetch feed cited reference context into optimizer execution', async t => {
  const f = await fixture(t);
  const output = await refine({ ...f.options, urls: ['https://nodejs.org/en/about/previous-releases'] }, f.open);
  assert.match(output, /Refined migration checklist/);
  assert.deepEqual(f.calls.map(call => call.name), ['web_search', 'web_fetch', 'iterate-prompt']);
  const [search, fetchCall, optimize] = f.calls;
  assert.equal(search.arguments.session_id, fetchCall.arguments.session_id);
  assert.match(search.arguments.session_id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(fetchCall.arguments.urls, ['https://nodejs.org/en/about/previous-releases']);
  assert.equal(optimize.arguments.prompt, f.options.prompt);
  assert.match(optimize.arguments.requirements, /Current LTS release support excerpt/);
  assert.match(optimize.arguments.requirements, /Exact release policy excerpt/);
  assert.match(optimize.arguments.requirements, /https:\/\/nodejs.org\/en\/about\/previous-releases/);
  assert.ok(optimize.arguments.requirements.length < 10_000);
  assert.ok(f.observed.some(request => request.url === SEARCH_URL));
  assert.ok(f.observed.some(request => request.url === f.options.optimizerUrl));
  for (const request of f.requests) {
    assert.equal(request.headers['user-agent'], USER_AGENT);
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers['x-api-key'], undefined);
  }
  for (const request of f.observed) assert.equal(request.headers.get('User-Agent'), USER_AGENT);
  assert.deepEqual(f.requests.filter(request => request.method === 'DELETE').map(request => request.path).sort(), ['/optimizer', '/search']);
  assert.equal(f.sessions.size, 0);
});

test('search-only path avoids automatic fetch', async t => {
  const f = await fixture(t);
  await refine(f.options, f.open);
  assert.deepEqual(f.calls.map(call => call.name), ['web_search', 'iterate-prompt']);
  assert.equal(f.sessions.size, 0);
});

for (const options of [{ failSearch: true }, { emptySearch: true }, { failOptimizer: true }]) {
  test(`fails without returning a prompt: ${JSON.stringify(options)}`, async t => {
    const f = await fixture(t, options);
    await assert.rejects(refine(f.options, f.open), /failed|No usable source excerpts/);
    if (!options.failOptimizer) assert.ok(!f.calls.some(call => call.name === 'iterate-prompt'));
    assert.equal(f.sessions.size, 0);
  });
}

test('partial explicit fetch failure stops refinement and releases its session', async t => {
  const f = await fixture(t, { failFetch: true });
  await assert.rejects(refine({ ...f.options, urls: ['https://example.org/missing'] }, f.open), /Page fetch failed/);
  assert.ok(!f.calls.some(call => call.name === 'iterate-prompt'));
  assert.equal(f.sessions.size, 0);
});

test('context stays within optimizer requirements limit even with large responses', async () => {
  let requirements;
  const open = async url => ({
    listTools: async () => ({ tools: ['web_search', 'web_fetch', 'iterate-prompt'].map(name => ({ name })) }),
    callTool: async ({ name, arguments: args }) => {
      if (name === 'iterate-prompt') {
        requirements = args.requirements;
        return { content: [{ type: 'text', text: 'Refined prompt' }] };
      }
      return { structuredContent: { results: Array.from({ length: 20 }, () => ({ url: 'https://example.org/' + 'x'.repeat(2000), excerpts: ['x'.repeat(50_000)] })) } };
    },
    close: async () => {},
  });
  await refine({ prompt: 'Prompt', objective: 'x'.repeat(200), queries: ['source context query'], urls: ['https://example.org'] }, open);
  assert.ok(requirements.length <= 10_000);
});

test('invalid input fails before opening any connection', async () => {
  const open = async () => { throw new Error('connection must not open'); };
  for (const input of [
    { prompt: '' }, { objective: 'x'.repeat(201) }, { queries: [] }, { urls: ['file:///secret'] },
  ]) {
    await assert.rejects(refine({ prompt: 'Prompt', objective: 'Find current release facts', queries: ['current release support'], ...input }, open), error => !error.message.includes('must not open'));
  }
});
