import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 兼容 monorepo 根目录或 packages/core 作为 cwd 的两种启动方式。 */
const servicesDirCandidates = [
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/services'),
  join(process.cwd(), 'src', 'services'),
  join(process.cwd(), 'packages', 'core', 'src', 'services'),
]
const servicesDir = servicesDirCandidates.find((candidate) => existsSync(candidate))
  ?? servicesDirCandidates[0]

const findElectronProxyFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findElectronProxyFiles(fullPath))
    } else if (entry.isFile() && entry.name === 'electron-proxy.ts') {
      files.push(fullPath)
    }
  }

  return files
}

const SERIALIZATION_REQUIRED = [
  /:\s*ImageRequest\b/,
  /:\s*Text2ImageRequest\b/,
  /:\s*Image2ImageRequest\b/,
  /:\s*MultiImageGenerationRequest\b/,
  /:\s*MultiImageRequest\b/,
  /:\s*ImageModelConfig\b/,
  /:\s*Partial<ImageModelConfig>\b/,
  /:\s*Record<string,\s*(?:unknown|any)>\b/,
  /:\s*unknown\b/,
  /:\s*any\b/,
  /\.\.\.args:\s*any\[\]/,
]

const SAFE_SERIALIZATION = /safeSerializeForIPC|safeSerializeArgs/

describe('Electron proxy IPC serialization guard', () => {
  it('uses shared IPC serialization in proxies that accept complex payloads', () => {
    const offenders = findElectronProxyFiles(servicesDir)
      .map((path) => ({
        path,
        content: readFileSync(path, 'utf8'),
      }))
      .filter(({ content }) => SERIALIZATION_REQUIRED.some((pattern) => pattern.test(content)))
      .filter(({ content }) => !SAFE_SERIALIZATION.test(content))
      .map(({ path }) => relative(process.cwd(), path))

    expect(offenders).toEqual([])
  })
})
