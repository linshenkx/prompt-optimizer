import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

/** An isolated HTTP object store: real browser CORS and desktop WebDAV requests. */
export async function startBackupWebDav() {
  const files = new Map<string, Buffer>()
  const directories = new Set(['/dav'])
  const requests: Array<{ method: string; path: string }> = []
  const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const server = createServer(async (request, response) => {
    const method = request.method || 'GET'
    const path = decodeURIComponent(new URL(request.url || '/', 'http://test').pathname).replace(/\/$/, '') || '/'
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, If-Match, If-None-Match')
    response.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Length, Last-Modified')
    if (method === 'OPTIONS') { response.writeHead(204).end(); return }
    requests.push({ method, path })
    if (request.headers.authorization !== 'Basic ' + Buffer.from('backup-user:test-secret').toString('base64')) {
      response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="test-backup"' }).end()
      return
    }
    const send = (status: number, body?: Buffer | string, contentType = 'application/octet-stream') => {
      response.writeHead(status, {
        'Content-Type': contentType, ETag: '"test-etag"', 'Last-Modified': new Date().toUTCString(),
        ...(body === undefined ? {} : { 'Content-Length': Buffer.byteLength(body) }),
      }).end(method === 'HEAD' ? undefined : body)
    }
    if (method === 'MKCOL') {
      if (directories.has(path)) { send(405); return }
      directories.add(path); send(201); return
    }
    if (method === 'PUT') {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      files.set(path, Buffer.concat(chunks))
      directories.add(path.slice(0, path.lastIndexOf('/')))
      send(201); return
    }
    if (method === 'HEAD' || method === 'GET') {
      const body = files.get(path)
      send(body ? 200 : 404, body); return
    }
    if (method === 'DELETE') { files.delete(path); send(204); return }
    if (method === 'PROPFIND') {
      if (!directories.has(path)) { send(404); return }
      const deep = request.headers.depth === 'infinity'
      const children = [...directories, ...files.keys()].filter(candidate => candidate === path ||
        (candidate.startsWith(path + '/') && (deep || !candidate.slice(path.length + 1).includes('/'))))
      const xml = children.map(candidate => {
        const directory = directories.has(candidate)
        return `<D:response><D:href>${escapeXml(encodeURI(candidate + (directory ? '/' : '')))}</D:href>` +
          `<D:propstat><D:prop><D:resourcetype>${directory ? '<D:collection/>' : ''}</D:resourcetype>` +
          `<D:getcontentlength>${files.get(candidate)?.length || 0}</D:getcontentlength>` +
          `<D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified><D:getetag>test-etag</D:getetag>` +
          '</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>'
      }).join('')
      send(207, `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">${xml}</D:multistatus>`, 'application/xml')
      return
    }
    send(405)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}/dav`, files, requests,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  }
}
