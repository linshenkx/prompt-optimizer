// Transport experiment only. No product data or MCP business tools are exposed.
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

const PROTOCOL = 'po-bridge-experiment/1';
const secret = () => randomBytes(32).toString('base64url');
const failure = (code) => Object.assign(new Error(code), { code });

export async function startBridge({ allowedOrigins, leaseMs = 15_000, maxSources = 8, maxPending = 16 } = {}) {
  const origins = new Set(allowedOrigins);
  if (!origins.size || [...origins].some((o) => o === 'null' || new URL(o).origin !== o)) {
    throw failure('invalid_origin_allowlist');
  }
  const tickets = new Map();
  const sources = new Map();
  let closed = false;
  let authority;

  function settle(source, id, error, value) {
    const pending = source.pending.get(id);
    if (!pending) return false;
    source.pending.delete(id);
    clearTimeout(pending.timer);
    pending.signal?.removeEventListener('abort', pending.abort);
    if (error) pending.reject(error);
    else pending.resolve(value);
    return true;
  }

  function drop(source, code) {
    sources.delete(source.id);
    for (const id of source.pending.keys()) settle(source, id, failure(code));
    source.queue.length = 0;
  }

  function expire() {
    const now = Date.now();
    for (const [key, ticket] of tickets) if (ticket.expiresAt <= now) tickets.delete(key);
    for (const source of sources.values()) if (source.expiresAt <= now) drop(source, 'source_disconnected');
  }

  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  async function body(req) {
    if (req.headers['content-type'] !== 'application/json') throw failure('json_required');
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 64 * 1024) throw failure('payload_too_large');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw failure('invalid_json'); }
  }

  const server = http.createServer(async (req, res) => {
    try {
      expire();
      const origin = req.headers.origin;
      // Check the wire headers, never the caller's claimed origin in JSON.
      if (closed || req.headers.host !== authority || !origins.has(origin)) {
        send(res, 403, { error: 'origin_or_host_denied' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        const headers = String(req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
        if (req.headers['access-control-request-method'] !== 'POST' || headers.some((h) => !['authorization', 'content-type'].includes(h))) {
          send(res, 403, { error: 'preflight_denied' });
          return;
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.writeHead(204).end();
        return;
      }
      if (req.method !== 'POST' || !['/connect', '/poll', '/reply', '/disconnect'].includes(req.url)) {
        send(res, 404, { error: 'unknown_endpoint' });
        return;
      }
      const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '')?.[1];
      // Authenticate before buffering any request body.
      const ticket = req.url === '/connect' ? tickets.get(token) : undefined;
      const source = req.url === '/connect' ? undefined : [...sources.values()].find((s) => s.token === token);
      if ((!ticket || ticket.origin !== origin) && (!source || source.origin !== origin)) {
        send(res, 401, { error: 'not_authenticated' });
        return;
      }
      const data = await body(req);
      expire();
      if (req.url === '/connect') {
        if (!tickets.has(token)) { send(res, 401, { error: 'ticket_expired_or_used' }); return; }
        if (data?.protocol !== PROTOCOL || typeof data.instanceId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.instanceId) || data.kind !== 'web-fixture') {
          send(res, 400, { error: 'invalid_hello' }); return;
        }
        if (sources.size >= maxSources) { send(res, 429, { error: 'source_limit' }); return; }
        if ([...sources.values()].some((s) => s.origin === origin && s.instanceId === data.instanceId)) {
          send(res, 409, { error: 'duplicate_instance' }); return;
        }
        tickets.delete(token);
        const next = {
          id: randomUUID(), token: secret(), origin, instanceId: data.instanceId,
          kind: data.kind, expiresAt: Date.now() + leaseMs, pending: new Map(), queue: [],
        };
        sources.set(next.id, next);
        send(res, 200, { sourceId: next.id, connectionToken: next.token, protocol: PROTOCOL, leaseMs });
      } else {
        if (!sources.has(source.id)) { send(res, 410, { error: 'source_disconnected' }); return; }
        source.expiresAt = Date.now() + leaseMs;
        if (req.url === '/poll') {
          const messages = source.queue.splice(0);
          for (const message of messages) {
            const pending = source.pending.get(message.requestId);
            if (message.type === 'command' && pending) pending.delivered = true;
          }
          send(res, 200, { messages });
        } else if (req.url === '/disconnect') {
          drop(source, 'source_disconnected');
          send(res, 200, { disconnected: true });
        } else {
          const pending = source.pending.get(data?.requestId);
          if (!pending?.delivered) { send(res, 409, { error: 'request_not_active' }); return; }
          if (typeof data.ok !== 'boolean') { send(res, 400, { error: 'invalid_reply' }); return; }
          settle(source, data.requestId, data.ok ? null : failure('executor_error'), {
            sourceId: source.id, origin: source.origin, instanceId: source.instanceId, result: data.result,
          });
          send(res, 200, { accepted: true });
        }
      }
    } catch (error) {
      if (!res.headersSent) send(res, error.code === 'payload_too_large' ? 413 : 400, { error: error.code || 'invalid_request' });
      else res.end();
    }
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  authority = `127.0.0.1:${server.address().port}`;
  const sweep = setInterval(expire, Math.min(1_000, leaseMs));
  sweep.unref();

  return {
    url: `http://${authority}`,
    issueTicket(origin, ttlMs = 60_000) {
      expire();
      if (closed || !origins.has(origin) || tickets.size >= 16) throw failure('ticket_denied');
      const token = secret();
      tickets.set(token, { origin, expiresAt: Date.now() + Math.min(ttlMs, 60_000) });
      return token;
    },
    listSources() {
      expire();
      return [...sources.values()].map(({ id, origin, instanceId, kind, expiresAt }) => ({ id, origin, instanceId, kind, expiresAt }));
    },
    dispatch(sourceId, action, { signal, timeoutMs = 5_000 } = {}) {
      expire();
      const source = sources.get(sourceId);
      if (!source) return Promise.reject(failure('source_not_connected'));
      if (!['fixture.list', 'fixture.wait'].includes(action)) return Promise.reject(failure('sample_action_only'));
      if (signal?.aborted) return Promise.reject(failure('cancelled'));
      if (source.pending.size >= maxPending || source.queue.length >= 2 * maxPending) return Promise.reject(failure('pending_limit'));
      return new Promise((resolve, reject) => {
        const requestId = randomUUID();
        const cancel = (code) => {
          const pending = source.pending.get(requestId);
          if (!pending) return;
          if (pending.delivered) source.queue.push({ type: 'cancel', requestId });
          else source.queue = source.queue.filter((m) => m.requestId !== requestId);
          settle(source, requestId, failure(code));
        };
        const abort = () => cancel('cancelled');
        const timer = setTimeout(() => cancel('deadline_exceeded'), Math.min(timeoutMs, 30_000));
        source.pending.set(requestId, { resolve, reject, abort, signal, timer, delivered: false });
        source.queue.push({ type: 'command', requestId, action });
        signal?.addEventListener('abort', abort, { once: true });
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      clearInterval(sweep);
      tickets.clear();
      for (const source of sources.values()) drop(source, 'bridge_closed');
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
