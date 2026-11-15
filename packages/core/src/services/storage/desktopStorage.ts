import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StorageError } from './errors';
import { SQLiteStorageProvider } from './sqliteStorageProvider';
import type { LegacyStorageSnapshot, SQLiteStorageOptions, StorageMigrationResult } from './sqliteStorageProvider';

export const DESKTOP_DATABASE_FILENAME = 'prompt-optimizer-data.sqlite';
export const LEGACY_STORAGE_FILENAME = 'prompt-optimizer-data.json';

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
