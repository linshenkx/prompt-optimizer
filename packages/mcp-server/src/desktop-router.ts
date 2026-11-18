import { randomUUID } from 'node:crypto';
import { isAbsolute, normalize } from 'node:path';
import {
  AssetReadError, createReadonlyAssetReader, type AssetReadPagination, type AssetReadStorage, type IReadonlyAssetReader,
} from '@prompt-optimizer/core/asset-reader';
import type {
  ComparisonExecutionSource, ComparisonListOptions, createComparisonRepository, createTextComparisonService, PrepareTextComparison,
} from '@prompt-optimizer/core/desktop-comparison';

export type DesktopAccess = 'read' | 'compare';
export type DesktopSourceErrorCode = 'INVALID_INPUT' | 'SOURCE_NOT_FOUND' | 'SOURCE_NOT_READY' |
  'SOURCE_DATA_DIVERGED' | 'SCHEMA_UNSUPPORTED' | 'SOURCE_OPEN_FAILED' | 'SOURCE_CLOSE_FAILED' |
  'CONNECTION_CLOSED' | 'OWNER_CLOSED' | 'DESKTOP_OPENER_UNAVAILABLE' | 'UNKNOWN_TOOL' |
  'COMPARISON_ACCESS_REQUIRED' | 'WRITE_OUTCOME_UNKNOWN';

export class DesktopSourceError extends Error {
  constructor(readonly code: DesktopSourceErrorCode) {
    super(`Desktop source request failed (${code}).`);
    this.name = 'DesktopSourceError';
  }
}

class DesktopComparisonRequestError extends Error {
  constructor(readonly code: string) {
    super(`Desktop comparison request failed (${code}).`);
    this.name = 'DesktopComparisonRequestError';
  }
}

export interface DesktopProfile { label: string; userDataPath: string }
export interface DesktopReadonlyLease {
  provider: AssetReadStorage & { close(): Promise<void> };
  migration: { version: number };
}

/** Trusted adapter only. Must open an existing migrated store with native readOnly. */
export type DesktopReadonlyOpener = (absoluteUserDataPath: string) => Promise<DesktopReadonlyLease>;

type Result<T> = T | Promise<T>;
type BeginWrite = () => void;
interface DesktopComparisonSession {
  runner: ReturnType<typeof createTextComparisonService>;
  repository: Pick<ReturnType<typeof createComparisonRepository>, 'save' | 'list' | 'get' | 'delete'>;
  errorCode(error: unknown): string | undefined;
}

export interface DesktopComparisonLease extends DesktopReadonlyLease {
  comparison: DesktopComparisonSession;
}

/** Trusted adapter only. Open an existing migrated store and attach its scoped business services. */
export type DesktopComparisonOpener = (
  absoluteUserDataPath: string,
  executionSource: ComparisonExecutionSource,
) => Promise<DesktopComparisonLease>;

type DesktopLease = DesktopReadonlyLease & { comparison?: DesktopComparisonSession };
type DesktopOpener = (
  absoluteUserDataPath: string,
  executionSource: ComparisonExecutionSource,
) => Promise<DesktopLease>;

