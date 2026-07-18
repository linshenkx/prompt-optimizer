const test = require('node:test');
const assert = require('node:assert/strict');

const { handleRemoteStorageOperation } = require('../remote-storage');

const webDavRequest = (path, directory = 'prompt-optimizer-backups') => ({
  operation: 'head',
  path,
  provider: {
    kind: 'webdav',
    endpoint: 'https://storage.example.test',
    directory,
  },
});

test('remote storage rejects traversal paths before creating a client', async () => {
  const unsafePaths = [
    '../outside.json',
    'nested/../../outside.json',
    'nested\\..\\outside.json',
    '%2e%2e/outside.json',
    'nested/%2foutside.json',
  ];

  for (const path of unsafePaths) {
    let clientCreated = false;
    await assert.rejects(
      handleRemoteStorageOperation(webDavRequest(path), {
        createWebDavClient: async () => {
          clientCreated = true;
          return {};
        },
      }),
      /Remote storage path/,
    );
    assert.equal(clientCreated, false, `client should not be created for ${path}`);
  }
});

test('remote storage rejects a traversal base directory', async () => {
  let clientCreated = false;
  await assert.rejects(
    handleRemoteStorageOperation(webDavRequest('backup.json', '../outside'), {
      createWebDavClient: async () => {
        clientCreated = true;
        return {};
      },
    }),
    /Remote storage path/,
  );
  assert.equal(clientCreated, false);
});

test('remote storage keeps valid nested WebDAV paths compatible', async () => {
  let requestedPath = null;
  const result = await handleRemoteStorageOperation(webDavRequest('daily/backup.json'), {
    createWebDavClient: async () => ({
      stat: async (path) => {
        requestedPath = path;
        return { size: 42 };
      },
    }),
  });

  assert.equal(requestedPath, '/prompt-optimizer-backups/daily/backup.json');
  assert.equal(result.path, 'daily/backup.json');
  assert.equal(result.sizeBytes, 42);
});
