import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

import { toComparableFileUrl } from './direct-execution.mjs'

const KIB = 1024
const LOCAL_ORIGIN = 'https://bundle.local'

export const DEFAULT_BUDGETS = Object.freeze({
  jsGzipBytes: 740 * KIB,
  cssGzipBytes: 32 * KIB,
  totalGzipBytes: 770 * KIB,
})

function readAttributes(tag) {
  const attributes = new Map()
  const attributePattern = /([^\s=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match

  while ((match = attributePattern.exec(tag)) !== null) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attributes.set(name, value)
  }

  return attributes
}

export function collectInitialResourceUrls(html) {
  const resources = []
  const tagPattern = /<(script|link)\b[^>]*>/gi
  let match

  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase()
    const attributes = readAttributes(match[0])

    if (tagName === 'script') {
      if (attributes.get('type') === 'module' && attributes.has('src')) {
        resources.push({ type: 'js', url: attributes.get('src') })
      }
      continue
    }

    const relValues = (attributes.get('rel') || '').toLowerCase().split(/\s+/)
    const href = attributes.get('href')
    if (!href) continue

    if (relValues.includes('modulepreload')) {
      resources.push({ type: 'js', url: href })
    } else if (relValues.includes('stylesheet')) {
      resources.push({ type: 'css', url: href })
    }
  }

  return resources
}

function resolveLocalResource(distDir, resourceUrl) {
  const parsed = new URL(resourceUrl, `${LOCAL_ORIGIN}/`)
  if (parsed.origin !== LOCAL_ORIGIN) {
    return null
  }

  const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
  const absolutePath = path.resolve(distDir, relativePath)
  const relativeToDist = path.relative(distDir, absolutePath)
  if (relativeToDist.startsWith('..') || path.isAbsolute(relativeToDist)) {
    throw new Error(`[bundle-budget] Resource escapes dist directory: ${resourceUrl}`)
  }

  return { absolutePath, relativePath: relativeToDist.replaceAll(path.sep, '/') }
}

export function measureInitialBundle(distDirectory) {
  const distDir = path.resolve(distDirectory)
  const indexPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(indexPath)) {
    throw new Error(`[bundle-budget] Missing build entry: ${indexPath}`)
  }

  const html = fs.readFileSync(indexPath, 'utf8')
  const seen = new Set()
  const resources = []

  for (const resource of collectInitialResourceUrls(html)) {
    const local = resolveLocalResource(distDir, resource.url)
    if (!local) continue

    const key = `${resource.type}:${local.absolutePath}`
    if (seen.has(key)) continue
    seen.add(key)

    if (!fs.existsSync(local.absolutePath)) {
      throw new Error(
        `[bundle-budget] Missing referenced ${resource.type.toUpperCase()} asset: ${local.relativePath}`,
      )
    }

    const contents = fs.readFileSync(local.absolutePath)
    resources.push({
      ...resource,
      relativePath: local.relativePath,
      rawBytes: contents.byteLength,
      gzipBytes: zlib.gzipSync(contents, { level: 9 }).byteLength,
    })
  }

  if (!resources.some((resource) => resource.type === 'js')) {
    throw new Error('[bundle-budget] No initial module script was found in index.html')
  }

  const totals = resources.reduce(
    (result, resource) => {
      result[resource.type].rawBytes += resource.rawBytes
      result[resource.type].gzipBytes += resource.gzipBytes
      result.total.rawBytes += resource.rawBytes
      result.total.gzipBytes += resource.gzipBytes
      return result
    },
    {
      js: { rawBytes: 0, gzipBytes: 0 },
      css: { rawBytes: 0, gzipBytes: 0 },
      total: { rawBytes: 0, gzipBytes: 0 },
    },
  )

  return { distDir, resources, totals }
}

export function checkBudgets(measurement, budgets = DEFAULT_BUDGETS) {
  const checks = [
    ['initial JS', measurement.totals.js.gzipBytes, budgets.jsGzipBytes],
    ['initial CSS', measurement.totals.css.gzipBytes, budgets.cssGzipBytes],
    ['initial total', measurement.totals.total.gzipBytes, budgets.totalGzipBytes],
  ]

  return checks
    .filter(([, actual, maximum]) => actual > maximum)
    .map(([label, actual, maximum]) => ({ label, actual, maximum }))
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(1)} KiB`
}

function printMeasurement(measurement, budgets) {
  console.log(`[bundle-budget] ${measurement.distDir}`)
  for (const resource of [...measurement.resources].sort((a, b) => b.gzipBytes - a.gzipBytes)) {
    console.log(
      `  ${resource.type.toUpperCase().padEnd(3)} ${formatKiB(resource.gzipBytes).padStart(10)} gzip  ${resource.relativePath}`,
    )
  }
  console.log(
    `[bundle-budget] initial JS ${formatKiB(measurement.totals.js.gzipBytes)} / ${formatKiB(budgets.jsGzipBytes)}`,
  )
  console.log(
    `[bundle-budget] initial CSS ${formatKiB(measurement.totals.css.gzipBytes)} / ${formatKiB(budgets.cssGzipBytes)}`,
  )
  console.log(
    `[bundle-budget] initial total ${formatKiB(measurement.totals.total.gzipBytes)} / ${formatKiB(budgets.totalGzipBytes)}`,
  )
}

function parsePositiveKiB(value, flag) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[bundle-budget] ${flag} must be a positive number`)
  }
  return Math.round(parsed * KIB)
}

export function parseArguments(argv) {
  const budgets = { ...DEFAULT_BUDGETS }
  let distDirectory = 'packages/web/dist'

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) {
      distDirectory = argument
      continue
    }

    const value = argv[index + 1]
    if (value === undefined) {
      throw new Error(`[bundle-budget] Missing value for ${argument}`)
    }
    index += 1

    if (argument === '--max-js-gzip-kib') {
      budgets.jsGzipBytes = parsePositiveKiB(value, argument)
    } else if (argument === '--max-css-gzip-kib') {
      budgets.cssGzipBytes = parsePositiveKiB(value, argument)
    } else if (argument === '--max-total-gzip-kib') {
      budgets.totalGzipBytes = parsePositiveKiB(value, argument)
    } else {
      throw new Error(`[bundle-budget] Unknown option: ${argument}`)
    }
  }

  return { budgets, distDirectory }
}

export function main(argv = process.argv.slice(2)) {
  const { budgets, distDirectory } = parseArguments(argv)
  const measurement = measureInitialBundle(distDirectory)
  const violations = checkBudgets(measurement, budgets)
  printMeasurement(measurement, budgets)

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `[bundle-budget] ${violation.label} exceeds budget: ${formatKiB(violation.actual)} > ${formatKiB(violation.maximum)}`,
      )
    }
    process.exitCode = 1
    return
  }

  console.log('[bundle-budget] PASS')
}

if (import.meta.url === toComparableFileUrl(process.argv[1])) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
