import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { BROWSER_BRIDGE_PROTOCOL, type BrowserAccess } from '@prompt-optimizer/core/bridge-protocol';
import { createBrowserTransport } from '../src/browser-transport';

const transports: ReturnType<typeof createBrowserTransport>[] = [];
const clients: WebSocket[] = [];
afterEach(async () => { for (const client of clients.splice(0)) client.terminate(); for (const transport of transports.splice(0)) await transport.dispose(); });
const bridge = () => { const transport = createBrowserTransport({ heartbeatMs: 500, requestMs: 300 }); transports.push(transport); return transport; };

async function authorize(transport: ReturnType<typeof bridge>, origin = 'http://product.localhost:18181', contextId = randomUUID(), access: BrowserAccess = 'compare') {
  const ticket = await transport.authorize(origin, access);
  const value = new URL(ticket.authorizationUrl).hash.split('poBridge=')[1];
  const [port, token] = value.split('.');
  const client = new WebSocket(`ws://127.0.0.1:${port}/bridge`, { origin });
  clients.push(client);
  const ready = new Promise<{ sourceId: string }>((resolve, reject) => {
    client.once('error', reject);
    client.once('open', () => client.send(JSON.stringify({ type: 'authorize', protocol: BROWSER_BRIDGE_PROTOCOL, ticket: token, access,
      identity: { contextId, pageId: randomUUID(), label: 'Fixture transport only', browser: 'Test', productVersion: 'test' } })));
    client.once('message', bytes => resolve(JSON.parse(bytes.toString())));
  });
  const source = await ready;
  client.on('message', bytes => {
    const request = JSON.parse(bytes.toString());
    if (request.type === 'request') client.send(JSON.stringify({ type: 'reply', id: request.id, result: { contextId, name: request.name } }));
  });
  return { client, sourceId: source.sourceId, port, token, contextId };
}

