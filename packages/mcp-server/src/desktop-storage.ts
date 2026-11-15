import { DesktopSourceError } from './desktop-router.js';
import type { DesktopReadonlyOpener } from './desktop-router.js';

/** Imported only after desktop selection; SQLite itself loads only on sources.open. */
export const openReadonlyDesktop: DesktopReadonlyOpener = async absoluteUserDataPath => {
  try {
    const { openExistingDesktopStorage } = await import('@prompt-optimizer/core/node');
    const lease = await openExistingDesktopStorage(absoluteUserDataPath);
    if (!lease.provider.readOnly) {
      await lease.provider.close();
      throw new DesktopSourceError('SOURCE_NOT_READY');
    }
    return lease;
  } catch {
    // The store may be absent, not migrated, incompatible or unreadable. Never
    // expose its native exception/path and never bootstrap, repair or fall back.
    throw new DesktopSourceError('SOURCE_NOT_READY');
  }
};
