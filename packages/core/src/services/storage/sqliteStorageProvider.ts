import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
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

export interface ExistingSQLiteStorage {
  provider: SQLiteStorageProvider;
  migration: StorageMigrationResult;
}

const BOOTSTRAP_KEY = 'legacy-json-migration';
type Operation = StorageError['operation'];
type BatchOperation = Parameters<IStorageProvider['batchUpdate']>[0][number];

function parseMigrationMarker(marker: unknown): StorageMigrationResult {
  let result: unknown;
  try {
    if (typeof marker !== 'string') throw new Error('Missing marker');
    result = JSON.parse(marker);
  } catch {
    throw new StorageError('Missing or invalid SQLite migration state', 'config');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new StorageError('Unsupported SQLite migration state', 'config');
  }
  const value = result as Partial<StorageMigrationResult>;
  if (value.version !== 1 || !['json', 'backup', 'empty'].includes(value.source ?? '') ||
      !Number.isSafeInteger(value.itemCount) || (value.itemCount as number) < 0 ||
      (value.source === 'empty' && value.itemCount !== 0)) {
    throw new StorageError('Unsupported SQLite migration state', 'config');
  }
  return { version: 1, source: value.source!, itemCount: value.itemCount! };
}

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
  private existingOnly = false;
  private existingMigration?: StorageMigrationResult;

  /** Existing-only connections are always native SQLite readOnly connections. */
  get readOnly(): boolean { return this.existingOnly; }

  /** Never creates directories, tables, migration state or business defaults. */
  static async openExistingReadOnly(databasePath: string, options?: SQLiteStorageOptions): Promise<ExistingSQLiteStorage> {
    if (typeof databasePath !== 'string' || !isAbsolute(databasePath)) {
      throw new StorageError('Existing SQLite storage requires an absolute database path', 'config');
    }
    const provider = new SQLiteStorageProvider(databasePath, options);
    provider.existingOnly = true;
    try {
      const migration = await provider.run('read', () => ({ ...provider.existingMigration! }));
      return { provider, migration };
    } catch (error) {
      await provider.close();
      throw error;
    }
  }

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
    if (this.existingOnly) {
      try {
        if (!statSync(this.databasePath).isFile()) throw new StorageError('Existing SQLite path must be a database file', 'config');
      } catch (error) {
        if (error instanceof StorageError) throw error;
        throw new StorageError((error as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'Existing SQLite database does not exist'
          : 'Cannot access existing SQLite database', 'config');
      }
    } else {
      mkdirSync(dirname(this.databasePath), { recursive: true });
      // A pre-existing zero-byte file might be truncated current data. Do not silently
      // treat it as first run. Briefly allow a concurrent cold opener to write its header.
      for (let attempt = 0; ; attempt++) {
        try {
          const file = statSync(this.databasePath);
          if (!file.isFile()) throw new StorageError('SQLite path must be a database file', 'config');
          if (file.size > 0) break;
          if (attempt >= this.options.maxRetries) {
            throw new StorageError('Existing SQLite database is empty or truncated; explicit reconciliation required', 'config');
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') break;
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs));
      }
    }
    const db = new DatabaseSync(this.databasePath, {
      timeout: this.options.busyTimeoutMs,
      readOnly: this.existingOnly,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    });
    try {
      if (this.existingOnly) {
        // Query-only is connection-local; readOnly above also enforces this in SQLite.
        db.exec('PRAGMA query_only=ON');
        db.exec('BEGIN');
        try {
          this.validateExistingSchema(db);
          this.existingMigration = parseMigrationMarker(
            db.prepare('SELECT value FROM storage_metadata WHERE key = ?').get(BOOTSTRAP_KEY)?.value,
          );
          db.exec('COMMIT');
        } catch (error) {
          if (db.isTransaction) db.exec('ROLLBACK');
          throw error;
        }
        this.db = db;
        return db;
      }
      // Validate existing structure BEFORE changing journal mode or issuing any DDL.
      // Recheck under the writer lock as a different cold opener may initialize meanwhile.
      if (!this.isUninitializedSchema(db)) this.validateExistingSchema(db);
      await this.waitForLock(() => { db.exec('PRAGMA journal_mode=WAL'); });
      const mode = db.prepare('PRAGMA journal_mode').get();
      if (mode?.journal_mode !== 'wal') throw new StorageError('SQLite WAL mode is required', 'config');
      db.exec('PRAGMA synchronous=FULL');
      await this.transaction(db, () => {
        if (this.isUninitializedSchema(db)) {
          db.exec(`
            CREATE TABLE storage_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
            CREATE TABLE storage_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
          `);
        } else this.validateExistingSchema(db);
      });
      this.db = db;
      return db;
    } catch (error) {
      if (db.isOpen) db.close();
      throw error;
    }
  }

  private isUninitializedSchema(db: DatabaseSync): boolean {
    return db.prepare('PRAGMA user_version').get()?.user_version === 0 &&
      db.prepare('PRAGMA schema_version').get()?.schema_version === 0 &&
      !db.prepare('SELECT 1 FROM sqlite_schema LIMIT 1').get();
  }

  private validateExistingSchema(db: DatabaseSync): void {
    const invalid = () => new StorageError('Existing SQLite schema or integrity is incompatible', 'config');
    if (db.prepare('PRAGMA journal_mode').get()?.journal_mode !== 'wal' ||
        db.prepare('PRAGMA user_version').get()?.user_version !== 0) throw invalid();
    for (const name of ['storage_kv', 'storage_metadata']) {
      // Names are fixed constants, never caller input. Views and extra/generated columns are refused.
      const table = db.prepare('SELECT type, ncol, wr, strict FROM pragma_table_list WHERE schema = ? AND name = ?').get('main', name);
      const columns = db.prepare(`PRAGMA main.table_xinfo('${name}')`).all();
      if (table?.type !== 'table' || table.ncol !== 2 || table.wr !== 0 || table.strict !== 1 || columns.length !== 2) throw invalid();
      for (const [index, columnName] of ['key', 'value'].entries()) {
        const column = columns[index];
        if (column.name !== columnName || column.type !== 'TEXT' || column.notnull !== 1 ||
            column.pk !== (index === 0 ? 1 : 0) || column.hidden !== 0 || column.dflt_value !== null) throw invalid();
      }
    }
    if (db.prepare('PRAGMA quick_check(1)').get()?.quick_check !== 'ok') throw invalid();
  }

  private run<T>(operation: Operation, action: (db: DatabaseSync) => T | Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new StorageError('SQLite storage is closed', operation));
    if (this.existingOnly && operation !== 'read') {
      return Promise.reject(new StorageError('SQLite storage is read-only', operation));
    }
    const result = this.queue.then(async () => {
      try {
        return await action(await this.database());
      } catch (error) {
        // Preserve domain errors from updateData modifiers; do not include data or SQL in errors.
        if ((error as { code?: string })?.code === 'ERR_SQLITE_ERROR') {
          const message = isBusy(error) ? 'SQLite storage is busy; retry later'
            : this.existingOnly ? 'Cannot read existing SQLite database; it may be corrupt or incompatible' : 'SQLite operation failed';
          const wrapped = new StorageError(message, operation);
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

  /** One SQL statement provides one complete business KV snapshot, including unknown keys. */
  getAllEntries(): Promise<Array<[string, string]>> {
    return this.run('read', db => db.prepare('SELECT key, value FROM storage_kv ORDER BY key').all()
      .map((row): [string, string] => [row.key as string, row.value as string]));
  }

  /** For desktop bootstrap only. Source loading, copy, verification and marker share one transaction. */
  initializeFromLegacy(load: () => LegacyStorageSnapshot): Promise<StorageMigrationResult> {
    return this.run('write', db => this.transaction(db, () => {
      const marker = db.prepare('SELECT value FROM storage_metadata WHERE key = ?').get(BOOTSTRAP_KEY)?.value;
      if (marker !== undefined) {
        return parseMigrationMarker(marker);
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
    return { supportsAtomic: !this.readOnly, supportsBatch: !this.readOnly, readOnly: this.readOnly };
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
