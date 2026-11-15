import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { startBridge } from './bridge.mjs';

const A = 'http://127.0.0.1:19001';
const B = 'http://127.0.0.1:19002';
const hello = (instanceId) => ({ protocol: 'po-bridge-experiment/1', instanceId, kind: 'web-fixture' });

async function setup(t, options = {}) {
  const bridge = await startBridge({ allowedOrigins: [A, B], ...options });
  t.after(() => bridge.close());
  const request = async (path, token, origin = A, data = {}) => {
    const response = await fetch(bridge.url + path, {
      method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  };
  const connect = async (instanceId, origin = A) => {
    const response = await request('/connect', bridge.issueTicket(origin), origin, hello(instanceId));
    assert.equal(response.status, 200);
    return response.data;
  };
  return { bridge, request, connect };
}

test('exact source routing, same-origin instances and different origins remain separate', async (t) => {
  const { bridge, request, connect } = await setup(t);
  const first = await connect('first');
  const second = await connect('second');
  const other = await connect('other', B);
  assert.equal(bridge.listSources().length, 3);
  assert.ok(bridge.listSources().every((s) => !('token' in s)));
  await assert.rejects(bridge.dispatch(undefined, 'fixture.list'), { code: 'source_not_connected' });
  await assert.rejects(bridge.dispatch(first.sourceId, 'business.guess'), { code: 'sample_action_only' });
  const pending = bridge.dispatch(second.sourceId, 'fixture.list');
  const empty = await request('/poll', first.connectionToken);
  assert.deepEqual(empty.data.messages, []);
  const { data: { messages: [message] } } = await request('/poll', second.connectionToken);
  assert.equal(message.action, 'fixture.list');
  assert.equal((await request('/reply', other.connectionToken, B, { requestId: message.requestId, ok: true })).status, 409);
  await request('/reply', second.connectionToken, A, { requestId: message.requestId, ok: true, result: ['known-sample'] });
  assert.deepEqual(await pending, { sourceId: second.sourceId, origin: A, instanceId: 'second', result: ['known-sample'] });
});

test('wire origin, host, token and preflight are independently checked', async (t) => {
  const { bridge, request, connect } = await setup(t);
  const active = await connect('one');
  for (const origin of ['null', 'https://attacker.invalid', '']) {
    assert.equal((await request('/poll', active.connectionToken, origin)).status, 403);
  }
  assert.equal((await request('/poll', active.connectionToken, B)).status, 401);
  assert.equal((await request('/poll', 'incorrect')).status, 401);
  const absent = await fetch(bridge.url + '/poll', { method: 'POST' });
  assert.equal(absent.status, 403);
  const hostDenied = await new Promise((resolve, reject) => {
    const req = http.request(bridge.url + '/poll', { method: 'POST', headers: { Host: 'rebind.invalid', Origin: A } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostDenied, 403);
  const preflight = await fetch(bridge.url + '/poll', {
    method: 'OPTIONS', headers: { Origin: A, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), A);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
  const denied = await fetch(bridge.url + '/poll', { method: 'OPTIONS', headers: { Origin: A, 'Access-Control-Request-Method': 'GET' } });
  assert.equal(denied.status, 403);
});

test('pairing is one-use, expiring, origin-bound, versioned and rejects duplicate instances', async (t) => {
  const { bridge, request } = await setup(t);
  const ticket = bridge.issueTicket(A);
  assert.equal((await request('/connect', ticket, B, hello('one'))).status, 401);
  assert.equal((await request('/connect', ticket, A, { ...hello('one'), protocol: 'unknown' })).status, 400);
  assert.equal((await request('/connect', ticket, A, { ...hello('one'), instanceId: 123 })).status, 400);
  assert.equal((await request('/connect', ticket, A, hello('one'))).status, 200);
  assert.equal((await request('/connect', ticket, A, hello('two'))).status, 401);
  assert.equal((await request('/connect', bridge.issueTicket(A), A, hello('one'))).status, 409);
  assert.equal((await request('/connect', bridge.issueTicket(A, -1), A, hello('expired'))).status, 401);
});

test('cancellation before delivery removes the command; after delivery sends cancellation and rejects late success', async (t) => {
  const { bridge, request, connect } = await setup(t);
  const active = await connect('one');
  const first = new AbortController();
  const early = bridge.dispatch(active.sourceId, 'fixture.wait', { signal: first.signal });
  const earlyCheck = assert.rejects(early, { code: 'cancelled' });
  first.abort();
  await earlyCheck;
  assert.deepEqual((await request('/poll', active.connectionToken)).data.messages, []);
  const second = new AbortController();
  const later = bridge.dispatch(active.sourceId, 'fixture.wait', { signal: second.signal });
  const laterCheck = assert.rejects(later, { code: 'cancelled' });
  const { data: { messages: [command] } } = await request('/poll', active.connectionToken);
  second.abort();
  await laterCheck;
  assert.deepEqual((await request('/poll', active.connectionToken)).data.messages, [{ type: 'cancel', requestId: command.requestId }]);
  assert.equal((await request('/reply', active.connectionToken, A, { requestId: command.requestId, ok: true })).status, 409);
});

test('deadline, disconnect and shutdown settle pending requests without selecting another source', async (t) => {
  const { bridge, request, connect } = await setup(t);
  const one = await connect('one');
  const two = await connect('two');
  await assert.rejects(bridge.dispatch(one.sourceId, 'fixture.wait', { timeoutMs: 20 }), { code: 'deadline_exceeded' });
  const pending = assert.rejects(bridge.dispatch(one.sourceId, 'fixture.wait'), { code: 'source_disconnected' });
  await request('/disconnect', one.connectionToken);
  await pending;
  await assert.rejects(bridge.dispatch(one.sourceId, 'fixture.list'), { code: 'source_not_connected' });
  assert.deepEqual((await request('/poll', two.connectionToken)).data.messages, []);
  const remaining = assert.rejects(bridge.dispatch(two.sourceId, 'fixture.wait'), { code: 'bridge_closed' });
  await bridge.close();
  await remaining;
  await assert.rejects(fetch(bridge.url + '/poll', { signal: AbortSignal.timeout(500) }));
});

test('expired lease invalidates handles and tokens; reconnect gets a new handle', async (t) => {
  const { bridge, request, connect } = await setup(t, { leaseMs: 100 });
  const previous = await connect('same-document');
  const pending = assert.rejects(bridge.dispatch(previous.sourceId, 'fixture.wait'), { code: 'source_disconnected' });
  await delay(210);
  await pending;
  assert.deepEqual(bridge.listSources(), []);
  assert.equal((await request('/poll', previous.connectionToken)).status, 401);
  const current = await connect('same-document');
  assert.notEqual(current.sourceId, previous.sourceId);
  await assert.rejects(bridge.dispatch(previous.sourceId, 'fixture.list'), { code: 'source_not_connected' });
});

test('body, source and pending limits bound the experiment', async (t) => {
  const { bridge, request, connect } = await setup(t, { maxSources: 1, maxPending: 1 });
  const active = await connect('one');
  assert.equal((await request('/connect', bridge.issueTicket(A), A, hello('two'))).status, 429);
  const pending = assert.rejects(bridge.dispatch(active.sourceId, 'fixture.wait'), { code: 'bridge_closed' });
  await assert.rejects(bridge.dispatch(active.sourceId, 'fixture.wait'), { code: 'pending_limit' });
  assert.equal((await request('/reply', active.connectionToken, A, { content: 'x'.repeat(66_000) })).status, 413);
  await bridge.close();
  await pending;
});
