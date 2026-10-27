import { describe, expect, it } from 'vitest'
import type { RemoteBackupProviderConfig } from '../../../src/utils/remote-backup'
import {
  BACKUP_IMPORT_CODE_PREFIX, BackupImportCodeError,
  createRemoteBackupImportCode, createRemoteBackupImportUrl,
  getBackupImportCodeFromUrl, parseRemoteBackupImportCode,
} from '../../../src/utils/remote-backup-import-code'

const provider: RemoteBackupProviderConfig = {
  kind: 'cloudflare-r2', accountId: 'account', bucket: 'backups', accessKeyId: 'key', secretAccessKey: 'secret',
}

describe('remote backup import codes', () => {
  it.each<RemoteBackupProviderConfig>([
    provider,
    { kind: 'webdav', endpoint: 'https://dav.example/path', username: '用户', password: '密钥🔑', directory: '' },
    { kind: 's3-compatible', endpoint: 'http://localhost:9000', bucket: 'backup', region: 'auto', prefix: '',
      accessKeyId: 'ak', secretAccessKey: 'sk', forcePathStyle: false },
  ])('round-trips a portable $kind connection without changing its path or credentials', connection => {
    const code = createRemoteBackupImportCode(connection, '2026-10-27T10-00-00-123Z')
    expect(parseRemoteBackupImportCode(` ${code}\n`)).toEqual({
      version: 1, provider: connection, snapshotId: '2026-10-27T10-00-00-123Z',
    })
  })

  it('exports only the selected connection and pins the selected backup', () => {
    const code = createRemoteBackupImportCode({ ...provider, providers: { webdav: { password: 'other-secret' } } } as any, 'selected')
    expect(parseRemoteBackupImportCode(code)).toEqual({ version: 1, provider, snapshotId: 'selected' })
    expect(atob(code.slice(BACKUP_IMPORT_CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/'))).not.toContain('other-secret')
  })

  it('accepts both a text code and its mobile link while keeping credentials in the fragment', () => {
    const code = createRemoteBackupImportCode(provider, 'selected')
    const link = createRemoteBackupImportUrl(code, 'https://app.example/sub/?old=1#/favorites')
    const url = new URL(link)
    expect(url.pathname).toBe('/sub/')
    expect(url.search).toBe('')
    expect(url.hash).toMatch(/^#\/basic\/system\?backupImport=/)
    expect(getBackupImportCodeFromUrl(link)).toBe(code)
    expect(parseRemoteBackupImportCode(link)).toEqual(parseRemoteBackupImportCode(code))
  })

  it.each(['', 'wrong', 'POBACKUP:%%%', 'POBACKUP:////', 'POBACKUP:e30', 'x'.repeat(50_000)])('rejects malformed input', code => {
    expect(() => parseRemoteBackupImportCode(code)).toThrow(BackupImportCodeError)
  })

  it('rejects unknown versions instead of guessing a provider', () => {
    const code = BACKUP_IMPORT_CODE_PREFIX + btoa(JSON.stringify({ version: 2, provider, snapshotId: 'backup' }))
    expect(() => parseRemoteBackupImportCode(code)).toThrow('unsupportedVersion')
  })

  it.each(['../backup', '/backup', 'a/b', 'a\\b', '..', 'a%2fb'])('rejects snapshot path traversal: %s', id => {
    expect(() => createRemoteBackupImportCode(provider, id)).toThrow(BackupImportCodeError)
  })

  it('does not pretend to transfer Google Drive authorization', () => {
    expect(() => createRemoteBackupImportCode({ kind: 'google-drive' }, 'backup')).toThrow('unsupportedProvider')
  })

  it('rejects incomplete connections and non-web endpoints', () => {
    expect(() => createRemoteBackupImportCode({ ...provider, secretAccessKey: '' }, 'backup')).toThrow()
    expect(() => createRemoteBackupImportCode({ kind: 'webdav', endpoint: 'file:///private', username: '', password: '', directory: '' }, 'backup')).toThrow()
    expect(() => createRemoteBackupImportUrl('code', 'javascript:alert(1)')).toThrow()
  })
})
