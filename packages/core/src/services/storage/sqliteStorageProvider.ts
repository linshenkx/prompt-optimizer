import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { IStorageProvider } from './types';
import { StorageError } from './errors';

export interface SQLiteStorageOptions {
  /** Maximum synchronous wait per attempt. Default: 50ms. */
  busyTimeoutMs?: number;
  /** Retries before acquiring a transaction; callbacks are never replayed. Default: 12. */
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface LegacyStorageSnapshot {
  source: 'json' | 'backup' | 'empty';
  entries: Map<string, string>;
}

export interface StorageMigrationResult {
  version: 1;
  source: LegacyStorageSnapshot['source'];
  itemCount: number;
}

const BOOTSTRAP_KEY = 'legacy-json-migration';
type Operation = StorageError['operation'];
type BatchOperation = Parameters<IStorageProvider['batchUpdate']>[0][number];

const isBusy = (error: unknown): boolean => {
  const code = (error as { errcode?: number })?.errcode;
  // Extended SQLite codes retain the primary result in the low byte.
  return typeof code === 'number' && (code & 0xff) === 5;
};

/** Node/Electron main process only. Import via @prompt-optimizer/core/node. */
export class SQLiteStorageProvider implements IStorageProvider {
  readonly databasePath: string;
  private db?: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  private unusable = false;
  private closePromise?: Promise<void>;
  private readonly options: Required<SQLiteStorageOptions>;

  constructor(databasePath: string, options: SQLiteStorageOptions = {}) {
    if (!databasePath || databasePath === ':memory:') {
      throw new StorageError('SQLite storage requires a persistent database path', 'config');
    }
    this.databasePath = resolve(databasePath);
    this.options = { busyTimeoutMs: 50, maxRetries: 12, retryDelayMs: 25, ...options };
    for (const value of Object.values(this.options)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new StorageError('SQLite wait and retry options must be nonnegative integers', 'config');
      }
    }
  }

