// Deliberately separate from index.ts: web/extension builds must never load node:sqlite.
export { SQLiteStorageProvider } from './services/storage/sqliteStorageProvider';
export type { SQLiteStorageOptions, LegacyStorageSnapshot, StorageMigrationResult } from './services/storage/sqliteStorageProvider';
export { openDesktopStorage, DESKTOP_DATABASE_FILENAME, LEGACY_STORAGE_FILENAME } from './services/storage/desktopStorage';
