import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import {
  BROWSER_BRIDGE_MAX_BYTES, PRODUCT_BRIDGE_MAX_BYTES, BROWSER_BRIDGE_PROTOCOL, BrowserBridgeError, isBrowserAccess, allowsBrowserAccess,
  type BrowserAccess, type BrowserSourceIdentity,
} from '@prompt-optimizer/core/bridge-protocol';

interface Ticket { origin: string; access: BrowserAccess; expiresAt: number }
interface Pending {
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
  disconnectCode: string;
}
interface Source {
  id: string;
  origin: string;
  access: BrowserAccess;
  identity: BrowserSourceIdentity;
  socket: WebSocket;
  pending: Map<string, Pending>;
  connectionId?: string;
  connectionAccess?: BrowserAccess;
  opening?: Promise<unknown>;
  openingAccess?: BrowserAccess;
  alive: boolean;
}

export function createBrowserTransport({ ticketMs = 120_000, requestMs = 15_000, heartbeatMs = 2_000 } = {}) {
  const tickets = new Map<string, Ticket>();
  const sources = new Map<string, Source>();
  const connections = new Map<string, Source>();
  let listener: http.Server | undefined;
  let sockets: WebSocketServer | undefined;
  let starting: Promise<number> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let disposed = false;

  function invalidate(source: Source) {
    if (source.connectionId) connections.delete(source.connectionId);
    source.connectionId = undefined;
    source.connectionAccess = undefined;
  }
  function drop(source: Source) {
    sources.delete(source.id);
    invalidate(source);
    for (const pending of source.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new BrowserBridgeError(pending.disconnectCode));
    }
    source.pending.clear();
    source.socket.terminate();
  }
  function stopIdle() {
    if (tickets.size || sources.size || !listener) return;
    if (timer) clearInterval(timer);
    timer = undefined;
    const websocket = sockets;
    const server = listener;
    sockets = undefined;
    listener = undefined;
    starting = undefined;
    for (const client of websocket?.clients ?? []) client.terminate();
    websocket?.close();
    server.close();
  }
  function maintenance() {
    for (const [token, ticket] of tickets) if (ticket.expiresAt <= Date.now()) tickets.delete(token);
    for (const source of sources.values()) {
      if (!source.alive) { drop(source); continue; }
      source.alive = false;
      source.socket.ping();
    }
    stopIdle();
  }
  async function start(): Promise<number> {
    if (disposed) throw new BrowserBridgeError('OWNER_CLOSED');
    starting ??= (async () => {
      const server = http.createServer((_request, response) => {
        response.writeHead(404, { 'Cache-Control': 'no-store' }).end();
      });
      const websocket = new WebSocketServer({ noServer: true, maxPayload: PRODUCT_BRIDGE_MAX_BYTES, perMessageDeflate: false });
      listener = server;
      sockets = websocket;
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      const port = (server.address() as { port: number }).port;
      server.on('upgrade', (request, socket, head) => {
        const origin = request.headers.origin;
        if (disposed || request.url !== '/bridge' || request.headers.host !== `127.0.0.1:${port}` ||
          typeof origin !== 'string' || websocket.clients.size >= 16 ||
          ![...tickets.values()].some(ticket => ticket.origin === origin && ticket.expiresAt > Date.now())) {
          socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
        }
        websocket.handleUpgrade(request, socket, head, client => {
          let source: Source | undefined;
          const authenticationTimer = setTimeout(() => client.terminate(), 5_000);
          client.on('error', () => client.terminate());
          client.on('close', () => {
            clearTimeout(authenticationTimer);
            if (source) drop(source);
            stopIdle();
          });
          client.on('pong', () => { if (source) source.alive = true; });
          client.on('message', (bytes, binary) => {
            try {
              if (binary || (source?.access !== 'business' && bytes.length > BROWSER_BRIDGE_MAX_BYTES)) throw new BrowserBridgeError('INVALID_MESSAGE');
              const message = JSON.parse(bytes.toString()) as Record<string, unknown>;
              if (!source) {
                const ticket = typeof message.ticket === 'string' ? tickets.get(message.ticket) : undefined;
                const identity = message.identity as BrowserSourceIdentity | undefined;
                if (!ticket || ticket.expiresAt <= Date.now() || ticket.origin !== origin || message.protocol !== BROWSER_BRIDGE_PROTOCOL ||
                  message.type !== 'authorize' || message.access !== ticket.access || !identity || !/^[a-f0-9-]{36}$/.test(identity.contextId) || !/^[a-f0-9-]{36}$/.test(identity.pageId) ||
                  ![identity.label, identity.browser, identity.productVersion].every(value => typeof value === 'string' && value.length > 0 && value.length <= 100) || sources.size >= 8) {
                  throw new BrowserBridgeError('AUTHORIZATION_FAILED');
                }
                tickets.delete(message.ticket as string);
                clearTimeout(authenticationTimer);
                source = { id: randomUUID(), origin, access: ticket.access, identity: {
                  contextId: identity.contextId, pageId: identity.pageId, label: identity.label,
                  browser: identity.browser, productVersion: identity.productVersion,
                }, socket: client, pending: new Map(), alive: true };
                sources.set(source.id, source);
                client.send(JSON.stringify({ type: 'authorized', sourceId: source.id, access: source.access }));
                return;
              }
              if (message.type === 'revoke') { drop(source); return; }
              if (message.type !== 'reply' || typeof message.id !== 'string') throw new BrowserBridgeError('INVALID_MESSAGE');
              const pending = source.pending.get(message.id);
              if (!pending) return;
              source.pending.delete(message.id);
              clearTimeout(pending.timer);
              if (typeof message.error === 'string' && /^[A-Z][A-Z_]{0,79}$/.test(message.error)) {
                pending.reject(new BrowserBridgeError(message.error));
              } else if (Object.hasOwn(message, 'result')) pending.resolve(message.result);
              else pending.reject(new BrowserBridgeError('INVALID_MESSAGE'));
            } catch { if (source) drop(source); else client.terminate(); }
          });
        });
      });
      timer = setInterval(maintenance, heartbeatMs);
      timer.unref();
      return port;
    })();
    try { return await starting; }
    catch { listener?.close(); starting = undefined; throw new BrowserBridgeError('BRIDGE_START_FAILED'); }
  }

  function request(source: Source, name: string, input: Record<string, unknown> = {}, timeout = requestMs): Promise<unknown> {
    if (!sources.has(source.id) || source.socket.readyState !== WebSocket.OPEN) throw new BrowserBridgeError('CONNECTION_CLOSED');
    if (source.pending.size >= 16) throw new BrowserBridgeError('SOURCE_BUSY');
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const method = name === 'product' ? input.name : name;
      const outcomeCode = ['po_desktop_mutate', 'po_comparisons_save', 'po_comparisons_delete', 'po_runs_save', 'po_runs_delete', 'po_runs_cancel', 'po_resources'].includes(String(method))
        ? 'WRITE_OUTCOME_UNKNOWN' : (method === 'po_tests_execute' || method === 'po_runs_start') ? 'EXECUTION_OUTCOME_UNKNOWN' : undefined;
      const timer = setTimeout(() => {
        source.pending.delete(id);
        reject(new BrowserBridgeError(outcomeCode ?? 'SOURCE_NOT_RESPONDING'));
        drop(source);
      }, timeout);
      source.pending.set(id, { resolve, reject, timer, disconnectCode: outcomeCode ?? 'CONNECTION_CLOSED' });
      source.socket.send(JSON.stringify({ type: 'request', id, name, input }), error => { if (error) drop(source); });
    });
  }
  function description(source: Source) {
    return {
      sourceId: source.id, kind: 'browser', label: source.identity.label, origin: source.origin,
      browser: source.identity.browser, browserContextId: source.identity.contextId, pageId: source.identity.pageId,
      sourceEpoch: source.identity.pageId, connectionGeneration: source.connectionId ?? 'unconnected',
      productVersion: source.identity.productVersion, storageVersion: 'dexie/1', contractVersion: 'po-capabilities/0.2',
      availability: 'connected', readiness: 'ready', authorizedAccess: source.access,
    };
  }

  return {
    async authorize(productUrl: string, access: BrowserAccess) {
      let url: URL;
      try { url = new URL(productUrl); } catch { throw new BrowserBridgeError('INVALID_INPUT'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !isBrowserAccess(access)) {
        throw new BrowserBridgeError('INVALID_INPUT');
      }
      if (tickets.size >= 8) throw new BrowserBridgeError('SOURCE_LIMIT');
      const port = await start();
      if (disposed) throw new BrowserBridgeError('OWNER_CLOSED');
      const token = randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + ticketMs;
      tickets.set(token, { origin: url.origin, access, expiresAt });
      url.hash = `/pro/variable?poBridge=${port}.${token}.${access}`;
      return { authorizationUrl: url.href, origin: url.origin, access, expiresAt,
        instructions: 'Open this one-use link in the desired browser profile and explicitly authorize on the product page. Then call po_sources_list; no browser profiles are scanned.' };
    },
    hasConnection(connectionId: string) { return connections.has(connectionId); },
    listSources() { return { sources: [...sources.values()].filter(source => source.socket.readyState === WebSocket.OPEN).map(description) }; },
    async open(sourceId: string, access: BrowserAccess) {
      const source = sources.get(sourceId);
      if (!source) throw new BrowserBridgeError('SOURCE_NOT_FOUND');
      if (!allowsBrowserAccess(source.access, access)) throw new BrowserBridgeError('COMPARISON_ACCESS_REQUIRED');
      if (source.opening) {
        if (source.openingAccess !== access) throw new BrowserBridgeError('ACCESS_MISMATCH');
        return source.opening;
      }
      if (source.connectionId) {
        if (source.connectionAccess !== access) throw new BrowserBridgeError('ACCESS_MISMATCH');
        await request(source, '__ping', {}, 3_000);
        return { ...description(source), connectionId: source.connectionId, access };
      }
      source.openingAccess = access;
      source.opening = (async () => {
        const connectionId = randomUUID();
        const executionSource = { kind: 'browser', sourceId, sourceEpoch: source.identity.pageId, connectionGeneration: connectionId, label: source.identity.label };
        await request(source, 'open', { executionSource, access, contextId: source.identity.contextId });
        if (!sources.has(sourceId)) throw new BrowserBridgeError('CONNECTION_CLOSED');
        source.connectionId = connectionId;
        source.connectionAccess = access;
        connections.set(connectionId, source);
        return { ...description(source), connectionId, access };
      })();
      try { return await source.opening; } finally { source.opening = undefined; source.openingAccess = undefined; }
    },
    async close(connectionId: string) {
      const source = connections.get(connectionId);
      if (!source) throw new BrowserBridgeError('CONNECTION_CLOSED');
      invalidate(source);
      await request(source, 'close');
      return { connectionId, closed: true };
    },
    async call(connectionId: string, name: string, input: Record<string, unknown>) {
      const source = connections.get(connectionId);
      if (!source) throw new BrowserBridgeError('CONNECTION_CLOSED');
      await request(source, '__ping', {}, 3_000);
      if (connections.get(connectionId) !== source) throw new BrowserBridgeError('CONNECTION_CLOSED');
      return request(source, name, input);
    },
    async callSource(sourceId: string, name: string, input: Record<string, unknown>) {
      const source = sources.get(sourceId);
      if (!source?.connectionId) throw new BrowserBridgeError('CONNECTION_CLOSED');
      return this.call(source.connectionId, name, input);
    },
    async dispose() {
      disposed = true;
      tickets.clear();
      await starting?.catch(() => undefined);
      for (const source of sources.values()) drop(source);
      const server = listener;
      stopIdle();
      if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}