describe('in-process browser transport (auxiliary protocol evidence)', () => {
  it('discovers no sources before authorization and separates identical origins by browser storage context', async () => {
    const transport = bridge();
    expect(transport.listSources().sources).toEqual([]);
    const first = await authorize(transport);
    const second = await authorize(transport);
    expect(transport.listSources().sources.map(source => source.browserContextId)).toEqual([first.contextId, second.contextId]);
    const opened = await transport.open(second.sourceId, 'compare');
    expect(await transport.call(opened.connectionId, 'po_assets_list', {})).toMatchObject({ contextId: second.contextId });
    await transport.close(opened.connectionId);
    await expect(transport.call(opened.connectionId, 'po_assets_list', {})).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' });
  });

  it('invalidates an old connection when its page revokes, never rerouting to another page', async () => {
    const transport = bridge();
    const first = await authorize(transport);
    await authorize(transport);
    const opened = await transport.open(first.sourceId, 'compare');
    first.client.send(JSON.stringify({ type: 'revoke' }));
    await new Promise(resolve => first.client.once('close', resolve));
    expect(transport.listSources().sources).toHaveLength(1);
    await expect(transport.call(opened.connectionId, 'po_assets_list', {})).rejects.toMatchObject({ code: 'CONNECTION_CLOSED' });
    await expect(transport.open(first.sourceId, 'compare')).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND' });
  });

  it('rejects an unapproved origin and non-http product addresses', async () => {
    const transport = bridge();
    await expect(transport.authorize('file:///private/profile', 'compare')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const approved = await authorize(transport);
    const rejected = new WebSocket(`ws://127.0.0.1:${approved.port}/bridge`, { origin: 'http://unapproved.localhost' });
    clients.push(rejected);
    await expect(new Promise((_resolve, reject) => rejected.once('error', reject))).rejects.toThrow('403');
  });

  it('binds a reconnect ticket to the exact browser and storage context', async () => {
    const transport = bridge();
    const expected = { browser: 'Test', browserContextId: randomUUID(), label: 'Named profile' };
    const ticket = await transport.authorize('http://product.localhost:18181/installed-here/', 'read', expected);
    const link = new URL(ticket.authorizationUrl);
    expect(link.pathname).toBe('/installed-here/');
    const [port, token] = link.hash.split('poBridge=')[1].split('.');
    for (const [browser, contextId] of [['Test', randomUUID()], ['Other browser', expected.browserContextId], ['Test', expected.browserContextId]]) {
      const client = new WebSocket('ws://127.0.0.1:' + port + '/bridge', { origin: link.origin });
      clients.push(client);
      const outcome = await new Promise<string>((resolve, reject) => {
        client.once('error', reject);
        client.once('close', () => resolve('rejected'));
        client.once('message', () => resolve('authorized'));
        client.once('open', () => client.send(JSON.stringify({ type: 'authorize', protocol: BROWSER_BRIDGE_PROTOCOL, ticket: token, access: 'read',
          identity: { contextId, pageId: randomUUID(), label: 'New default label', browser, productVersion: 'test' } })));
      });
      const correct = browser === expected.browser && contextId === expected.browserContextId;
      expect(outcome).toBe(correct ? 'authorized' : 'rejected');
      expect(transport.listSources().sources).toHaveLength(correct ? 1 : 0);
    }
    expect(transport.listSources().sources[0].label).toBe(expected.label);
  });

  it('never upgrades read authorization or concurrent connection access', async () => {
    const transport = bridge();
    const readonly = await authorize(transport, undefined, undefined, 'read');
    await expect(transport.open(readonly.sourceId, 'compare')).rejects.toMatchObject({ code: 'COMPARISON_ACCESS_REQUIRED' });
    const writable = await authorize(transport);
    const opening = transport.open(writable.sourceId, 'read');
    await expect(transport.open(writable.sourceId, 'compare')).rejects.toMatchObject({ code: 'ACCESS_MISMATCH' });
    const opened = await opening;
    expect(opened.access).toBe('read');
    await expect(transport.open(writable.sourceId, 'compare')).rejects.toMatchObject({ code: 'ACCESS_MISMATCH' });
  });

  it('reports an uncertain write after disconnection without retrying or falling back', async () => {
    const transport = bridge();
    const selected = await authorize(transport);
    const other = await authorize(transport);
    const opened = await transport.open(selected.sourceId, 'compare');
    selected.client.removeAllListeners('message');
    let writes = 0;
    selected.client.on('message', bytes => {
      const request = JSON.parse(bytes.toString());
      if (request.name === '__ping') selected.client.send(JSON.stringify({ type: 'reply', id: request.id, result: { ready: true } }));
      else { writes++; selected.client.terminate(); }
    });
    await expect(transport.call(opened.connectionId, 'po_desktop_mutate', {})).rejects.toMatchObject({ code: 'WRITE_OUTCOME_UNKNOWN' });
    expect(writes).toBe(1);
    expect(transport.listSources().sources.map(source => source.sourceId)).toEqual([other.sourceId]);
  });

  it('consumes the fragment ticket once and closes its listener with the owner', async () => {
    const transport = bridge();
    const first = await authorize(transport);
    const unused = await transport.authorize('http://product.localhost:18181', 'read');
    const link = new URL(unused.authorizationUrl);
    expect(link.search).toBe('');
    expect(link.hash).toContain('poBridge=');
    const replay = new WebSocket(`ws://127.0.0.1:${first.port}/bridge`, { origin: link.origin });
    clients.push(replay);
    await new Promise<void>((resolve, reject) => { replay.once('open', resolve); replay.once('error', reject); });
    const rejected = new Promise(resolve => replay.once('close', resolve));
    replay.send(JSON.stringify({ type: 'authorize', protocol: BROWSER_BRIDGE_PROTOCOL, ticket: first.token, access: 'compare',
      identity: { contextId: randomUUID(), pageId: randomUUID(), label: 'Replay', browser: 'Test', productVersion: 'test' } }));
    await rejected;
    expect(transport.listSources().sources).toHaveLength(1);
    await transport.dispose();
    expect(transport.listSources().sources).toEqual([]);
    await expect(fetch(`http://127.0.0.1:${first.port}/bridge`)).rejects.toThrow();
  });

  it('does not leave a listener running when the owner closes during startup', async () => {
    const transport = bridge();
    const authorization = transport.authorize('http://product.localhost:18181', 'read');
    const rejected = expect(authorization).rejects.toMatchObject({ code: 'OWNER_CLOSED' });
    await transport.dispose();
    await rejected;
    await expect(transport.authorize('http://product.localhost:18181', 'read')).rejects.toMatchObject({ code: 'OWNER_CLOSED' });
  });
})
