import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { StorageError } from './errors';
import { SQLiteStorageProvider } from './sqliteStorageProvider';
import type { ExistingSQLiteStorage, LegacyStorageSnapshot, SQLiteStorageOptions, StorageMigrationResult } from './sqliteStorageProvider';

export const DESKTOP_DATABASE_FILENAME = 'prompt-optimizer-data.sqlite';
export const LEGACY_STORAGE_FILENAME = 'prompt-optimizer-data.json';

/**
 * Read-only access to an explicitly selected, existing and migrated desktop database.
 * Never bootstraps or reads legacy JSON. WAL/SHM bookkeeping can still have OS side effects.
 */
export function openExistingDesktopStorage(
  userDataPath: string,
  options?: SQLiteStorageOptions,
): Promise<ExistingSQLiteStorage> {
  if (typeof userDataPath !== 'string' || !isAbsolute(userDataPath)) {
    return Promise.reject(new StorageError('Existing desktop storage requires an absolute user data directory', 'config'));
  }
  return SQLiteStorageProvider.openExistingReadOnly(join(userDataPath, DESKTOP_DATABASE_FILENAME), options);
}

/** Explicit in-memory export of CURRENT committed KV, not the retained historical JSON source. */
export async function exportDesktopStorageAsLegacyJSON(
  userDataPath: string,
  options?: SQLiteStorageOptions,
): Promise<string> {
  const { provider } = await openExistingDesktopStorage(userDataPath, options);
  try {
    return JSON.stringify(Object.fromEntries(await provider.getAllEntries()));
  } finally {
    await provider.close();
  }
}

/** Read the legacy format without instantiating FileStorageProvider (which writes backups). */
function loadLegacy(userDataPath: string): LegacyStorageSnapshot {
  let foundInvalidFile = false;
  for (const [filename, source] of [
    [LEGACY_STORAGE_FILENAME, 'json'],
    [`${LEGACY_STORAGE_FILENAME}.backup`, 'backup'],
  ] as const) {
    let content: string;
    try {
      content = readFileSync(join(userDataPath, filename), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new StorageError('Cannot read legacy storage; source has been retained', 'read');
    }
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid storage object');
      const entries = new Map<string, string>();
      for (const [key, value] of Object.entries(parsed)) {
        entries.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
      return { entries, source };
    } catch {
      foundInvalidFile = true;
    }
  }
  if (foundInvalidFile) throw new StorageError('Legacy storage is invalid; source has been retained', 'read');
  return { source: 'empty', entries: new Map() };
}

/**
 * The only desktop bootstrap entry. A committed migration marker makes SQLite authoritative.
 * Failure closes the connection, preserves the source and rejects startup; never silently use
 * stale JSON after switching. Callers must not expose services before this promise resolves.
 */
export async function openDesktopStorage(
  userDataPath: string,
  options?: SQLiteStorageOptions,
): Promise<{ provider: SQLiteStorageProvider; migration: StorageMigrationResult }> {
  if (!userDataPath) throw new StorageError('Desktop storage requires a user data directory', 'config');
  const provider = new SQLiteStorageProvider(join(userDataPath, DESKTOP_DATABASE_FILENAME), options);
  try {
    const migration = await provider.initializeFromLegacy(() => loadLegacy(userDataPath));
    return { provider, migration };
  } catch (error) {
    await provider.close();
    throw error;
  }
}
