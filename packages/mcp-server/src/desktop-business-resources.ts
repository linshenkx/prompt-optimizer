import { createConnection } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { IStorageProvider } from '@prompt-optimizer/core';
import { DesktopBusinessError } from '@prompt-optimizer/core/bridge-protocol';

export const resourceOperations = ['images.list', 'images.get', 'images.save', 'images.delete', 'package.export', 'package.import'];
export async function transferResourceFile(input: Record<string, unknown>,
  transfer: (operation: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>,
): Promise<unknown> {
  if (!resourceOperations.includes(input.operation as string)) throw new DesktopBusinessError('UNKNOWN_OPERATION');
  if (['images.save', 'images.get', 'package.export', 'package.import'].includes(input.operation as string) &&
    (typeof input.file !== 'string' || !isAbsolute(input.file))) throw new DesktopBusinessError('ABSOLUTE_FILE_REQUIRED');
  if (['package.export', 'package.import'].includes(input.operation as string) && input.includeCredentials !== true) {
    throw new DesktopBusinessError('CREDENTIAL_TRANSFER_CONFIRMATION_REQUIRED');
  }
  const argumentsValue = { store: input.store, id: input.id, mimeType: input.mimeType, expectedDigest: input.expectedDigest } as Record<string, unknown>;
  if (input.operation === 'images.save' || input.operation === 'package.import') {
    if ((await stat(input.file as string)).size > 20 * 1024 * 1024) throw new DesktopBusinessError('RESOURCE_INPUT_LIMIT');
    const bytes = await readFile(input.file as string);
    if (bytes.length > 20 * 1024 * 1024) throw new DesktopBusinessError('RESOURCE_INPUT_LIMIT');
    argumentsValue.data = bytes.toString('base64');
    if (input.operation === 'images.save' && !argumentsValue.id) argumentsValue.id = `img_mcp_${createHash('sha256').update(input.requestKey as string).digest('hex').slice(0,24)}`;
  }
  const result = await transfer(input.operation as string, argumentsValue);
  if (input.operation === 'images.get' || input.operation === 'package.export') {
    const data = result.data;
    if (typeof data !== 'string') throw new DesktopBusinessError('RESOURCE_RESPONSE_INVALID');
    await writeFile(input.file as string, Buffer.from(data, 'base64'), { flag: 'wx', mode: 0o600 });
    const summary = { ...result };
    delete summary.data;
    return { ...summary, written: true };
  }
  return result;
}

export async function writeCredentialExport(input: Record<string, unknown>, getData: () => Promise<unknown>) {
  if (input.includeCredentials !== true || typeof input.destination !== 'string' || !isAbsolute(input.destination)) {
    throw new DesktopBusinessError('INVALID_INPUT');
  }
  const { data } = await getData() as { data: unknown };
  if (typeof data !== 'string') throw new DesktopBusinessError('RESOURCE_RESPONSE_INVALID');
  await writeFile(input.destination, data, { flag: 'wx', mode: 0o600 });
  return { exported: true, containsCredentials: true };
}

export async function requestDesktopResource(storage: IStorageProvider, input: Record<string, unknown>): Promise<unknown> {
  return transferResourceFile(input, (operation, args) => requestRenderer(storage, input.requestKey, operation, args));
}

async function requestRenderer(storage: IStorageProvider, requestKey: unknown, operation: string, argumentsValue: Record<string, unknown>) {
  const raw = await storage.getItem('mcp:renderer:resources');
  if (!raw) throw new DesktopBusinessError('DESKTOP_RENDERER_REQUIRED');
  const descriptor = JSON.parse(raw) as { pipe: string; token: string };
  if (typeof descriptor.pipe !== 'string' || !descriptor.pipe.startsWith(String.raw`\\.\pipe\po-desktop-resources-`) ||
    typeof descriptor.token !== 'string') throw new DesktopBusinessError('DESKTOP_RENDERER_REQUIRED');
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = createConnection(descriptor.pipe);
    socket.setEncoding('utf8');
    let buffer = '';
    const fail = () => { socket.destroy(); reject(new DesktopBusinessError('RESOURCE_RESULT_UNKNOWN')); };
    socket.setTimeout(30000, fail);
    socket.once('error', fail);
    socket.once('connect', () => socket.write(JSON.stringify({ ...descriptor, id: randomUUID(), requestKey,
      operation, arguments: argumentsValue }) + '\n'));
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (Buffer.byteLength(buffer) > 32 * 1024 * 1024) { fail(); return; }
      if (!buffer.includes('\n')) return;
      socket.destroy();
      try {
        const response = JSON.parse(buffer.trim());
        if (response.error) reject(new DesktopBusinessError(['REQUEST_KEY_REUSED', 'RESOURCE_RESULT_UNKNOWN', 'WORKSPACE_BUSY', 'IMAGE_NOT_FOUND', 'IMAGE_REVISION_CONFLICT', 'IMAGE_REFERENCED'].includes(response.error) ? response.error : 'RESOURCE_OPERATION_FAILED'));
        else resolve(response.result);
      } catch { reject(new DesktopBusinessError('RESOURCE_RESPONSE_INVALID')); }
    });
    socket.once('end', () => { if (!buffer.includes('\n')) fail(); });
  });
}
