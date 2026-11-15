import { randomUUID } from 'node:crypto';
import { isAbsolute, normalize } from 'node:path';
import { AssetReadError, createReadonlyAssetReader } from '@prompt-optimizer/core/asset-reader';
import type { AssetReadStorage, IReadonlyAssetReader } from '@prompt-optimizer/core/asset-reader';

export type DesktopSourceErrorCode = 'INVALID_INPUT' | 'SOURCE_NOT_FOUND' | 'SOURCE_NOT_READY' |
  'SCHEMA_UNSUPPORTED' | 'SOURCE_OPEN_FAILED' | 'SOURCE_CLOSE_FAILED' | 'CONNECTION_CLOSED' |
  'OWNER_CLOSED' | 'DESKTOP_OPENER_UNAVAILABLE' | 'UNKNOWN_TOOL';
export class DesktopSourceError extends Error {
  readonly code: DesktopSourceErrorCode;
  constructor(code: DesktopSourceErrorCode) { super(`Desktop readonly access failed (${code}).`); this.name = 'DesktopSourceError'; this.code = code; }
}
export interface DesktopProfile { label: string; userDataPath: string }
export interface DesktopReadonlyLease {
  provider: AssetReadStorage & { close(): Promise<void> };
  migration: { version: number };
}
/** Trusted adapter only. Must open an existing migrated store with native readOnly. */
export type DesktopReadonlyOpener = (absoluteUserDataPath: string) => Promise<DesktopReadonlyLease>;

interface Connection {
  id: string;
  generation: string;
  epoch: string;
  active: boolean;
  reader: IReadonlyAssetReader;
  lease: DesktopReadonlyLease;
  pending: Set<Promise<unknown>>;
  closePromise?: Promise<void>;
}
interface Source {
  id: string;
  profile: DesktopProfile;
  connection?: Connection;
  opening?: Promise<Connection>;
  failure?: DesktopSourceErrorCode;
}
const identity = { scope: 'mcp-process', sourceEpoch: 'open-lease', inPlaceReplacementDetection: false, stableAcrossRestart: false };
const noOpener: DesktopReadonlyOpener = async () => { throw new DesktopSourceError('DESKTOP_OPENER_UNAVAILABLE'); };

