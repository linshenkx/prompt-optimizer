import { DesktopSourceError, type DesktopReadonlyOpener } from './desktop-router.js';

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
