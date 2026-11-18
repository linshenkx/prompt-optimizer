// Deliberately separate from index.ts: web/extension builds must never load node:sqlite.
export { SQLiteStorageProvider, DESKTOP_STORAGE_DIVERGENCE_REASON } from './services/storage/sqliteStorageProvider';
export type { ExistingSQLiteStorage, SQLiteStorageOptions, LegacyStorageSnapshot, StorageMigrationResult } from './services/storage/sqliteStorageProvider';
export { openDesktopStorage, openExistingDesktopStorage, openExistingDesktopStorageForWriting, exportDesktopStorageAsLegacyJSON, DESKTOP_DATABASE_FILENAME, LEGACY_STORAGE_FILENAME } from './services/storage/desktopStorage';
