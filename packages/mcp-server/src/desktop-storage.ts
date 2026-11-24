import { DesktopSourceError, type DesktopComparisonOpener, type DesktopReadonlyOpener } from './desktop-router.js';

/** Imported only after desktop selection; SQLite itself loads only on sources.open. */
export const openReadonlyDesktop = (async absoluteUserDataPath => {
  try {
    const { openExistingDesktopStorage } = await import('@prompt-optimizer/core/node');
    const lease = await openExistingDesktopStorage(absoluteUserDataPath);
    if (!lease.provider.readOnly) {
      await lease.provider.close();
      throw new DesktopSourceError('SOURCE_NOT_READY');
    }
    return lease;
  } catch {
    // Missing, unmigrated, incompatible and unreadable stores remain unopened.
    throw new DesktopSourceError('SOURCE_NOT_READY');
  }
}) satisfies DesktopReadonlyOpener;

export const openComparisonDesktop: DesktopComparisonOpener = async (absoluteUserDataPath, executionSource) => {
  let lease: import('@prompt-optimizer/core/node').ExistingSQLiteStorage | undefined;
  try {
    const { openExistingDesktopStorageForWriting } = await import('@prompt-optimizer/core/node');
    lease = await openExistingDesktopStorageForWriting(absoluteUserDataPath);
    if (lease.provider.readOnly) throw new DesktopSourceError('SOURCE_NOT_READY');

    // Leave the product service graph out of desktop-readonly and source discovery.
    const core = await import('@prompt-optimizer/core/desktop-comparison');
    const runner = core.createTextComparisonService({ storage: lease.provider, executionSource });
    return {
      ...lease,
      comparison: {
        runner,
        repository: core.createComparisonRepository(lease.provider),
        errorCode(error) {
          // Match the error class bundled with the comparison runner.
          return error instanceof core.TextComparisonError || error instanceof core.ComparisonRepositoryError ||
            error instanceof core.AssetReadError ? error.code : undefined;
        },
      },
    };
  } catch (error) {
    if (lease) {
      try { await lease.provider.close(); }
      catch { throw new DesktopSourceError('SOURCE_CLOSE_FAILED'); }
    }
    if (error instanceof DesktopSourceError) throw error;
    // Paths, credentials and native/SDK errors must never be serialized.
    throw new DesktopSourceError('SOURCE_NOT_READY');
  }
};