  private async waitForLock(action: () => void): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        action();
        return;
      } catch (error) {
        if (!isBusy(error) || attempt >= this.options.maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs));
      }
    }
  }

  private async database(): Promise<DatabaseSync> {
    if (this.unusable) throw new StorageError('SQLite connection is unusable; reopen storage', 'config');
    if (this.db) return this.db;
    mkdirSync(dirname(this.databasePath), { recursive: true });
    const db = new DatabaseSync(this.databasePath, {
      timeout: this.options.busyTimeoutMs,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    });
    try {
      await this.waitForLock(() => { db.exec('PRAGMA journal_mode=WAL'); });
      const mode = db.prepare('PRAGMA journal_mode').get();
      if (mode?.journal_mode !== 'wal') throw new StorageError('SQLite WAL mode is required', 'config');
      db.exec('PRAGMA synchronous=FULL');
      await this.transaction(db, () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS storage_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
          CREATE TABLE IF NOT EXISTS storage_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
        `);
      });
      this.db = db;
      return db;
    } catch (error) {
      if (db.isOpen) db.close();
      throw error;
    }
  }

  private run<T>(operation: Operation, action: (db: DatabaseSync) => T | Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new StorageError('SQLite storage is closed', operation));
    const result = this.queue.then(async () => {
      try {
        return await action(await this.database());
      } catch (error) {
        // Preserve domain errors from updateData modifiers; do not include data or SQL in errors.
        if ((error as { code?: string })?.code === 'ERR_SQLITE_ERROR') {
          const wrapped = new StorageError(isBusy(error) ? 'SQLite storage is busy; retry later' : 'SQLite operation failed', operation);
          Object.defineProperty(wrapped, 'cause', { value: error });
          throw wrapped;
        }
        throw error;
      }
    });
    this.queue = result.catch(() => {});
    return result;
  }

  private async transaction<T>(db: DatabaseSync, action: () => T): Promise<T> {
    // Acquire the writer lock BEFORE reading. Only acquisition is retried.
    await this.waitForLock(() => db.exec('BEGIN IMMEDIATE'));
    try {
      const result = action();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        if (db.isTransaction) db.exec('ROLLBACK');
      } catch {
        // An unusable connection must never serve subsequent operations.
        this.closing = true;
        this.unusable = true;
        if (db.isOpen) db.close();
        this.db = undefined;
      }
      throw error;
    }
  }

  private read(db: DatabaseSync, key: string): string | null {
    return (db.prepare('SELECT value FROM storage_kv WHERE key = ?').get(key)?.value as string | undefined) ?? null;
  }

  private write(db: DatabaseSync, key: string, value: string): void {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new StorageError('SQLite keys and values must be strings', 'write');
    }
    db.prepare('INSERT INTO storage_kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  getItem(key: string): Promise<string | null> {
    return this.run('read', db => this.read(db, key));
  }

  setItem(key: string, value: string): Promise<void> {
    return this.run('write', db => this.transaction(db, () => this.write(db, key, value)));
  }

  removeItem(key: string): Promise<void> {
    return this.run('delete', db => this.transaction(db, () => { db.prepare('DELETE FROM storage_kv WHERE key = ?').run(key); }));
  }

  clearAll(): Promise<void> {
    // Migration metadata survives clearing user data, so old JSON is never resurrected.
    return this.run('clear', db => this.transaction(db, () => db.exec('DELETE FROM storage_kv')));
  }

  compareAndSetItem(key: string, expected: string | null, value: string | null): Promise<boolean> {
    return this.run('write', db => this.transaction(db, () => {
      if (this.read(db, key) !== expected) return false;
      if (value === null) db.prepare('DELETE FROM storage_kv WHERE key = ?').run(key);
      else this.write(db, key, value);
      return true;
    }));
  }

  updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
    return this.run('write', db => this.transaction(db, () => {
      const raw = this.read(db, key);
      const value = modifier(raw === null ? null : JSON.parse(raw) as T);
      if (value && typeof (value as { then?: unknown }).then === 'function') {
        throw new StorageError('SQLite updateData modifiers must be synchronous', 'write');
      }
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new StorageError('Value is not JSON serializable', 'write');
      this.write(db, key, serialized);
    }));
  }

  batchUpdate(operations: BatchOperation[]): Promise<void> {
    // Snapshot input before entering the queue.
    const batch = operations.map(op => ({ ...op }));
    return this.run('write', db => this.transaction(db, () => {
      for (const op of batch) {
        if (op.operation === 'set' && op.value !== undefined) this.write(db, op.key, op.value);
        else if (op.operation === 'remove') db.prepare('DELETE FROM storage_kv WHERE key = ?').run(op.key);
        else throw new StorageError('Invalid SQLite batch operation', 'write');
      }
    }));
  }

  getAllKeys(): Promise<string[]> {
    return this.run('read', db => db.prepare('SELECT key FROM storage_kv ORDER BY key').all().map(row => row.key as string));
  }

  /** For desktop bootstrap only. Source loading, copy, verification and marker share one transaction. */
  initializeFromLegacy(load: () => LegacyStorageSnapshot): Promise<StorageMigrationResult> {
    return this.run('write', db => this.transaction(db, () => {
      const marker = db.prepare('SELECT value FROM storage_metadata WHERE key = ?').get(BOOTSTRAP_KEY)?.value;
      if (marker !== undefined) {
        const result = JSON.parse(marker as string) as StorageMigrationResult;
        if (result.version !== 1 || !['json', 'backup', 'empty'].includes(result.source) || !Number.isSafeInteger(result.itemCount) || result.itemCount < 0) {
          throw new StorageError('Unsupported SQLite migration state', 'config');
        }
        return result;
      }
      if (db.prepare('SELECT 1 FROM storage_kv LIMIT 1').get()) {
        throw new StorageError('Unmarked SQLite data requires explicit reconciliation', 'config');
      }
      const { entries, source } = load();
      for (const [key, value] of entries) this.write(db, key, value);
      const rows = db.prepare('SELECT key, value FROM storage_kv').all();
      if (rows.length !== entries.size || rows.some(row => entries.get(row.key as string) !== row.value)) {
        throw new StorageError('SQLite migration verification failed', 'write');
      }
      const result: StorageMigrationResult = { version: 1, source, itemCount: entries.size };
      db.prepare('INSERT INTO storage_metadata(key, value) VALUES (?, ?)').run(BOOTSTRAP_KEY, JSON.stringify(result));
      return result;
    }));
  }

  getCapabilities() {
    return { supportsAtomic: true, supportsBatch: true };
  }

  /** Writes are already committed durably when their promises resolve. No forced checkpoint. */
  flush(): Promise<void> {
    return this.run('write', () => {});
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.closePromise = this.queue.then(() => {
      if (this.db?.isOpen) this.db.close();
      this.db = undefined;
    });
    this.queue = this.closePromise.catch(() => {});
    return this.closePromise;
  }
}