interface Connection {
  id: string;
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

function createDesktopRouter(profiles: DesktopProfile[], accessMode: DesktopAccess, opener: DesktopOpener) {
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
    try {
      // Active model work belongs to the runner. Abort it before draining storage requests.
      await lease.comparison?.runner.dispose();
    } finally {
      await Promise.allSettled([...pending]);
      await lease.provider.close();
    }
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
  async function openSource(source: Source): Promise<Connection> {
    let lease: DesktopLease | undefined;
    try {
      const executionSource: ComparisonExecutionSource = {
        kind: 'desktop',
        sourceId: source.id,
        label: source.profile.label,
        sourceEpoch: `lease:${randomUUID()}`,
        connectionGeneration: randomUUID(),
      };
      lease = await opener(source.profile.userDataPath, executionSource);
      if (lease.migration.version !== 1) throw new DesktopSourceError('SCHEMA_UNSUPPORTED');
      if ((accessMode === 'compare') !== Boolean(lease.comparison)) throw new DesktopSourceError('SOURCE_NOT_READY');
      assertOwner();
      const connection: Connection = {
        id: randomUUID(),
        executionSource,
        active: true,
        lease,
        pending: new Set(),
        reader: lease.comparison?.runner.reader ?? createReadonlyAssetReader(lease.provider, executionSource),
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
  async function useConnection<T>(id: string, action: (connection: Connection, beginWrite: BeginWrite) => Result<T>): Promise<T> {
    const connection = requireConnection(id);
    let writeStarted = false;
    const beginWrite = () => {
      assertActive(connection);
      writeStarted = true;
    };
    const work = Promise.resolve().then(() => {
      assertActive(connection);
      return action(connection, beginWrite);
    });
    connection.pending.add(work);
    try {
      const result = await work;
      assertActive(connection);
      return result;
    } catch (error) {
      if (!connection.active || disposed) {
        // A repository operation may have committed while this lease was closing.
        throw new DesktopSourceError(writeStarted ? 'WRITE_OUTCOME_UNKNOWN' : 'CONNECTION_CLOSED');
      }
      const code = connection.lease.comparison?.errorCode(error);
      if (code && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)) throw new DesktopComparisonRequestError(code);
      throw error;
    } finally {
      connection.pending.delete(work);
    }
  }
  function withComparison<T>(
    id: string,
    action: (session: DesktopComparisonSession, connection: Connection, beginWrite: BeginWrite) => Result<T>,
  ): Promise<T> {
    return useConnection(id, (connection, beginWrite) => {
      const session = connection.lease.comparison;
      if (!session) throw new DesktopSourceError('COMPARISON_ACCESS_REQUIRED');
      return action(session, connection, beginWrite);
    });
  }

  return {
    listSources() {
      assertOwner();
      return { sources: sources.map(sourceDescription), identity };
    },
    async open(sourceId: string, access: string) {
      assertOwner();
      if (access !== accessMode) throw new DesktopSourceError('INVALID_INPUT');
      const source = sources.find(source => source.id === sourceId);
      if (!source) throw new DesktopSourceError('SOURCE_NOT_FOUND');
      if (source.failure === 'SOURCE_CLOSE_FAILED') throw new DesktopSourceError('SOURCE_CLOSE_FAILED');
      if (source.connection?.closePromise) await source.connection.closePromise;
      assertOwner();
      if (!source.connection) {
        source.opening ??= openSource(source);
        try { await source.opening; } finally { source.opening = undefined; }
      }
      const connection = source.connection;
      assertActive(connection);
      return {
        connectionId: connection.id, source: sourceDescription(source), schemaVersion: 'prompt-model/v1', identity,
        capabilities: { read: true, execute: accessMode === 'compare', save: accessMode === 'compare' },
      };
    },
    async close(connectionId: string) {
      await closeConnection(requireConnection(connectionId));
      return { closed: true };
    },
    listModels(id: string, options: AssetReadPagination) {
      return useConnection(id, async ({ reader, lease }) => lease.comparison
        ? lease.comparison.runner.listModels(options)
        : reader.listModels(options));
    },
    listAssets(id: string, options: Parameters<IReadonlyAssetReader['listAssets']>[0]) {
      return useConnection(id, ({ reader }) => reader.listAssets(options));
    },
    getAssetVersion(id: string, selection: Parameters<IReadonlyAssetReader['getAssetVersion']>[0]) {
      return useConnection(id, ({ reader }) => reader.getAssetVersion(selection));
    },
    prepare(id: string, input: PrepareTextComparison) {
      return withComparison(id, ({ runner }) => runner.prepare(input));
    },
    execute(id: string, preparedId: string, previewRevision: string) {
      return withComparison(id, ({ runner }) => runner.execute(preparedId, previewRevision));
    },
    getTest(id: string, preparedId: string) {
      return withComparison(id, ({ runner }) => runner.get(preparedId));
    },
    cancel(id: string, preparedId: string, runId?: string) {
      return withComparison(id, ({ runner }) => runner.cancel(preparedId, runId));
    },
    saveComparison(id: string, preparedId: string, saveKey: string) {
      return withComparison(id, async ({ runner, repository }, connection, beginWrite) => {
        const comparison = await runner.completed(preparedId);
        beginWrite();
        const saved = await repository.save(comparison, saveKey);
        const comparisonId = saved.comparison.id;
        return {
          saved: true, comparisonId, revision: saved.revision,
          viewTarget: { kind: 'saved-comparison', sourceId: connection.executionSource.sourceId, comparisonId },
          visibility: 'reload-required',
        };
      });
    },
    listComparisons(id: string, options: ComparisonListOptions) {
      return withComparison(id, ({ repository }) => repository.list(options));
    },
    getComparison(id: string, comparisonId: string) {
      return withComparison(id, ({ repository }) => repository.get(comparisonId));
    },
    deleteComparison(id: string, comparisonId: string, expectedRevision: string) {
      return withComparison(id, ({ repository }, _connection, beginWrite) => {
        beginWrite();
        return repository.delete(comparisonId, expectedRevision);
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

export function createDesktopComparisonRouter(profiles: DesktopProfile[], opener: DesktopComparisonOpener) {
  return createDesktopRouter(profiles, 'compare', opener);
}

export function publicDesktopError(error: unknown, access: DesktopAccess = 'read') {
  const code = error instanceof DesktopSourceError || error instanceof AssetReadError || error instanceof DesktopComparisonRequestError
    ? error.code
    : access === 'compare' ? 'COMPARISON_REQUEST_FAILED' : 'SOURCE_READ_FAILED';
  const scope = access === 'compare' ? 'comparison' : 'readonly';
  return { code, message: `Desktop ${scope} request failed (${code}).` };
}
