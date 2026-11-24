import { randomUUID } from 'node:crypto';
import { isAbsolute, normalize } from 'node:path';
import {
  AssetReadError, createReadonlyAssetReader, type AssetReadPagination, type AssetReadStorage, type IReadonlyAssetReader,
} from '@prompt-optimizer/core/asset-reader';
import type { ComparisonExecutionSource } from '@prompt-optimizer/core/desktop-comparison';

export type DesktopAccess = 'read' | 'write';
export type DesktopSourceErrorCode = 'INVALID_INPUT' | 'SOURCE_NOT_FOUND' | 'SOURCE_NOT_READY' |
  'SCHEMA_UNSUPPORTED' | 'SOURCE_OPEN_FAILED' | 'SOURCE_CLOSE_FAILED' |
  'CONNECTION_CLOSED' | 'OWNER_CLOSED' | 'DESKTOP_OPENER_UNAVAILABLE' | 'UNKNOWN_TOOL' |
  'ACCESS_MISMATCH' | 'COMPARISON_ACCESS_REQUIRED' | 'WRITE_OUTCOME_UNKNOWN';

export class DesktopSourceError extends Error {
  constructor(readonly code: DesktopSourceErrorCode) {
    super(`Desktop source request failed (${code}).`);
    this.name = 'DesktopSourceError';
  }
}

export interface DesktopProfile { label: string; userDataPath: string }
export interface DesktopReadonlyLease {
  provider: AssetReadStorage & { close(): Promise<void> };
  migration: { version: number };
  product?: {
    call(name: string, args: Record<string, unknown>): Promise<unknown>;
  };
}

/** Trusted adapter only. Must open an existing migrated store with native readOnly. */
export type DesktopReadonlyOpener = (absoluteUserDataPath: string) => Promise<DesktopReadonlyLease>;

type Result<T> = T | Promise<T>;
type DesktopLease = DesktopReadonlyLease;
type DesktopOpener = (
  absoluteUserDataPath: string,
  executionSource: ComparisonExecutionSource,
) => Promise<DesktopLease>;

