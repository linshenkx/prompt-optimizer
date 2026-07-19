const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');

const REMOTE_STORAGE_CHANNEL = 'remote-storage:invoke';
const JSON_MIME_TYPE = 'application/json';
const CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX = 'prompt-optimizer-backups/';
let webDavModulePromise = null;

const decodeRemotePathSegment = (segment) => {
  let decoded = segment;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new Error('Remote storage path contains invalid encoding');
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};

const normalizeObjectPath = (path) => {
  const raw = String(path || '');
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) {
    throw new Error('Remote storage path contains invalid characters');
  }

  const segments = raw.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  for (const segment of segments) {
    const decoded = decodeRemotePathSegment(segment);
    if (decoded === '.' || decoded === '..' || /[\\/\u0000-\u001f\u007f]/.test(decoded)) {
      throw new Error('Remote storage path contains an unsafe segment');
    }
  }
  return segments.join('/');
};

const joinRemotePath = (...parts) => parts.map(normalizeObjectPath).filter(Boolean).join('/');

const parentPathOf = (path) => {
  const normalized = normalizeObjectPath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
};

const normalizeDirectoryPrefix = (path) => {
  const normalized = normalizeObjectPath(path);
  return normalized ? `${normalized}/` : '';
};

const copyUint8Array = (bytes) => {
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  return view;
};

const toUint8Array = (body) => {
  if (body === undefined || body === null) return new Uint8Array(0);
  if (body instanceof Uint8Array) return copyUint8Array(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body.slice(0));
  if (ArrayBuffer.isView(body)) {
    const view = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    return copyUint8Array(view);
  }
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (Array.isArray(body)) return new Uint8Array(body);
  throw new Error('Remote storage body must be a string, ArrayBuffer, or Uint8Array');
};

const toArrayBuffer = (bytes) => {
  const view = toUint8Array(bytes);
  return view.buffer;
};

const streamToUint8Array = async (stream) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = toUint8Array(chunk);
    chunks.push(bytes);
    total += bytes.byteLength;
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const responseBodyToArrayBuffer = async (body) => {
  if (!body) return new ArrayBuffer(0);
  if (body instanceof ArrayBuffer) return body.slice(0);
  if (body instanceof Uint8Array || ArrayBuffer.isView(body)) return toArrayBuffer(body);
  if (typeof body === 'string') return toArrayBuffer(body);

  if (typeof body.transformToByteArray === 'function') {
    return toArrayBuffer(await body.transformToByteArray());
  }

  if (typeof body.arrayBuffer === 'function') {
    return await body.arrayBuffer();
  }

  if (typeof body.transformToString === 'function') {
    return toArrayBuffer(await body.transformToString());
  }

  if (typeof body[Symbol.asyncIterator] === 'function') {
    return toArrayBuffer(await streamToUint8Array(body));
  }

  throw new Error('Remote storage download returned an unsupported response body');
};

const isNotFoundError = (error) => {
  const value = error || {};
  return value?.$metadata?.httpStatusCode === 404 ||
    value?.status === 404 ||
    value?.statusCode === 404 ||
    value?.name === 'NotFound' ||
    value?.name === 'NoSuchKey' ||
    value?.Code === 'NoSuchKey' ||
    value?.code === 'NoSuchKey' ||
    value?.code === 'ERR_OBJECT_NOT_FOUND';
};

const errorMessage = (error) => error?.message || String(error);

const toCloudflareR2S3Config = (config) => ({
  kind: 's3-compatible',
  endpoint: String(config.accountId || '').trim()
    ? `https://${String(config.accountId || '').trim()}.r2.cloudflarestorage.com`
    : '',
  region: 'auto',
  bucket: config.bucket,
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey,
  prefix: CLOUDFLARE_R2_DEFAULT_BACKUP_PREFIX,
  forcePathStyle: true,
});

const createDefaultDependencies = () => ({
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  openExternal: async (url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
  },
  createWebDavClient: async (endpoint, options) => {
    if (!webDavModulePromise) {
      webDavModulePromise = Promise.resolve().then(() => require('webdav'));
    }
    const webdav = await webDavModulePromise;
    return webdav.createClient(endpoint, options);
  },
});