export function createDesktopReadonlyRouter(profiles: DesktopProfile[], opener: DesktopReadonlyOpener = noOpener) {
  if (!profiles.length || profiles.length > 8) throw new DesktopSourceError('INVALID_INPUT');
  const paths = new Set<string>();
  const sources: Source[] = profiles.map(profile => {
    if (typeof profile.label !== 'string' || !profile.label.trim() || !isAbsolute(profile.userDataPath)) throw new DesktopSourceError('INVALID_INPUT');
    const path = normalize(profile.userDataPath);
    const pathKey = process.platform === 'win32' ? path.toLowerCase() : path;
    if (paths.has(pathKey)) throw new DesktopSourceError('INVALID_INPUT');
    paths.add(pathKey);
    return { id: randomUUID(), profile: { label: profile.label, userDataPath: path } };
  });
  const connections = new Map<string, Connection>();
  let disposed = false;
  let disposal: Promise<void> | undefined;
  function sourceDescription(source: Source) {
    const connection = source.connection;
    return { sourceId: source.id, kind: 'desktop', label: source.profile.label,
      sourceEpoch: connection?.epoch ?? 'unobserved', connectionGeneration: connection?.generation ?? 'unconnected',
      productVersion: 'unknown', contractVersion: 'po-capabilities/0.2',
      storageVersion: connection ? 'legacy-json-migration/1' : 'unknown',
      availability: connection?.active ? 'connected' : 'disconnected', readiness: connection?.active ? 'ready' : 'not-ready',
      ...(source.failure ? { unavailableReason: source.failure } : {}) };
  }
  function assertOwner() { if (disposed) throw new DesktopSourceError('OWNER_CLOSED'); }
  function requireConnection(id: string) {
    assertOwner();
    const connection = connections.get(id);
    if (!connection?.active) throw new DesktopSourceError('CONNECTION_CLOSED');
    return connection;
  }
  function closeConnection(connection: Connection): Promise<void> {
    if (connection.closePromise) return connection.closePromise;
    connection.active = false;
    connections.delete(connection.id);
    const source = sources.find(source => source.connection === connection);
    // Keep the source reserved until native close finishes; do not reopen into a closing lease.
    connection.closePromise = (async () => {
      await Promise.allSettled([...connection.pending]);
      try { await connection.lease.provider.close(); }
      catch { if (source) source.failure = 'SOURCE_CLOSE_FAILED'; throw new DesktopSourceError('SOURCE_CLOSE_FAILED'); }
      finally { if (source) source.connection = undefined; }
    })();
    return connection.closePromise;
  }
  async function openSource(source: Source): Promise<Connection> {
    let lease: DesktopReadonlyLease | undefined;
    try {
      lease = await opener(source.profile.userDataPath);
      if (lease.migration.version !== 1) throw new DesktopSourceError('SCHEMA_UNSUPPORTED');
      assertOwner();
      const epoch = `lease:${randomUUID()}`;
      const connection: Connection = { id: randomUUID(), generation: randomUUID(), epoch, active: true,
        lease, pending: new Set(), reader: createReadonlyAssetReader(lease.provider, { sourceId: source.id, sourceEpoch: epoch }) };
      source.connection = connection;
      source.failure = undefined;
      connections.set(connection.id, connection);
      return connection;
    } catch (error) {
      if (lease) { try { await lease.provider.close(); } catch { /* No raw close error leaves the boundary. */ } }
      const safe = error instanceof DesktopSourceError ? error : new DesktopSourceError('SOURCE_OPEN_FAILED');
      source.failure = safe.code;
      throw safe;
    }
  }
  async function read<T>(id: string, action: (reader: IReadonlyAssetReader) => Promise<T>): Promise<T> {
    const connection = requireConnection(id);
    const work = Promise.resolve().then(() => action(connection.reader));
    connection.pending.add(work);
    try {
      const result = await work;
      if (!connection.active || disposed) throw new DesktopSourceError('CONNECTION_CLOSED');
      return result;
    } finally { connection.pending.delete(work); }
  }
  return {
    listSources() { assertOwner(); return { sources: sources.map(sourceDescription), identity }; },
    async open(sourceId: string, access: string) {
      assertOwner();
      if (access !== 'read') throw new DesktopSourceError('INVALID_INPUT');
      const source = sources.find(source => source.id === sourceId);
      if (!source) throw new DesktopSourceError('SOURCE_NOT_FOUND');
      if (source.failure === 'SOURCE_CLOSE_FAILED') throw new DesktopSourceError('SOURCE_CLOSE_FAILED');
      if (source.connection?.closePromise) await source.connection.closePromise;
      if (!source.connection) {
        source.opening ??= openSource(source);
        try { await source.opening; } finally { source.opening = undefined; }
      }
      const connection = source.connection;
      if (!connection?.active || disposed) throw new DesktopSourceError('CONNECTION_CLOSED');
      return { connectionId: connection.id, source: sourceDescription(source), identity,
        capabilities: { read: true, execute: false, save: false } };
    },
    async close(connectionId: string) { await closeConnection(requireConnection(connectionId)); return { closed: true }; },
    listModels(id: string, options: Parameters<IReadonlyAssetReader['listModels']>[0]) { return read(id, reader => reader.listModels(options)); },
    listAssets(id: string, options: Parameters<IReadonlyAssetReader['listAssets']>[0]) { return read(id, reader => reader.listAssets(options)); },
    getAssetVersion(id: string, selection: Parameters<IReadonlyAssetReader['getAssetVersion']>[0]) { return read(id, reader => reader.getAssetVersion(selection)); },
    dispose(): Promise<void> {
      if (disposal) return disposal;
      disposed = true;
      disposal = (async () => {
        await Promise.allSettled(sources.map(source => source.opening));
        const results = await Promise.allSettled([...connections.values()].map(closeConnection));
        if (results.some(result => result.status === 'rejected')) throw new DesktopSourceError('SOURCE_CLOSE_FAILED');
      })();
      return disposal;
    },
  };
}

export function publicDesktopError(error: unknown) {
  const code = error instanceof DesktopSourceError || error instanceof AssetReadError ? error.code : 'SOURCE_READ_FAILED';
  return { code, message: `Desktop readonly request failed (${code}).` };
}
