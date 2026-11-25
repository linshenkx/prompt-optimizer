import { isAbsolute } from 'node:path';
import { DesktopSourceError, type DesktopProfile } from './desktop-router.js';

export function parseProductOptions(args: string[]) {
  const profiles: DesktopProfile[] = [];
  let productUrl: string | undefined;
  let explicitStdio = false;
  for (const arg of args) {
    if (arg.startsWith('--desktop-profile=')) {
      const userDataPath = arg.slice('--desktop-profile='.length);
      if (!isAbsolute(userDataPath) || profiles.length >= 8) throw new DesktopSourceError('INVALID_INPUT');
      profiles.push({ label: 'Desktop profile ' + (profiles.length + 1), userDataPath });
    } else if (arg.startsWith('--product-url=') && productUrl === undefined) {
      const url = URL.parse(arg.slice('--product-url='.length));
      if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new DesktopSourceError('INVALID_INPUT');
      }
      productUrl = url.href;
    } else if (arg === '--transport=stdio' && !explicitStdio) {
      explicitStdio = true;
    } else {
      throw new DesktopSourceError('INVALID_INPUT');
    }
  }
  return { profiles, productUrl };
}
