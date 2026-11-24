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
  if (selection.mode === 'product') {
    // Product service diagnostics can include provider error bodies or configuration.
    // The stdio host reports sanitized operation errors through its protocol.
    console.log = console.info = console.debug = console.warn = console.error = () => {};
    const { startProductStdio } = await import('./product.js');
    return startProductStdio(selection.profiles, selection.productUrl);
  }
  if (selection.mode === 'desktop-readonly') {
    const start = dependencies.desktopMain ?? (await import('./desktop.js')).startDesktopReadonlyStdio;
    const opener = dependencies.openDesktop ?? (await import('./desktop-storage.js')).openReadonlyDesktop;
    return start(selection.profiles, opener);
  }
  if (dependencies.legacyMain) return dependencies.legacyMain();
  if ((args.find(arg => arg.startsWith('--transport='))?.slice('--transport='.length) ?? 'stdio') === 'stdio') {
    // dotenv, core defaults and legacy config log during import. Reserve stdout
    // for SDK JSON-RPC before any of those modules can initialize.
    console.log = console.error.bind(console);
    console.info = console.error.bind(console);
    console.debug = console.error.bind(console);
  }
  // Preserve legacy env search, but only after explicit/default legacy selection.
  const preloadPath = '../preload-env.cjs';
  await import(preloadPath);
  // Keep the legacy runtime in ESM even when the CLI wrapper is CJS. Its dynamic
  // core imports must use the same module graph as its static core imports.
  const legacyPath = './legacy.js';
  return (await import(legacyPath)).main();
}
