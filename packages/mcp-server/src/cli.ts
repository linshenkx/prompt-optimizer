import { isAbsolute } from 'node:path';
import { DesktopSourceError } from './desktop-router.js';
import type { DesktopProfile } from './desktop-router.js';

export type LaunchSelection = { mode: 'legacy' } | { mode: 'desktop-readonly'; profiles: DesktopProfile[] };
export function selectLaunchMode(args: string[]): LaunchSelection {
  const modes = args.filter(arg => arg.startsWith('--mode='));
  if (modes.length > 1) throw new DesktopSourceError('INVALID_INPUT');
  const mode = modes[0]?.slice('--mode='.length) ?? 'legacy';
  const paths = args.filter(arg => arg.startsWith('--desktop-profile='));
  if (mode === 'legacy') {
    if (paths.length || args.includes('--desktop-profile')) throw new DesktopSourceError('INVALID_INPUT');
    return { mode };
  }
  if (mode !== 'desktop-readonly' || args.some(arg => !arg.startsWith('--desktop-profile=') && arg !== '--mode=desktop-readonly' && arg !== '--transport=stdio')) throw new DesktopSourceError('INVALID_INPUT');
  if (paths.length < 1 || paths.length > 8 || args.filter(arg => arg.startsWith('--transport=')).length > 1) throw new DesktopSourceError('INVALID_INPUT');
  const profiles = paths.map((arg, index) => {
    const userDataPath = arg.slice('--desktop-profile='.length);
    if (!isAbsolute(userDataPath)) throw new DesktopSourceError('INVALID_INPUT');
    return { label: `Desktop profile ${index + 1}`, userDataPath };
  });
  return { mode, profiles };
}
