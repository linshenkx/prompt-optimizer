import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { StorageError } from './errors';
import { SQLiteStorageProvider } from './sqliteStorageProvider';
import type { ExistingSQLiteStorage, LegacyStorageSnapshot, SQLiteStorageOptions, StorageMigrationResult } from './sqliteStorageProvider';

export const DESKTOP_DATABASE_FILENAME = 'prompt-optimizer-data.sqlite';
export const LEGACY_STORAGE_FILENAME = 'prompt-optimizer-data.json';

function validateExistingUserDataPath(userDataPath: string): void {
  if (typeof userDataPath !== 'string' || !isAbsolute(userDataPath)) {
    throw new StorageError('Existing desktop storage requires an absolute user data directory', 'config');
  }
}

/**
 * Read-only access to an explicitly selected, existing and migrated desktop database.
 * Never bootstraps or reads legacy JSON. WAL/SHM bookkeeping can still have OS side effects.
 */
export async function openExistingDesktopStorage(
  userDataPath: string,
  options?: SQLiteStorageOptions,
): Promise<ExistingSQLiteStorage> {
  validateExistingUserDataPath(userDataPath);
  return SQLiteStorageProvider.openExistingReadOnly(join(userDataPath, DESKTOP_DATABASE_FILENAME), options);
}

/** Existing-only write access for explicitly configured local integrations. */
export async function openExistingDesktopStorageForWriting(
  userDataPath: string,
  options?: SQLiteStorageOptions,
): Promise<ExistingSQLiteStorage> {
  validateExistingUserDataPath(userDataPath);
  return SQLiteStorageProvider.openExistingWritable(
    join(userDataPath, DESKTOP_DATABASE_FILENAME),
    alreadyMigrated => loadLegacy(userDataPath, alreadyMigrated),
    options,
  );
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

type LegacyFile = { status: 'valid'; entries: Map<string, string> } | { status: 'missing' | 'invalid' };

function readLegacyFile(filename: string): LegacyFile {
  let content: string;
  try {
    content = readFileSync(filename, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' };
    throw new StorageError('Cannot read legacy storage; source has been retained', 'read');
  }
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'invalid' };
    const entries = new Map<string, string>();
    for (const [key, value] of Object.entries(parsed)) {
      entries.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    return { status: 'valid', entries };
  } catch {
    return { status: 'invalid' };
  }
}

/** Read the legacy format without instantiating FileStorageProvider (which writes backups). */
function loadLegacy(userDataPath: string, alreadyMigrated: boolean): LegacyStorageSnapshot {
  const filename = join(userDataPath, LEGACY_STORAGE_FILENAME);
  const backupFilename = filename + '.backup';
  const main = readLegacyFile(filename);
  if (main.status === 'valid') {
    return {
      source: 'json',
      entries: main.entries,
      readBackupEntries: () => {
        try {
          const backup = readLegacyFile(backupFilename);
          return backup.status === 'valid' ? backup.entries : undefined;
        } catch (error) {
          // An unreadable, unused historical backup is not a reason to reject a valid primary.
          // If the backup becomes the active fallback later, it will be checked then.
          if (error instanceof StorageError) return undefined;
          throw error;
        }
      },
    };
  }

  const backup = readLegacyFile(backupFilename);
  if (backup.status === 'valid') return { source: 'backup', entries: backup.entries };
  if (!alreadyMigrated && (main.status === 'invalid' || backup.status === 'invalid')) {
    throw new StorageError('Legacy storage is invalid; source has been retained', 'read');
  }
  return { source: 'empty', entries: new Map() };
}

/**
 * The only desktop bootstrap entry. The migration marker records the transferred source,
 * and any later divergence is rejected before business services use the database.
 */
export async function openDesktopStorage(
  userDataPath: string,
  options?: SQLiteStorageOptions,
): Promise<{ provider: SQLiteStorageProvider; migration: StorageMigrationResult }> {
  if (!userDataPath) throw new StorageError('Desktop storage requires a user data directory', 'config');
  const provider = new SQLiteStorageProvider(join(userDataPath, DESKTOP_DATABASE_FILENAME), options);
  try {
    const migration = await provider.initializeFromLegacy(alreadyMigrated => loadLegacy(userDataPath, alreadyMigrated));
    return { provider, migration };
  } catch (error) {
    await provider.close();
    throw error;
  }
}
