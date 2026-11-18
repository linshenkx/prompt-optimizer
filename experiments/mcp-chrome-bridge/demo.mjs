// Standalone test harness in ONE process. This is not an installed background service.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { startBridge } from './bridge.mjs';

const html = await readFile(new URL('./fixture.html', import.meta.url));
const script = await readFile(new URL('./fixture.mjs', import.meta.url));
const runId = randomUUID();
const fixtures = [];
let bridge;

function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

for (const label of ['A', 'B']) {
  let origin;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(origin).host) { send(res, 403, { error: 'host_denied' }); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; connect-src 'self' http://127.0.0.1:*; object-src 'none'; frame-ancestors 'none'");
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } else if (req.method === 'GET' && req.url === '/fixture.mjs') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(script);
      } else if (req.method === 'GET' && req.url === '/demo/config') {
        send(res, 200, { bridgeUrl: bridge.url, runId, label });
      } else if (req.method === 'GET' && req.url === '/demo/sources') {
        send(res, 200, bridge.listSources());
      } else if (req.method === 'POST' && req.headers.origin === origin && req.headers['content-type'] === 'application/json') {
        // Fixture-only ticket issuer/controller. NEVER copy these endpoints to production.
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4_096) throw new Error('payload_too_large');
          chunks.push(chunk);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (req.url === '/demo/ticket') {
          send(res, 200, { ticket: bridge.issueTicket(origin) });
        } else if (req.url === '/demo/run') {
          send(res, 200, await bridge.dispatch(data.sourceId, 'fixture.list'));
        } else if (req.url === '/demo/cancel') {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 700);
          try { await bridge.dispatch(data.sourceId, 'fixture.wait', { signal: controller.signal }); }
          catch (error) { send(res, 200, { sourceId: data.sourceId, code: error.code }); }
          finally { clearTimeout(timer); }
        } else send(res, 404, { error: 'unknown_endpoint' });
      } else send(res, 403, { error: 'request_denied' });
    } catch (error) { send(res, 400, { error: error.code || error.message }); }
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  fixtures.push({ server, origin, label });
}

bridge = await startBridge({ allowedOrigins: fixtures.map((f) => f.origin), leaseMs: 6_000 });
console.log(JSON.stringify({ experiment: 'PO-MCP-CHROME-20261115', pid: process.pid, fixtures: fixtures.map(({ origin, label }) => ({ url: `${origin}/`, label })) }));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await bridge.close();
  await Promise.all(fixtures.map(({ server }) => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  })));
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
// Bound the harness lifetime even if an automation client disappears.
const lifetime = setTimeout(close, 20 * 60_000);
lifetime.unref();
