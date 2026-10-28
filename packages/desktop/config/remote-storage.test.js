const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRemoteObjectStore } = require('../remote-storage');
const { createServer } = require('node:http');

function setup(read) {
  const calls = [];
  const client = {
    getDirectoryContents: async (path) => { calls.push(['read', path]); return read(path); },
    createDirectory: async () => { throw new Error('listing must not create directories'); },
    putFileContents: async () => { throw new Error('listing must not upload'); },
    deleteFile: async () => { throw new Error('listing must not delete'); },
  };
  const store = createRemoteObjectStore({ kind: 'webdav', endpoint: 'https://dav.test', directory: 'backups' }, {
    createWebDavClient: () => client,
  });
  return { store, calls };
}
test('desktop WebDAV lists existing backups without writes', async () => {
  const { store, calls } = setup(() => [{ filename: '/backups/v1/snapshots/a/manifest.json', type: 'file', size: 123 }]);
  assert.equal((await store.list('v1/snapshots'))[0].path, 'v1/snapshots/a/manifest.json');
  assert.deepEqual(calls, [['read', '/backups/v1/snapshots']]);
});
test('desktop WebDAV treats missing backup folders as empty only after reading the service root', async () => {
  const { store, calls } = setup(path => {
    if (path === '/') return [];
    throw Object.assign(new Error('missing'), { status: 404 });
  });
  assert.deepEqual(await store.list('v1/snapshots'), []);
  assert.deepEqual(calls, [['read', '/backups/v1/snapshots'], ['read', '/']]);
});
test('desktop WebDAV reports an invalid endpoint and never creates it', async () => {
  const { store } = setup(() => { throw Object.assign(new Error('missing'), { status: 404 }); });
  await assert.rejects(store.list(''), /endpoint lookup failed/);
});
test('desktop WebDAV preserves permission errors instead of returning an empty list', async () => {
  const { store, calls } = setup(() => { throw Object.assign(new Error('forbidden'), { status: 403 }); });
  await assert.rejects(store.list(''), /forbidden/);
  assert.equal(calls.length, 1);
});

test('desktop WebDAV performs only PROPFIND through the real HTTP client', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push([request.method, request.url]);
    if (request.url === '/dav/') {
      response.writeHead(207, { 'Content-Type': 'application/xml' }).end(
        '<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"><D:response><D:href>/dav/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>',
      );
    } else response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const store = createRemoteObjectStore({ kind: 'webdav', endpoint: `http://127.0.0.1:${server.address().port}/dav`, directory: 'backups' });
    assert.deepEqual(await store.list('v1/snapshots'), []);
    assert.deepEqual(requests, [['PROPFIND', '/dav/backups/v1/snapshots/'], ['PROPFIND', '/dav/']]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
