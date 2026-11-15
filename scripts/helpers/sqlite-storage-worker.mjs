import { SQLiteStorageProvider } from '../../packages/core/dist/node.js';
import { TemplateManager, HistoryManager } from '../../packages/core/dist/index.js';
import { DatabaseSync } from 'node:sqlite';

const [databasePath, options] = process.argv.slice(2);
const provider = new SQLiteStorageProvider(databasePath, JSON.parse(options || '{}'));
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const send = value => process.send(value);

process.on('message', async ({ id, command, ...args }) => {
  try {
    let result;
    switch (command) {
      case 'increment':
        for (let i = 0; i < args.count; i++) {
          await provider.updateData('counter', n => (n ?? 0) + 1);
        }
        result = await provider.getItem('counter');
        break;
      case 'cas': result = await provider.compareAndSetItem(args.key, args.expected, args.value); break;
      case 'get': result = await provider.getItem(args.key); break;
      case 'set': await provider.setItem(args.key, args.value); break;
      case 'hold':
        await provider.updateData('held', current => {
          send({ event: 'locked' });
          pause(args.ms);
          return (current ?? 0) + 1;
        });
        break;
      case 'batch-loop':
        for (let i = 1; i <= args.count; i++) {
          await provider.batchUpdate([
            { operation: 'set', key: 'left', value: String(i) },
            { operation: 'set', key: 'right', value: String(i) },
          ]);
        }
        break;
      case 'observe-batches': {
        const db = new DatabaseSync(databasePath);
        try {
          let samples = 0;
          const generations = new Set();
          const end = Date.now() + args.ms;
          const query = db.prepare("SELECT value FROM storage_kv WHERE key IN ('left', 'right') ORDER BY key");
          while (Date.now() < end) {
            const rows = query.all();
            if (rows.length !== 2 || rows[0].value !== rows[1].value) throw new Error('Partial batch visible');
            generations.add(rows[0].value);
            if (samples === 0) send({ event: 'observing' });
            samples++;
          }
          result = { samples, generations: generations.size };
        } finally { db.close(); }
        break;
      }
      case 'batch-fail':
        await provider.batchUpdate([
          { operation: 'set', key: 'left', value: 'partial' },
          { operation: 'set', key: 'blocked', value: 'fail' },
        ]);
        break;
      case 'templates': {
        const manager = new TemplateManager(provider, { getCurrentLanguage: async () => 'en-US' });
        for (let i = 0; i < args.count; i++) {
          await manager.saveTemplate({
            id: `${args.prefix}-${i}`, name: 'Synthetic template', content: 'Test content', isBuiltin: false,
            metadata: { version: '1.0.0', templateType: 'optimize', lastModified: 0 },
          });
        }
        break;
      }
      case 'delete-template': {
        const manager = new TemplateManager(provider, { getCurrentLanguage: async () => 'en-US' });
        await manager.deleteTemplate(args.key);
        break;
      }
      case 'history': {
        const manager = new HistoryManager(provider, {});
        for (let i = 0; i < args.count; i++) {
          await manager.addRecord({ id: `${args.prefix}-${i}`, originalPrompt: 'test', optimizedPrompt: 'test', type: 'optimize', chainId: args.prefix, version: i + 1, timestamp: i });
        }
        break;
      }
      case 'delete-chain': await new HistoryManager(provider, {}).deleteChain(args.key); break;
      default: throw new Error(`Unknown command: ${command}`);
    }
    send({ id, result });
  } catch (error) {
    send({ id, error: { name: error.name, message: error.message } });
  }
});

await provider.flush();
send({ event: 'ready', pid: process.pid, node: process.versions.node, electron: process.versions.electron, sqlite: process.versions.sqlite });
process.on('disconnect', async () => { await provider.close(); });
