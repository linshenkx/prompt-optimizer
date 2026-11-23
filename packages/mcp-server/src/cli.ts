import { isAbsolute } from 'node:path';
import { DesktopSourceError, type DesktopProfile } from './desktop-router.js';

export type LaunchSelection = { mode: 'product'; profiles: DesktopProfile[]; productUrl?: string } | { mode: 'legacy' } | { mode: 'browser' } | { mode: 'desktop-readonly' | 'desktop-comparison' | 'desktop'; profiles: DesktopProfile[] };
export function selectLaunchMode(args: string[]): LaunchSelection {
  if (args.includes('--mode')) throw new DesktopSourceError('INVALID_INPUT');
  const modes = args.filter(arg => arg.startsWith('--mode='));
  if (modes.length > 1) throw new DesktopSourceError('INVALID_INPUT');
  const mode = modes[0]?.slice('--mode='.length) ?? 'legacy';
  const paths = args.filter(arg => arg.startsWith('--desktop-profile='));
  if (mode === 'product') {
    const urls = args.filter(arg => arg.startsWith('--product-url='));
    if (paths.length > 8 || urls.length > 1 || args.filter(arg => arg.startsWith('--transport=')).length > 1 ||
      args.some(arg => !paths.includes(arg) && !urls.includes(arg) && arg !== modes[0] && arg !== '--transport=stdio')) {
      throw new DesktopSourceError('INVALID_INPUT');
    }
    let productUrl: string | undefined;
    if (urls.length) {
      let url: URL;
      try { url = new URL(urls[0].slice('--product-url='.length)); }
      catch { throw new DesktopSourceError('INVALID_INPUT'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new DesktopSourceError('INVALID_INPUT');
      }
      productUrl = url.href;
    }
    return { mode, profiles: parseProfiles(paths), productUrl };
  }
  if (mode === 'browser') {
    if (args.some(arg => arg !== '--mode=browser' && arg !== '--transport=stdio') || args.filter(arg => arg.startsWith('--transport=')).length > 1) throw new DesktopSourceError('INVALID_INPUT');
    return { mode };
  }
  if (mode === 'legacy') {
    if (args.some(arg => arg.startsWith('--desktop-'))) throw new DesktopSourceError('INVALID_INPUT');
    return { mode };
  }
  if (mode !== 'desktop-readonly' && mode !== 'desktop-comparison' && mode !== 'desktop') throw new DesktopSourceError('INVALID_INPUT');
  if (args.some(arg => !arg.startsWith('--desktop-profile=') && arg !== modes[0] && arg !== '--transport=stdio')) {
    throw new DesktopSourceError('INVALID_INPUT');
  }
  if (paths.length < 1 || paths.length > 8 || args.filter(arg => arg.startsWith('--transport=')).length > 1) throw new DesktopSourceError('INVALID_INPUT');
  return { mode, profiles: parseProfiles(paths) };
}

function parseProfiles(paths: string[]): DesktopProfile[] {
  return paths.map((arg, index) => {
    const userDataPath = arg.slice('--desktop-profile='.length);
    if (!isAbsolute(userDataPath)) throw new DesktopSourceError('INVALID_INPUT');
    return { label: 'Desktop profile ' + (index + 1), userDataPath };
  });
}
