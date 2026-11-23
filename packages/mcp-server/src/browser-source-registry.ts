import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface BrowserRegistration {
  origin: string;
  browser: string;
  browserContextId: string;
  label: string;
  productUrl: string;
}

export function browserSourceId({ origin, browser, browserContextId }: BrowserRegistration): string {
  const identity = JSON.stringify([origin, browser, browserContextId]);
  return 'browser-' + createHash('sha256').update(identity).digest('hex');
}

export function parseProductUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) return url;
  } catch { return; }
}

function parseRegistration(value: Partial<BrowserRegistration>): BrowserRegistration | undefined {
  if (!value || typeof value.productUrl !== 'string' || typeof value.browserContextId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(value.browserContextId)) return;
  const { origin, browser, browserContextId, label, productUrl } = value;
  if (typeof browser !== 'string' || !browser || browser.length > 100 ||
    typeof label !== 'string' || !label || label.length > 100 || !origin || parseProductUrl(productUrl)?.origin !== origin) return;
  return { origin, browser, browserContextId, label, productUrl };
}

export function createBrowserRegistry(directory: string) {
  let writeFailed = false;
  return {
    async remember(entry: BrowserRegistration) {
      const path = join(directory, browserSourceId(entry) + '.json');
      const temporary = path + '.' + randomUUID() + '.tmp';
      try {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(temporary, JSON.stringify(entry), { flag: 'wx', mode: 0o600 });
        await rename(temporary, path);
        writeFailed = false;
      } catch {
        writeFailed = true;
        await unlink(temporary).catch(() => undefined);
      }
    },
    async list() {
      try {
        const files = await readdir(directory, { withFileTypes: true });
        const sources: BrowserRegistration[] = [];
        for (const file of files) {
          if (!file.isFile() || !/^browser-[a-f0-9]{64}\.json$/.test(file.name)) continue;
          const path = join(directory, file.name);
          try {
            if ((await lstat(path)).size > 32_768) continue;
            const entry = parseRegistration(JSON.parse(await readFile(path, 'utf8')));
            if (entry && browserSourceId(entry) + '.json' === file.name) sources.push(entry);
          } catch { /* A damaged entry should not hide the other sources. */ }
        }
        return { sources, browserRegistryAvailable: !writeFailed };
      } catch (error) {
        return { sources: [], browserRegistryAvailable: !writeFailed && (error as NodeJS.ErrnoException).code === 'ENOENT' };
      }
    },
  };
}
