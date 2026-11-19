const { createServer } = require('node:net');
const { randomUUID, createHash, timingSafeEqual } = require('node:crypto');

function installDesktopResources(ipcMain, storage) {
  const descriptorKey = 'mcp:renderer:resources';
  const operations = new Set(['images.list', 'images.get', 'images.save', 'images.delete', 'package.export', 'package.import']);
  const mutations = new Set(['images.save', 'images.delete', 'package.import']);
  let host;
  let starting;
  ipcMain.handle('desktop-resources-register', async event => {
    if (process.platform !== 'win32') return false;
    if (host) return host.sender === event.sender;
    if (starting) { await starting; return host?.sender === event.sender; }
    starting = (async () => {
      const token = randomUUID() + randomUUID();
      const pipe = String.raw`\\.\pipe\po-desktop-resources-${randomUUID()}`;
      const pending = new Map();
      const sender = event.sender;
      const server = createServer(socket => {
        socket.setEncoding('utf8');
        socket.setTimeout(30000, () => socket.destroy());
        let buffer = '';
        let received = false;
        const respond = packet => { if (!socket.destroyed) socket.end(JSON.stringify(packet) + '\n'); };
        socket.on('error', () => {});
        socket.on('data', chunk => {
          if (received) return;
          buffer += chunk.toString('utf8');
          if (Buffer.byteLength(buffer) > 32 * 1024 * 1024) { socket.destroy(); return; }
          if (!buffer.includes('\n')) return;
          received = true;
          void (async () => {
            const request = JSON.parse(buffer.trim());
            if (typeof request.token !== 'string' || request.token.length !== token.length ||
              !timingSafeEqual(Buffer.from(request.token), Buffer.from(token)) || !operations.has(request.operation) ||
              typeof request.requestKey !== 'string' || !request.requestKey || request.requestKey.length > 512 || pending.size >= 4 || sender.isDestroyed()) {
              respond({ error: 'RESOURCE_REQUEST_REFUSED' }); return;
            }
            const signature = createHash('sha256').update(JSON.stringify([request.operation, request.arguments])).digest('hex');
            const key = 'mcp:resource-receipt:' + createHash('sha256').update(request.requestKey).digest('hex');
            if (mutations.has(request.operation)) {
              const previous = await storage.getItem(key);
              if (previous) {
                const receipt = JSON.parse(previous);
                respond(receipt.signature !== signature ? { error: 'REQUEST_KEY_REUSED' } :
                  receipt.response ?? { error: 'RESOURCE_RESULT_UNKNOWN' }); return;
              }
              if (!await storage.compareAndSetItem(key, null, JSON.stringify({ signature }))) {
                respond({ error: 'RESOURCE_RESULT_UNKNOWN' }); return;
              }
            }
            const id = randomUUID();
            const timer = setTimeout(() => {
              pending.delete(id); respond({ error: 'RESOURCE_RESULT_UNKNOWN' });
            }, 29000);
            pending.set(id, { sender, respond, timer, key, signature, mutation: mutations.has(request.operation) });
            sender.send('desktop-resource-request', { id, operation: request.operation, arguments: request.arguments });
          })().catch(() => respond({ error: 'RESOURCE_REQUEST_FAILED' }));
        });
      });
      server.on('error', () => {});
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
      host = { server, sender, pending };
      await storage.setItem(descriptorKey, JSON.stringify({ pipe, token, pid: process.pid }));
      sender.once('destroyed', () => {
        server.close();
        for (const item of pending.values()) { clearTimeout(item.timer); item.respond({ error: 'RESOURCE_RESULT_UNKNOWN' }); }
        pending.clear();
        if (host?.sender === sender) host = undefined;
        void storage.getItem(descriptorKey).then(raw => {
          if (raw && JSON.parse(raw).pipe === pipe) return storage.compareAndSetItem(descriptorKey, raw, null);
        }).catch(() => {});
      });
    })();
    try { await starting; return true; } finally { starting = undefined; }
  });
  ipcMain.handle('desktop-resources-complete', async (event, packet) => {
    const item = host?.pending.get(packet?.id);
    if (!item || item.sender !== event.sender) return false;
    host.pending.delete(packet.id); clearTimeout(item.timer);
    const refusals = new Set(['WORKSPACE_BUSY', 'IMAGE_NOT_FOUND', 'IMAGE_REVISION_CONFLICT', 'IMAGE_REFERENCED']);
    const response = packet.ok ? { result: packet.result } : { error: refusals.has(packet.code) ? packet.code : item.mutation ? 'RESOURCE_RESULT_UNKNOWN' : 'RESOURCE_OPERATION_FAILED' };
    if (Buffer.byteLength(JSON.stringify(response)) > 32 * 1024 * 1024) {
      item.respond({ error: 'RESOURCE_OUTPUT_LIMIT' }); return false;
    }
    if (item.mutation) await storage.setItem(item.key, JSON.stringify({ signature: item.signature, response }));
    item.respond(response);
    return true;
  });
}

module.exports = { installDesktopResources };