class S3RemoteObjectStore {
  constructor(config, dependencies) {
    this.config = config;
    this.dependencies = dependencies;
    this.assertConfigured();
    this.client = new dependencies.S3Client({
      endpoint: config.endpoint,
      region: config.region || 'auto',
      forcePathStyle: config.forcePathStyle !== false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async exists(path) {
    return Boolean(await this.head(path));
  }

  async head(path) {
    const normalized = normalizeObjectPath(path);
    try {
      const response = await this.client.send(new this.dependencies.HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyForPath(normalized),
      }));
      return {
        path: normalized,
        sizeBytes: typeof response.ContentLength === 'number' ? response.ContentLength : undefined,
        updatedAt: response.LastModified instanceof Date ? response.LastModified.toISOString() : undefined,
        contentType: typeof response.ContentType === 'string' ? response.ContentType : undefined,
      };
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw new Error(`S3 metadata lookup failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  async put(path, body, options = {}) {
    const normalized = normalizeObjectPath(path);
    const bytes = toUint8Array(body);
    const contentType = options.contentType || JSON_MIME_TYPE;
    try {
      await this.client.send(new this.dependencies.PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyForPath(normalized),
        Body: bytes,
        ContentType: contentType,
      }));
    } catch (error) {
      throw new Error(`S3 upload failed: ${errorMessage(error)}`, { cause: error });
    }
    return {
      path: normalized,
      sizeBytes: bytes.byteLength,
      updatedAt: new Date().toISOString(),
      contentType,
    };
  }

  async get(path) {
    const normalized = normalizeObjectPath(path);
    try {
      const response = await this.client.send(new this.dependencies.GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyForPath(normalized),
      }));
      return responseBodyToArrayBuffer(response.Body);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new Error(`S3 object not found: ${normalized}`, { cause: error });
      }
      throw new Error(`S3 download failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  async list(prefix) {
    const entries = [];
    let continuationToken;
    try {
      do {
        const response = await this.client.send(new this.dependencies.ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: this.listPrefixForPath(prefix),
          ContinuationToken: continuationToken,
        }));
        for (const object of response.Contents || []) {
          const key = object.Key || '';
          const path = this.pathFromKey(key);
          if (!path) continue;
          entries.push({
            path,
            sizeBytes: typeof object.Size === 'number' ? object.Size : undefined,
            updatedAt: object.LastModified instanceof Date ? object.LastModified.toISOString() : undefined,
          });
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (error) {
      throw new Error(`S3 list failed: ${errorMessage(error)}`, { cause: error });
    }
    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }

  async delete(path) {
    try {
      await this.client.send(new this.dependencies.DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: this.keyForPath(path),
      }));
    } catch (error) {
      throw new Error(`S3 delete failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  prefix() {
    return joinRemotePath(this.config.prefix || 'prompt-optimizer-backups');
  }

  keyForPath(path) {
    return joinRemotePath(this.prefix(), path);
  }

  listPrefixForPath(path) {
    return normalizeDirectoryPrefix(this.keyForPath(path));
  }

  pathFromKey(key) {
    const prefix = this.prefix();
    return key === prefix
      ? ''
      : key.startsWith(`${prefix}/`)
        ? key.slice(prefix.length + 1)
        : key;
  }

  assertConfigured() {
    if (!this.config.endpoint || !this.config.bucket || !this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new Error('S3 endpoint, bucket, access key, and secret key are required');
    }
  }
}

class WebDavRemoteObjectStore {
  constructor(config, dependencies) {
    this.config = config;
    this.dependencies = dependencies;
    this.rootDirectory = normalizeObjectPath(config.directory || 'prompt-optimizer-backups');
    this.clientPromise = null;
  }

  async exists(path) {
    return Boolean(await this.head(path));
  }

  async head(path) {
    const normalized = normalizeObjectPath(path);
    const client = await this.getClient();
    try {
      const stat = await client.stat(this.filePath(normalized));
      return this.toEntry(normalized, stat);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw new Error(`WebDAV metadata lookup failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  async put(path, body, options = {}) {
    const normalized = normalizeObjectPath(path);
    const bytes = toUint8Array(body);
    const client = await this.getClient();
    await this.ensureDirectoryPath(parentPathOf(normalized));
    try {
      await client.putFileContents(this.filePath(normalized), Buffer.from(bytes), {
        contentLength: bytes.byteLength,
        overwrite: true,
        headers: options.contentType ? { 'Content-Type': options.contentType } : undefined,
      });
    } catch (error) {
      throw new Error(`WebDAV upload failed: ${errorMessage(error)}`, { cause: error });
    }
    return {
      path: normalized,
      sizeBytes: bytes.byteLength,
      updatedAt: new Date().toISOString(),
      contentType: options.contentType,
    };
  }

  async get(path) {
    const normalized = normalizeObjectPath(path);
    const client = await this.getClient();
    try {
      const contents = await client.getFileContents(this.filePath(normalized), { format: 'binary' });
      return responseBodyToArrayBuffer(contents);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new Error(`WebDAV object not found: ${normalized}`, { cause: error });
      }
      throw new Error(`WebDAV download failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  async list(prefix) {
    const normalizedPrefix = normalizeObjectPath(prefix);
    const client = await this.getClient();
    await this.ensureDirectoryPath(normalizedPrefix);
    try {
      const contents = await client.getDirectoryContents(this.directoryPath(normalizedPrefix), {
        deep: true,
        details: true,
      });
      const items = Array.isArray(contents) ? contents : contents?.data || [];
      return items
        .filter((item) => item && item.type !== 'directory')
        .map((item) => this.toEntryFromRemotePath(item.filename || item.basename || '', item))
        .filter(Boolean)
        .sort((a, b) => a.path.localeCompare(b.path));
    } catch (error) {
      throw new Error(`WebDAV list failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  async delete(path) {
    const normalized = normalizeObjectPath(path);
    const client = await this.getClient();
    try {
      await client.deleteFile(this.filePath(normalized));
    } catch (error) {
      if (isNotFoundError(error)) return;
      throw new Error(`WebDAV delete failed: ${errorMessage(error)}`, { cause: error });
    }
  }

  async ensureDirectoryPath(path) {
    const client = await this.getClient();
    const normalized = normalizeObjectPath(path);
    try {
      await client.createDirectory(this.directoryPath(''), { recursive: true });
      if (normalized) {
        await client.createDirectory(this.directoryPath(normalized), { recursive: true });
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new Error(`WebDAV directory creation failed: ${errorMessage(error)}`, { cause: error });
      }
      if (!/exists|already/i.test(errorMessage(error))) {
        throw new Error(`WebDAV directory creation failed: ${errorMessage(error)}`, { cause: error });
      }
    }
  }

  async getClient() {
    if (!this.clientPromise) {
      if (!this.config.endpoint) throw new Error('WebDAV endpoint is required');
      this.clientPromise = Promise.resolve(this.dependencies.createWebDavClient(
        this.config.endpoint,
        {
          username: this.config.username || undefined,
          password: this.config.password || undefined,
        },
      ));
    }
    return this.clientPromise;
  }

  directoryPath(path) {
    return `/${joinRemotePath(this.rootDirectory, path)}`;
  }

  filePath(path) {
    return this.directoryPath(path);
  }

  toEntry(path, item = {}) {
    const sizeValue = item.size ?? item.props?.getcontentlength;
    const updatedValue = item.lastmod ?? item.lastModified ?? item.props?.getlastmodified;
    return {
      path: normalizeObjectPath(path),
      sizeBytes: typeof sizeValue === 'number' ? sizeValue : Number.isFinite(Number(sizeValue)) ? Number(sizeValue) : undefined,
      updatedAt: updatedValue ? new Date(updatedValue).toISOString() : undefined,
      contentType: item.mime || item.props?.getcontenttype || undefined,
    };
  }

  toEntryFromRemotePath(remotePath, item) {
    const root = this.directoryPath('').replace(/\/+$/g, '');
    const decodedRemotePath = decodeURIComponent(String(remotePath || ''));
    const withoutRoot = decodedRemotePath.startsWith(`${root}/`)
      ? decodedRemotePath.slice(root.length + 1)
      : decodedRemotePath.replace(/^\/+/, '');
    if (!withoutRoot) return null;
    return this.toEntry(withoutRoot, item);
  }
}

const createRemoteObjectStore = (provider, dependencies = createDefaultDependencies()) => {
  if (!provider || typeof provider !== 'object') {
    throw new Error('Remote storage provider config is required');
  }
  if (provider.kind === 'google-drive') {
    throw new Error('Google Drive remote backup is only supported in the Web version');
  }
  if (provider.kind === 'cloudflare-r2') {
    return new S3RemoteObjectStore(toCloudflareR2S3Config(provider), dependencies);
  }
  if (provider.kind === 's3-compatible') {
    return new S3RemoteObjectStore(provider, dependencies);
  }
  if (provider.kind === 'webdav') {
    return new WebDavRemoteObjectStore(provider, dependencies);
  }
  throw new Error(`Remote storage provider is not supported by Desktop IPC: ${provider.kind}`);
};

const handleRemoteStorageOperation = async (request, dependencies = createDefaultDependencies()) => {
  if (!request || typeof request !== 'object') {
    throw new Error('Remote storage request is required');
  }
  const store = createRemoteObjectStore(request.provider, dependencies);
  const operation = request.operation;
  const path = normalizeObjectPath(request.path || '');

  if (operation === 'authorize') {
    if (typeof store.authorize === 'function') await store.authorize();
    return null;
  }
  if (operation === 'head') return store.head(path);
  if (operation === 'exists') return store.exists(path);
  if (operation === 'put') {
    return store.put(path, request.body, { contentType: request.contentType });
  }
  if (operation === 'get') return store.get(path);
  if (operation === 'getText') {
    return new TextDecoder().decode(await store.get(path));
  }
  if (operation === 'list') return store.list(path);
  if (operation === 'delete') {
    await store.delete(path);
    return null;
  }

  throw new Error(`Unsupported remote storage operation: ${operation}`);
};

function setupRemoteStorageHandlers(ipcMain, helpers = {}, dependencies) {
  const createSuccessResponse = helpers.createSuccessResponse || ((data) => ({ success: true, data }));
  const createErrorResponse = helpers.createErrorResponse || ((error) => ({
    success: false,
    error: { message: error?.message || String(error) },
  }));

  ipcMain.handle(REMOTE_STORAGE_CHANNEL, async (_event, request) => {
    try {
      const result = await handleRemoteStorageOperation(request, dependencies);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  });
}

module.exports = {
  REMOTE_STORAGE_CHANNEL,
  createDefaultDependencies,
  createRemoteObjectStore,
  handleRemoteStorageOperation,
  setupRemoteStorageHandlers,
};
