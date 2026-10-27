import type { RemoteBackupProviderConfig } from './remote-backup'

export const BACKUP_IMPORT_CODE_PREFIX = 'POBACKUP:'
export const BACKUP_IMPORT_QUERY_KEY = 'backupImport'
export const BACKUP_IMPORT_QR_MAX_LENGTH = 2331
const MAX_CODE_LENGTH = 24_000

export type BackupImportCodeErrorKind = 'invalid' | 'unsupportedVersion' | 'unsupportedProvider'

export class BackupImportCodeError extends Error {
  constructor(readonly kind: BackupImportCodeErrorKind = 'invalid') {
    super(`Backup import code: ${kind}`)
    this.name = 'BackupImportCodeError'
  }
}

export interface RemoteBackupImportCode {
  version: 1
  provider: RemoteBackupProviderConfig
  snapshotId: string
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringField = (value: unknown, required = false): string => {
  if (typeof value !== 'string' || (required && !value.trim())) throw new BackupImportCodeError()
  return value
}

// Copy only the selected connection's portable fields. Never export the saved
// provider map, browser authorization caches, or device-specific preferences.
const portableProvider = (value: unknown): RemoteBackupProviderConfig => {
  if (!record(value)) throw new BackupImportCodeError()
  if (value.kind === 'cloudflare-r2') {
    return {
      kind: value.kind,
      accountId: stringField(value.accountId, true),
      bucket: stringField(value.bucket, true),
      accessKeyId: stringField(value.accessKeyId, true),
      secretAccessKey: stringField(value.secretAccessKey, true),
    }
  }
  if (value.kind !== 's3-compatible' && value.kind !== 'webdav') {
    // Google Drive authorization is not part of its connection configuration
    // and cannot be transferred by copying { kind: 'google-drive' }.
    throw new BackupImportCodeError('unsupportedProvider')
  }
  const endpoint = stringField(value.endpoint, true)
  try {
    if (!['http:', 'https:'].includes(new URL(endpoint).protocol)) throw new Error()
  } catch {
    throw new BackupImportCodeError()
  }
  if (value.kind === 'webdav') {
    return {
      kind: value.kind, endpoint,
      username: stringField(value.username), password: stringField(value.password),
      directory: stringField(value.directory),
    }
  }
  if (typeof value.forcePathStyle !== 'boolean') throw new BackupImportCodeError()
  return {
    kind: value.kind, endpoint,
    region: stringField(value.region, true), bucket: stringField(value.bucket, true),
    accessKeyId: stringField(value.accessKeyId, true),
    secretAccessKey: stringField(value.secretAccessKey, true),
    prefix: stringField(value.prefix), forcePathStyle: value.forcePathStyle,
  }
}

const payload = (value: unknown): RemoteBackupImportCode => {
  if (!record(value)) throw new BackupImportCodeError()
  if (value.version !== 1) throw new BackupImportCodeError('unsupportedVersion')
  const snapshotId = stringField(value.snapshotId, true)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(snapshotId) || snapshotId.includes('..')) {
    throw new BackupImportCodeError()
  }
  return { version: 1, provider: portableProvider(value.provider), snapshotId }
}

export const createRemoteBackupImportCode = (
  provider: RemoteBackupProviderConfig,
  snapshotId: string,
): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload({ version: 1, provider, snapshotId })))
  if (bytes.length > MAX_CODE_LENGTH * 3 / 4) throw new BackupImportCodeError()
  const code = BACKUP_IMPORT_CODE_PREFIX + btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  if (code.length > MAX_CODE_LENGTH) throw new BackupImportCodeError()
  return code
}

export const getBackupImportCodeFromUrl = (input: string): string | null => {
  try {
    const url = new URL(input)
    const queryIndex = url.hash.indexOf('?')
    if (queryIndex < 0) return null
    return new URLSearchParams(url.hash.slice(queryIndex + 1)).get(BACKUP_IMPORT_QUERY_KEY)
  } catch {
    return null
  }
}

export const parseRemoteBackupImportCode = (input: string): RemoteBackupImportCode => {
  try {
    if (input.length > MAX_CODE_LENGTH * 2) throw new BackupImportCodeError()
    const code = (getBackupImportCodeFromUrl(input.trim()) ?? input.trim())
    if (!code.startsWith(BACKUP_IMPORT_CODE_PREFIX) || code.length > MAX_CODE_LENGTH) {
      throw new BackupImportCodeError()
    }
    const encoded = code.slice(BACKUP_IMPORT_CODE_PREFIX.length)
    if (!/^[a-zA-Z0-9_-]+$/.test(encoded)) throw new BackupImportCodeError()
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    return payload(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch (error) {
    throw error instanceof BackupImportCodeError ? error : new BackupImportCodeError()
  }
}

export const createRemoteBackupImportUrl = (code: string, baseUrl: string): string => {
  const url = new URL(baseUrl)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new BackupImportCodeError()
  }
  url.search = ''
  url.hash = `/basic/system?${BACKUP_IMPORT_QUERY_KEY}=${encodeURIComponent(code)}`
  return url.href
}