interface Connection {
  id: string;
  access: DesktopAccess;
  executionSource: ComparisonExecutionSource;
  active: boolean;
  reader: IReadonlyAssetReader;
  lease: DesktopLease;
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

function createDesktopRouter(
  profiles: DesktopProfile[], accessMode: DesktopAccess, opener: DesktopOpener, readonlyOpener?: DesktopOpener,
) {
  if (!profiles.length || profiles.length > 8) throw new DesktopSourceError('INVALID_INPUT');
  const paths = new Set<string>();
  const sources: Source[] = profiles.map(profile => {
    if (typeof profile.label !== 'string' || !profile.label.trim() || !isAbsolute(profile.userDataPath)) {
      throw new DesktopSourceError('INVALID_INPUT');
    }
    const path = normalize(profile.userDataPath);
    const pathKey = process.platform === 'win32' ? path.toLowerCase() : path;
    if (paths.has(pathKey)) throw new DesktopSourceError('INVALID_INPUT');
    paths.add(pathKey);
    return { id: randomUUID(), profile: { label: profile.label, userDataPath: path } };
  });
  const connections = new Map<string, Connection>();
  const leases = new Set<Connection>();
  let disposed = false;
  let disposal: Promise<void> | undefined;

  function sourceDescription(source: Source) {
    const connection = source.connection;
    return {
      sourceId: source.id, kind: 'desktop', label: source.profile.label,
      sourceEpoch: connection?.executionSource.sourceEpoch ?? 'unobserved',
      connectionGeneration: connection?.executionSource.connectionGeneration ?? 'unconnected',
      productVersion: 'unknown', contractVersion: 'po-capabilities/0.2',
      storageVersion: connection ? 'legacy-json-migration/1' : 'unknown',
      availability: connection?.active ? 'connected' : 'disconnected',
      readiness: connection?.active ? 'ready' : 'not-ready',
      ...(source.failure ? { unavailableReason: source.failure } : {}),
    };
  }
  function assertOwner() {
    if (disposed) throw new DesktopSourceError('OWNER_CLOSED');
  }
  function assertActive(connection?: Connection): asserts connection is Connection {
    if (!connection?.active || disposed) throw new DesktopSourceError('CONNECTION_CLOSED');
  }
  function requireConnection(id: string) {
    assertOwner();
    const connection = connections.get(id);
    assertActive(connection);
    return connection;
  }
  async function releaseLease(lease: DesktopLease, pending: ReadonlySet<Promise<unknown>> = new Set()) {
    await Promise.allSettled([...pending]);
    await lease.provider.close();
  }
  function closeConnection(connection: Connection): Promise<void> {
    if (connection.closePromise) return connection.closePromise;
    connection.active = false;
    connections.delete(connection.id);
    const source = sources.find(source => source.connection === connection);
    // Keep the source reserved until native close finishes.
    connection.closePromise = (async () => {
      try {
        await releaseLease(connection.lease, connection.pending);
      } catch {
        if (source) source.failure = 'SOURCE_CLOSE_FAILED';
        throw new DesktopSourceError('SOURCE_CLOSE_FAILED');
      } finally {
        leases.delete(connection);
        if (source) source.connection = undefined;
      }
    })();
    return connection.closePromise;
  }
  async function openSource(source: Source, access: DesktopAccess): Promise<Connection> {
    let lease: DesktopLease | undefined;
    try {
      const executionSource: ComparisonExecutionSource = {
        kind: 'desktop',
        sourceId: source.id,
        label: source.profile.label,
        sourceEpoch: `lease:${randomUUID()}`,
        connectionGeneration: randomUUID(),
      };
      lease = access === 'read' && readonlyOpener
        ? await readonlyOpener(source.profile.userDataPath, executionSource)
        : await opener(source.profile.userDataPath, executionSource);
      if (lease.migration.version !== 1) throw new DesktopSourceError('SCHEMA_UNSUPPORTED');
      assertOwner();
      const connection: Connection = {
        id: randomUUID(),
        access,
        executionSource,
        active: true,
        lease,
        pending: new Set(),
        reader: createReadonlyAssetReader(lease.provider, executionSource),
      };
      source.connection = connection;
      source.failure = undefined;
      connections.set(connection.id, connection);
      leases.add(connection);
      return connection;
    } catch (error) {
      if (lease) {
        try { await releaseLease(lease); }
        catch { source.failure = 'SOURCE_CLOSE_FAILED'; throw new DesktopSourceError('SOURCE_CLOSE_FAILED'); }
      }
      const safe = error instanceof DesktopSourceError ? error : new DesktopSourceError('SOURCE_OPEN_FAILED');
      source.failure = safe.code;
      throw safe;
    }
  }
  async function useConnection<T>(id: string, action: (connection: Connection) => Result<T>): Promise<T> {
    const connection = requireConnection(id);
    const work = Promise.resolve().then(() => {
      assertActive(connection);
      return action(connection);
    });
    connection.pending.add(work);
    try {
      const result = await work;
      assertActive(connection);
      return result;
    } catch (error) {
      if (!connection.active || disposed) throw new DesktopSourceError('CONNECTION_CLOSED');
      throw error;
    } finally {
      connection.pending.delete(work);
    }
  }
  return {
    getSourceProfile(sourceId: string) {
      assertOwner();
      return sources.find(source => source.id === sourceId)?.profile;
    },
    listSources() {
      assertOwner();
      return { sources: sources.map(sourceDescription), identity };
    },
    async open(sourceId: string, access: string) {
      assertOwner();
      if (access !== accessMode && (access !== 'read' || !readonlyOpener)) throw new DesktopSourceError('INVALID_INPUT');
      const source = sources.find(source => source.id === sourceId);
      if (!source) throw new DesktopSourceError('SOURCE_NOT_FOUND');
      if (source.failure === 'SOURCE_CLOSE_FAILED') throw new DesktopSourceError('SOURCE_CLOSE_FAILED');
      if (source.connection?.closePromise) await source.connection.closePromise;
      assertOwner();
      if (!source.connection) {
        source.opening ??= openSource(source, access);
        try { await source.opening; } finally { source.opening = undefined; }
      }
      const connection = source.connection;
      assertActive(connection);
      if (connection.access !== access) throw new DesktopSourceError('ACCESS_MISMATCH');
      return {
        connectionId: connection.id, source: sourceDescription(source), schemaVersion: 'prompt-model/v1', identity,
        capabilities: { read: true, execute: access !== 'read', save: access !== 'read' },
      };
    },
    async close(connectionId: string) {
      await closeConnection(requireConnection(connectionId));
      return { closed: true };
    },
    listModels(id: string, options: AssetReadPagination) {
      return useConnection(id, ({ reader }) => reader.listModels(options));
    },
    listAssets(id: string, options: Parameters<IReadonlyAssetReader['listAssets']>[0]) {
      return useConnection(id, ({ reader }) => reader.listAssets(options));
    },
    listAssetVersions(id: string, selection: Parameters<IReadonlyAssetReader['listAssetVersions']>[0], options: AssetReadPagination) {
      return useConnection(id, ({ reader }) => reader.listAssetVersions(selection, options));
    },
    getAssetVersion(id: string, selection: Parameters<IReadonlyAssetReader['getAssetVersion']>[0]) {
      return useConnection(id, ({ reader }) => reader.getAssetVersion(selection));
    },
    callReadonlyBusiness(id: string, name: string, args: Record<string, unknown>) {
      return useConnection(id, ({ lease }) => {
        if (!lease.product) throw new DesktopSourceError('INVALID_INPUT');
        return lease.product.call(name, args);
      });
    },
    dispose(): Promise<void> {
      if (disposal) return disposal;
      disposed = true;
      disposal = (async () => {
        const active = Promise.allSettled([...leases].map(closeConnection));
        const [, results] = await Promise.all([Promise.allSettled(sources.map(source => source.opening)), active]);
        if (results.some(result => result.status === 'rejected') || sources.some(source => source.failure === 'SOURCE_CLOSE_FAILED')) {
          throw new DesktopSourceError('SOURCE_CLOSE_FAILED');
        }
      })();
      return disposal;
    },
  };
}

export function createDesktopReadonlyRouter(profiles: DesktopProfile[], opener: DesktopReadonlyOpener = noOpener) {
  return createDesktopRouter(profiles, 'read', path => opener(path));
}

export function createDesktopProductRouter(profiles: DesktopProfile[], opener: DesktopOpener, readonlyOpener: DesktopOpener) {
  return createDesktopRouter(profiles, 'write', opener, readonlyOpener);
}

export function publicDesktopError(error: unknown) {
  const code = error instanceof DesktopSourceError || error instanceof AssetReadError ? error.code : 'SOURCE_READ_FAILED';
  return { code, message: `Desktop readonly request failed (${code}).` };
}
