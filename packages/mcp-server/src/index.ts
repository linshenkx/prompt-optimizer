// Select before importing legacy: its modules load dotenv and default models.
import { selectLaunchMode } from './cli.js';
import type { DesktopProfile, DesktopReadonlyOpener } from './desktop-router.js';

export interface LaunchDependencies {
  openDesktop?: DesktopReadonlyOpener;
  legacyMain?: () => Promise<void>;
  desktopMain?: (profiles: DesktopProfile[], opener?: DesktopReadonlyOpener) => Promise<unknown>;
}
export async function main(args = process.argv.slice(2), dependencies: LaunchDependencies = {}) {
  const selection = selectLaunchMode(args);
  if (selection.mode === 'desktop-readonly') {
    const start = dependencies.desktopMain ?? (await import('./desktop.js')).startDesktopReadonlyStdio;
    return start(selection.profiles, dependencies.openDesktop);
  }
  if (dependencies.legacyMain) return dependencies.legacyMain();
  // Preserve legacy env search, but only after explicit/default legacy selection.
  const preloadPath = '../preload-env.cjs';
  await import(preloadPath);
  return (await import('./legacy.js')).main();
}
