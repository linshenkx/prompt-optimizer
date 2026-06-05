import type {
  FavoritePrompt,
  IImageStorageService,
  PromptContent,
  PromptExample,
} from '@prompt-optimizer/core'
import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate'

import {
  createFavoriteResourcePackageFromJson,
  type FavoriteResourcePackageExportResult,
} from './favorite-resource-package'
import { parseFavoriteMediaMetadata } from './favorite-media'
import { parseFavoriteReproducibility } from './favorite-reproducibility'
import {
  getEmbeddedFavoritePromptAsset,
  promptContentToEditableText,
} from './favorite-prompt-versions'

export const FAVORITE_SHARE_SCHEMA_VERSION = 'prompt-optimizer/favorite-share/v1' as const
export const FAVORITE_SHARE_HTML_SCRIPT_ID = 'prompt-optimizer-favorite-share'
const FAVORITE_SHARE_PNG_TEXT_KEYWORD = 'PromptOptimizerFavoriteShare'

export type FavoriteShareSectionKey =
  | 'description'
  | 'content'
  | 'tags'
  | 'media'
  | 'variables'
  | 'examples'
  | 'versions'
  | 'watermark'

export type FavoriteShareSections = Record<FavoriteShareSectionKey, boolean>

export type FavoriteShareBranding = {
  projectName?: string
  projectUrl?: string
}

export type FavoriteShareLabels = {
  htmlLang: string
  documentTitleSuffix: string
  eyebrow: string
  metaPrefix: string
  headerImportNote: string
  copyButton: string
  copiedButton: string
  copyFailedButton: string
  descriptionTitle: string
  promptTitle: string
  tagsTitle: string
  modeTitle: string
  variablesTitle: string
  examplesTitle: string
  versionsTitle: string
  inputTitle: string
  outputTitle: string
  importNoteTitle: string
  currentVersionLabel: string
  htmlImportNoteBody1: string
  htmlImportNoteBody2: string
  pngImportNoteText: string
  pngHeaderBadge: string
  exampleTitle: (index: number) => string
  exampleOutputAlt: (index: number) => string
  exampleInputAlt: (index: number) => string
  versionTitle: (version: number | string, isCurrent: boolean) => string
  parameterSummary: (count: number) => string
  outputImageSummary: (count: number) => string
  inputImageSummary: (count: number) => string
}

export type FavoriteSharePayload = {
  schemaVersion: typeof FAVORITE_SHARE_SCHEMA_VERSION
  format: 'favorite-share'
  createdAt: string
  favoriteTitle: string
  sections: FavoriteShareSections
  branding: FavoriteShareBranding
  packageBase64: string
}

export type FavoriteShareBuildOptions = {
  favorite: FavoritePrompt
  sections: FavoriteShareSections
  branding?: FavoriteShareBranding
  labels?: Partial<FavoriteShareLabels>
  imageStorageServices?: Array<Pick<IImageStorageService, 'getImage'> | null | undefined>
}

export type FavoriteShareBuildResult = {
  favorite: FavoritePrompt
  package: FavoriteResourcePackageExportResult
  payload: FavoriteSharePayload
  mediaSources: string[]
  exampleMedia: Array<{
    outputSources: string[]
    inputSources: string[]
  }>
}

type HtmlShareOptions = FavoriteShareBuildOptions

type PngShareOptions = FavoriteShareBuildOptions & {
  canvasFactory?: () => HTMLCanvasElement
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const DEFAULT_FAVORITE_SHARE_LABELS: FavoriteShareLabels = {
  htmlLang: 'en',
  documentTitleSuffix: 'GlobalCloud XiaoC Favorite',
  eyebrow: 'GlobalCloud XiaoC Favorite Share',
  metaPrefix: 'GlobalCloud XiaoC favorite share',
  headerImportNote: 'Import: open https://prompt.always200.com/ -> Favorites -> Import -> upload this HTML file.',
  copyButton: 'Copy',
  copiedButton: 'Copied',
  copyFailedButton: 'Failed',
  descriptionTitle: 'Description',
  promptTitle: 'Prompt',
  tagsTitle: 'Tags',
  modeTitle: 'Mode',
  variablesTitle: 'Variables',
  examplesTitle: 'Examples',
  versionsTitle: 'Versions',
  inputTitle: 'Input',
  outputTitle: 'Output',
  importNoteTitle: 'Import Note',
  currentVersionLabel: 'current',
  htmlImportNoteBody1: 'Import: open https://prompt.always200.com/ -> Favorites -> Import -> upload this HTML file.',
  htmlImportNoteBody2: 'Use the original HTML file to restore embedded data and images.',
  pngImportNoteText: 'Import: open https://prompt.always200.com/ -> Favorites -> Import -> upload the original PNG file.\nUse the original image. Screenshots, compression, format conversion, or re-saving may remove import data.',
  pngHeaderBadge: 'GlobalCloud XiaoC Favorite Share',
  exampleTitle: (index) => `Example ${index}`,
  exampleOutputAlt: (index) => `Example ${index} output`,
  exampleInputAlt: (index) => `Example ${index} input`,
  versionTitle: (version, isCurrent) => `v${version}${isCurrent ? ' · current' : ''}`,
  parameterSummary: (count) => `${count} parameter${count > 1 ? 's' : ''}`,
  outputImageSummary: (count) => `${count} output image${count > 1 ? 's' : ''}`,
  inputImageSummary: (count) => `${count} input image${count > 1 ? 's' : ''}`,
}

const resolveFavoriteShareLabels = (labels?: Partial<FavoriteShareLabels>): FavoriteShareLabels => ({
  ...DEFAULT_FAVORITE_SHARE_LABELS,
  ...(labels || {}),
})

export const DEFAULT_FAVORITE_SHARE_SECTIONS: FavoriteShareSections = {
  description: true,
  content: true,
  tags: true,
  media: true,
  variables: true,
  examples: true,
  versions: false,
  watermark: true,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const asTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

const stripImagesFromPromptContent = (content: PromptContent): PromptContent => {
  if (content.kind !== 'image-prompt') return content
  const next = { ...content }
  delete next.images
  return next
}

const blankPromptContent = (content: PromptContent): PromptContent => {
  if (content.kind === 'messages') {
    return {
      ...content,
      messages: [],
    }
  }

  if (content.kind === 'image-prompt') {
    return {
      kind: 'image-prompt',
      text: '',
    }
  }

  return {
    kind: 'text',
    text: '',
  }
}

const sanitizePromptContent = (
  content: PromptContent,
  sections: FavoriteShareSections,
): PromptContent => {
  const contentFiltered = sections.content ? content : blankPromptContent(content)
  return sections.media ? contentFiltered : stripImagesFromPromptContent(contentFiltered)
}

const stripImagesFromPromptExample = (example: PromptExample): PromptExample => ({
  ...example,
  input: {
    ...example.input,
    images: undefined,
  },
  output: example.output
    ? {
        ...example.output,
        images: undefined,
      }
    : undefined,
})

const sanitizePromptAsset = (
  value: unknown,
  sections: FavoriteShareSections,
): unknown => {
  if (!isRecord(value)) return value
  const asset = cloneJson(value)

  if (isRecord(asset.contract) && !sections.variables) {
    asset.contract.variables = []
  }

  if (Array.isArray(asset.versions)) {
    const currentVersionId = asTrimmedString(asset.currentVersionId)
    const versions = sections.versions
      ? asset.versions
      : asset.versions.filter((version) =>
          isRecord(version) && asTrimmedString(version.id) === currentVersionId,
        )
    asset.versions = versions.map((version) => {
      if (!isRecord(version) || !isRecord(version.content)) return version
      return {
        ...version,
        content: sanitizePromptContent(version.content as PromptContent, sections),
      }
    })
  }

  if (isRecord(asset.content)) {
    asset.content = sanitizePromptContent(asset.content as PromptContent, sections)
  }

  if (!sections.examples) {
    asset.examples = []
  } else if (!sections.media && Array.isArray(asset.examples)) {
    asset.examples = asset.examples.map((example) =>
      isRecord(example)
        ? stripImagesFromPromptExample(example as unknown as PromptExample)
        : example,
    )
  }

  return asset
}

const sanitizeExampleLikeItem = (
  item: unknown,
  sections: FavoriteShareSections,
): unknown => {
  if (!isRecord(item)) return item
  const next = { ...item }
  if (!sections.media) {
    delete next.imageAssetIds
    delete next.inputImageAssetIds
    delete next.images
    delete next.inputImages
  }
  if (!sections.content) {
    delete next.text
    delete next.outputText
    delete next.messages
  }
  return next
}

const sanitizeGardenSnapshot = (
  value: unknown,
  sections: FavoriteShareSections,
): unknown => {
  if (!isRecord(value)) return undefined

  const shouldKeepSnapshot =
    sections.content ||
    sections.media ||
    sections.variables ||
    sections.examples

  if (!shouldKeepSnapshot) return undefined

  const next = cloneJson(value)

  if (!sections.content && isRecord(next.prompt)) {
    if (next.prompt.format === 'messages') {
      next.prompt.messages = []
    } else {
      next.prompt.text = ''
    }
  }

  if (!sections.variables) {
    next.variables = []
  }

  if (isRecord(next.assets)) {
    const assets = { ...next.assets }
    if (!sections.media) {
      delete assets.cover
      assets.showcases = []
    }

    if (!sections.examples) {
      assets.examples = []
    } else if (Array.isArray(assets.examples)) {
      assets.examples = assets.examples.map((item) => sanitizeExampleLikeItem(item, sections))
    }

    next.assets = assets
  }

  if (isRecord(next.meta)) {
    const meta = { ...next.meta }
    if (!sections.description) {
      delete meta.description
      delete meta.source
      delete meta.sourceUrl
      delete meta.license
    }
    if (!sections.tags) {
      delete meta.category
      delete meta.categoryKey
      delete meta.tags
      delete meta.tagKeys
    }
    next.meta = meta
  }

  return next
}

const sanitizeMetadata = (
  metadata: FavoritePrompt['metadata'],
  sections: FavoriteShareSections,
): FavoritePrompt['metadata'] | undefined => {
  if (!isRecord(metadata)) return undefined

  const next = cloneJson(metadata)
  delete next.originalContent

  if (!sections.media) {
    delete next.media
  }

  if (Object.prototype.hasOwnProperty.call(next, 'gardenSnapshot')) {
    const gardenSnapshot = sanitizeGardenSnapshot(next.gardenSnapshot, sections)
    if (gardenSnapshot) {
      next.gardenSnapshot = gardenSnapshot
    } else {
      delete next.gardenSnapshot
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'promptAsset')) {
    next.promptAsset = sanitizePromptAsset(next.promptAsset, sections)
  }

  if (isRecord(next.reproducibility)) {
    if (!sections.variables) {
      next.reproducibility.variables = []
    }
    if (!sections.examples) {
      next.reproducibility.examples = []
    } else if (Array.isArray(next.reproducibility.examples)) {
      next.reproducibility.examples = next.reproducibility.examples.map((item) =>
        sanitizeExampleLikeItem(item, sections),
      )
    }
  }

  if (!sections.variables) {
    delete next.variables
  }

  if (!sections.examples) {
    delete next.examples
  } else if (Array.isArray(next.examples)) {
    next.examples = next.examples.map((item) => sanitizeExampleLikeItem(item, sections))
  }

  return Object.keys(next).length > 0 ? next : undefined
}

export const createFavoriteShareFavorite = (
  favorite: FavoritePrompt,
  sections: FavoriteShareSections,
): FavoritePrompt => {
  const next = cloneJson(favorite)
  if (!sections.description) {
    delete next.description
  }
  if (!sections.content) {
    next.content = ''
  }
  if (!sections.tags) {
    next.tags = []
    delete next.category
  }
  next.metadata = sanitizeMetadata(next.metadata, sections)
  return next
}

const createFavoriteShareExportJson = (
  favorite: FavoritePrompt,
): string => JSON.stringify({
  version: '1.0',
  exportDate: new Date().toISOString(),
  favorites: [favorite],
  categories: [],
  tags: [],
})

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return globalThis.btoa(binary)
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string =>
  bytesToBase64(new Uint8Array(buffer))

const base64ToBytes = (value: string): Uint8Array => {
  const binary = globalThis.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const uint8ArrayToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

const resolveReadStorageCandidates = (
  services: FavoriteShareBuildOptions['imageStorageServices'],
): Array<Pick<IImageStorageService, 'getImage'>> =>
  (services || []).filter((service): service is Pick<IImageStorageService, 'getImage'> => !!service)

const resolveAssetToDataUrl = async (
  assetId: string,
  services: Array<Pick<IImageStorageService, 'getImage'>>,
): Promise<string | null> => {
  for (const service of services) {
    try {
      const image = await service.getImage(assetId)
      if (image?.data) {
        return `data:${image.metadata.mimeType || 'image/png'};base64,${image.data}`
      }
    } catch (error) {
      console.warn('[favorite-share] Failed to resolve asset:', assetId, error)
    }
  }
  return null
}

const resolveFavoriteShareMediaSources = async (
  favorite: FavoritePrompt,
  sections: FavoriteShareSections,
  services: FavoriteShareBuildOptions['imageStorageServices'],
): Promise<string[]> => {
  if (!sections.media) return []

  const media = parseFavoriteMediaMetadata(favorite)
  if (!media) return []

  const storageCandidates = resolveReadStorageCandidates(services)
  const sources: string[] = []

  if (media.coverUrl) sources.push(media.coverUrl)
  if (media.coverAssetId) {
    const dataUrl = await resolveAssetToDataUrl(media.coverAssetId, storageCandidates)
    if (dataUrl) sources.push(dataUrl)
  }

  for (const assetId of media.assetIds) {
    const dataUrl = await resolveAssetToDataUrl(assetId, storageCandidates)
    if (dataUrl) sources.push(dataUrl)
  }

  sources.push(...media.urls)
  return Array.from(new Set(sources.filter(Boolean)))
}

const resolveFavoriteExampleImageSources = async (
  assetIds: string[],
  urls: string[],
  services: Array<Pick<IImageStorageService, 'getImage'>>,
): Promise<string[]> => {
  const sources: string[] = [...urls]
  for (const assetId of assetIds) {
    const dataUrl = await resolveAssetToDataUrl(assetId, services)
    if (dataUrl) sources.push(dataUrl)
  }
  return Array.from(new Set(sources.filter(Boolean)))
}

const resolveFavoriteShareExampleMedia = async (
  favorite: FavoritePrompt,
  sections: FavoriteShareSections,
  services: FavoriteShareBuildOptions['imageStorageServices'],
): Promise<FavoriteShareBuildResult['exampleMedia']> => {
  if (!sections.examples || !sections.media) return []

  const storageCandidates = resolveReadStorageCandidates(services)
  const reproducibility = parseFavoriteReproducibility(favorite)
  return Promise.all(
    reproducibility.examples.map(async (example) => ({
      outputSources: await resolveFavoriteExampleImageSources(
        example.imageAssetIds,
        example.images,
        storageCandidates,
      ),
      inputSources: await resolveFavoriteExampleImageSources(
        example.inputImageAssetIds,
        example.inputImages,
        storageCandidates,
      ),
    })),
  )
}

export const createFavoriteShareBuildResult = async (
  options: FavoriteShareBuildOptions,
): Promise<FavoriteShareBuildResult> => {
  const sharedFavorite = createFavoriteShareFavorite(options.favorite, options.sections)
  const favoritesJson = createFavoriteShareExportJson(sharedFavorite)
  const favoritePackage = await createFavoriteResourcePackageFromJson({
    favoritesJson,
    imageStorageServices: options.imageStorageServices,
  })
  const packageBase64 = arrayBufferToBase64(await favoritePackage.blob.arrayBuffer())
  const payload: FavoriteSharePayload = {
    schemaVersion: FAVORITE_SHARE_SCHEMA_VERSION,
    format: 'favorite-share',
    createdAt: new Date().toISOString(),
    favoriteTitle: sharedFavorite.title,
    sections: { ...options.sections },
    branding: { ...(options.branding || {}) },
    packageBase64,
  }

  return {
    favorite: sharedFavorite,
    package: favoritePackage,
    payload,
    mediaSources: await resolveFavoriteShareMediaSources(
      sharedFavorite,
      options.sections,
      options.imageStorageServices,
    ),
    exampleMedia: await resolveFavoriteShareExampleMedia(
      sharedFavorite,
      options.sections,
      options.imageStorageServices,
    ),
  }
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeScriptJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c')

const sectionHtml = (title: string, body: string): string => `
  <section class="section">
    <h2>${escapeHtml(title)}</h2>
    ${body}
  </section>`

const copyablePreHtml = (value: string, copyLabel: string): string => `
  <div class="copyable-block">
    <button type="button" class="copy-button" data-copy-button>${escapeHtml(copyLabel)}</button>
    <pre>${escapeHtml(value)}</pre>
  </div>`

const imageGridHtml = (
  sources: string[],
  alt: string,
  className = 'example-images',
): string => {
  if (sources.length === 0) return ''
  return `
    <div class="${className}">
      ${sources.map((src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`).join('\n')}
    </div>`
}

const renderShareHtmlBody = (
  result: FavoriteShareBuildResult,
  labels: FavoriteShareLabels,
): string => {
  const { favorite, mediaSources, payload, exampleMedia } = result
  const sections = payload.sections
  const reproducibility = parseFavoriteReproducibility(favorite)
  const promptAsset = getEmbeddedFavoritePromptAsset(favorite)
  const currentVersion = promptAsset?.versions.find((version) => version.id === promptAsset.currentVersionId)
  const content = currentVersion
    ? promptContentToEditableText(currentVersion.content)
    : favorite.content

  const blocks: string[] = []
  const metaChips = [
    favorite.functionMode,
    favorite.optimizationMode,
    favorite.imageSubMode,
  ].filter(Boolean)

  if (sections.media && mediaSources.length > 0) {
    blocks.push(`
      <section class="hero-media">
        ${mediaSources.map((src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(favorite.title)}" />`).join('\n')}
      </section>
    `)
  }
  if (sections.description && favorite.description) {
    blocks.push(sectionHtml(labels.descriptionTitle, `<p>${escapeHtml(favorite.description)}</p>`))
  }
  if (sections.content && content) {
    blocks.push(sectionHtml(labels.promptTitle, copyablePreHtml(content, labels.copyButton)))
  }
  if (sections.tags && favorite.tags.length > 0) {
    blocks.push(sectionHtml(labels.tagsTitle, `<div class="tags">${favorite.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>`))
  }
  if (metaChips.length > 0) {
    blocks.push(sectionHtml(labels.modeTitle, `<div class="tags tags--mode">${metaChips.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>`))
  }
  if (sections.variables && reproducibility.variables.length > 0) {
    blocks.push(sectionHtml(labels.variablesTitle, `
      <ul>
        ${reproducibility.variables.map((variable) => `<li><strong>${escapeHtml(variable.name)}</strong>${variable.description ? ` - ${escapeHtml(variable.description)}` : ''}${variable.defaultValue ? ` <em>${escapeHtml(variable.defaultValue)}</em>` : ''}</li>`).join('')}
      </ul>
    `))
  }
  if (sections.examples && reproducibility.examples.length > 0) {
    blocks.push(sectionHtml(labels.examplesTitle, `
      ${reproducibility.examples.map((example, index) => `
        <div class="example">
          <h3>${escapeHtml(labels.exampleTitle(index + 1))}</h3>
          ${example.text ? `<p>${escapeHtml(example.text)}</p>` : ''}
          ${example.description ? `<p class="muted">${escapeHtml(example.description)}</p>` : ''}
          ${example.outputText ? `<p><strong>${escapeHtml(labels.outputTitle)}</strong><br>${escapeHtml(example.outputText)}</p>` : ''}
          ${imageGridHtml(exampleMedia[index]?.outputSources || [], labels.exampleOutputAlt(index + 1), 'example-images example-images--output')}
          ${Object.keys(example.parameters).length > 0 ? `<h4>${escapeHtml(labels.inputTitle)}</h4>${copyablePreHtml(JSON.stringify(example.parameters, null, 2), labels.copyButton)}` : ''}
          ${imageGridHtml(exampleMedia[index]?.inputSources || [], labels.exampleInputAlt(index + 1), 'example-images example-images--input')}
        </div>
      `).join('')}
    `))
  }
  if (sections.versions && promptAsset && promptAsset.versions.length > 0) {
    blocks.push(sectionHtml(labels.versionsTitle, `
      ${promptAsset.versions.map((version) => `
        <div class="version">
          <h3>${escapeHtml(labels.versionTitle(version.version, version.id === promptAsset.currentVersionId))}</h3>
          ${copyablePreHtml(promptContentToEditableText(version.content), labels.copyButton)}
        </div>
      `).join('')}
    `))
  }
  blocks.push(`
    <section class="import-guide">
      <h2>${escapeHtml(labels.importNoteTitle)}</h2>
      <p>${escapeHtml(labels.htmlImportNoteBody1)}</p>
      <p>${escapeHtml(labels.htmlImportNoteBody2)}</p>
    </section>
  `)
  if (sections.watermark && (payload.branding.projectName || payload.branding.projectUrl)) {
    blocks.push(`<footer>${escapeHtml(payload.branding.projectName || 'GlobalCloud XiaoC')}${payload.branding.projectUrl ? ` · ${escapeHtml(payload.branding.projectUrl)}` : ''}</footer>`)
  }

  return blocks.join('\n')
}

export const createFavoriteShareHtml = async (
  options: HtmlShareOptions,
): Promise<{ blob: Blob; result: FavoriteShareBuildResult }> => {
  const result = await createFavoriteShareBuildResult(options)
  const labels = resolveFavoriteShareLabels(options.labels)
  const html = `<!doctype html>
<html lang="${escapeHtml(labels.htmlLang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(result.favorite.title)} - ${escapeHtml(labels.documentTitleSuffix)}</title>
  <style>
    :root {
      color-scheme: light;
      --color-primary: #2563eb;
      --color-accent: #d97706;
      --color-background: #f8fafc;
      --color-foreground: #0f172a;
      --color-muted: #f1f5fd;
      --color-border: #dbe7fb;
      --color-surface: #ffffff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--color-background); color: var(--color-foreground); }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(135deg, rgba(37, 99, 235, 0.12), transparent 34%),
        radial-gradient(circle at 86% 12%, rgba(217, 119, 6, 0.16), transparent 26%);
    }
    main { position: relative; width: min(960px, 100%); margin: 0 auto; padding: 42px 20px 52px; }
    header {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      padding: clamp(24px, 5vw, 48px);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      border: 1px solid rgba(37, 99, 235, 0.24);
      border-radius: 999px;
      background: var(--color-muted);
      padding: 0 12px;
      color: var(--color-primary);
      font-size: 13px;
      font-weight: 700;
    }
    h1 { margin: 18px 0 0; max-width: 820px; font-size: clamp(32px, 7vw, 72px); line-height: 1.02; letter-spacing: 0; }
    .meta { margin-top: 16px; color: #475569; font-size: 15px; line-height: 1.6; }
    .import-note {
      margin-top: 18px;
      border-left: 4px solid var(--color-accent);
      background: #fff7ed;
      padding: 12px 14px;
      color: #7c2d12;
      font-size: 14px;
      line-height: 1.55;
    }
    .hero-media {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    .hero-media img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      object-fit: cover;
    }
    .section {
      margin-top: 18px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.94);
      padding: clamp(18px, 3vw, 28px);
    }
    h2 { margin: 0 0 12px; color: var(--color-primary); font-size: 14px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    h3 { margin: 16px 0 8px; font-size: 16px; }
    h4 { margin: 14px 0 8px; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0; }
    p, li { line-height: 1.7; }
    .muted { color: #64748b; }
    .copyable-block { position: relative; }
    .copy-button {
      position: absolute;
      top: 10px;
      right: 10px;
      min-height: 30px;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 0 10px;
      font: inherit;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
    }
    .copy-button:hover { background: #dbeafe; }
    pre {
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid #c9d8f4;
      background: #f8fbff;
      border-radius: 8px;
      padding: 16px;
      color: #172033;
      line-height: 1.65;
    }
    .copyable-block pre { padding-right: 78px; }
    .example {
      margin-top: 12px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
    .example:first-child { margin-top: 0; border-top: 0; padding-top: 0; }
    .example-images {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 10px;
      margin: 10px 0;
    }
    .example-images img {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      object-fit: cover;
    }
    .example-images--input img { aspect-ratio: 4 / 3; object-fit: contain; }
    .import-guide {
      margin-top: 18px;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      background: #fff7ed;
      padding: clamp(18px, 3vw, 28px);
      color: #7c2d12;
    }
    .import-guide h2 { color: #b45309; }
    .import-guide p { margin: 8px 0 0; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tags span { border: 1px solid #bfdbfe; border-radius: 999px; padding: 6px 12px; background: #eff6ff; color: #1d4ed8; font-weight: 650; }
    .tags--mode span { border-color: #fed7aa; background: #fff7ed; color: #b45309; }
    footer { margin-top: 22px; color: #475569; font-size: 13px; line-height: 1.6; }
    @media (max-width: 520px) {
      main { padding: 20px 12px 32px; }
      header, .section { padding: 18px; }
      .hero-media { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">${escapeHtml(labels.eyebrow)}</div>
      <h1>${escapeHtml(result.favorite.title)}</h1>
      <div class="meta">${escapeHtml(labels.metaPrefix)} · ${escapeHtml(new Date(result.payload.createdAt).toLocaleString(labels.htmlLang))}</div>
      <div class="import-note">${escapeHtml(labels.headerImportNote)}</div>
    </header>
    ${renderShareHtmlBody(result, labels)}
  </main>
  <script id="${FAVORITE_SHARE_HTML_SCRIPT_ID}" type="application/json">${escapeScriptJson(result.payload)}</script>
  <script>
    (function () {
      function fallbackCopy(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          return true;
        } catch (error) {
          return false;
        } finally {
          document.body.removeChild(textarea);
        }
      }
      function setButtonText(button, text) {
        var original = button.getAttribute('data-copy-original') || button.textContent || ${JSON.stringify(labels.copyButton)};
        button.setAttribute('data-copy-original', original);
        button.textContent = text;
        window.setTimeout(function () {
          button.textContent = original;
        }, 1200);
      }
      document.addEventListener('click', function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement) || !target.matches('[data-copy-button]')) return;
        var pre = target.parentElement ? target.parentElement.querySelector('pre') : null;
        var text = pre ? pre.innerText : '';
        if (!text) return;
        var done = function () { setButtonText(target, ${JSON.stringify(labels.copiedButton)}); };
        var fail = function () { fallbackCopy(text) ? done() : setButtonText(target, ${JSON.stringify(labels.copyFailedButton)}); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(fail);
        } else {
          fail();
        }
      });
    }());
  </script>
</body>
</html>`

  return {
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    result,
  }
}

const ensureCanvas = (canvasFactory?: () => HTMLCanvasElement): HTMLCanvasElement => {
  const canvas = canvasFactory?.() || document.createElement('canvas')
  if (!canvas.getContext) {
    throw new Error('Canvas is not available')
  }
  return canvas
}

const wrapCanvasText = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const lines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.split(/(\s+)/).filter(Boolean)
    let line = ''
    for (const word of words) {
      if (context.measureText(word).width > maxWidth) {
        for (const char of Array.from(word)) {
          const next = `${line}${char}`
          if (line && context.measureText(next).width > maxWidth) {
            lines.push(line.trimEnd())
            line = char
          } else {
            line = next
          }
        }
        continue
      }

      const next = `${line}${word}`
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd())
        line = word.trimStart()
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to render PNG share image'))
      }
    }, 'image/png')
  })

const loadCanvasImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })

const drawImageCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) return

  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const cropWidth = width / scale
  const cropHeight = height / scale
  const cropX = (sourceWidth - cropWidth) / 2
  const cropY = (sourceHeight - cropHeight) / 2
  context.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, width, height)
}

const loadDataUrlCanvasImages = async (
  sources: string[],
  limit: number,
): Promise<HTMLImageElement[]> =>
  (await Promise.all(
    sources
      .filter((source) => source.startsWith('data:image/'))
      .slice(0, limit)
      .map((source) => loadCanvasImage(source)),
  )).filter((image): image is HTMLImageElement => Boolean(image))

export const createFavoriteSharePng = async (
  options: PngShareOptions,
): Promise<{ blob: Blob; result: FavoriteShareBuildResult }> => {
  const result = await createFavoriteShareBuildResult(options)
  const labels = resolveFavoriteShareLabels(options.labels)
  const canvas = ensureCanvas(options.canvasFactory)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is not available')

  const width = 1080
  const padding = 64
  const maxWidth = width - padding * 2
  const sections = result.payload.sections
  const previewImages = sections.media
    ? await loadDataUrlCanvasImages(result.mediaSources, 3)
    : []
  const examplePreviewImages = sections.media && sections.examples
    ? await Promise.all(
        result.exampleMedia
          .slice(0, 4)
          .map((media) => loadDataUrlCanvasImages(media.outputSources, 3)),
      )
    : []
  const reproducibility = parseFavoriteReproducibility(result.favorite)
  const promptAsset = getEmbeddedFavoritePromptAsset(result.favorite)
  const currentVersion = promptAsset?.versions.find((version) => version.id === promptAsset.currentVersionId)
  const content = currentVersion
    ? promptContentToEditableText(currentVersion.content)
    : result.favorite.content
  const modeText = [
    result.favorite.functionMode,
    result.favorite.optimizationMode,
    result.favorite.imageSubMode,
  ].filter(Boolean).join(' / ')
  const watermarkText = sections.watermark
    ? [result.payload.branding.projectName, result.payload.branding.projectUrl].filter(Boolean).join(' · ')
    : ''
  const blocks: Array<{
    label: string
    text: string
    tone?: 'blue' | 'amber'
    images?: HTMLImageElement[]
  }> = []

  if (sections.description && result.favorite.description) {
    blocks.push({ label: labels.descriptionTitle, text: result.favorite.description, tone: 'amber' })
  }
  if (sections.content && content) {
    blocks.push({ label: labels.promptTitle, text: content, tone: 'blue' })
  }
  if (sections.tags && result.favorite.tags.length > 0) {
    blocks.push({ label: labels.tagsTitle, text: result.favorite.tags.map((tag) => `#${tag}`).join('  ') })
  }
  if (modeText) {
    blocks.push({ label: labels.modeTitle, text: modeText })
  }
  if (sections.variables && reproducibility.variables.length > 0) {
    blocks.push({
      label: labels.variablesTitle,
      text: reproducibility.variables
        .slice(0, 8)
        .map((variable) => `${variable.name}${variable.defaultValue ? ` = ${variable.defaultValue}` : ''}`)
        .join('\n'),
    })
  }
  if (sections.examples && reproducibility.examples.length > 0) {
    reproducibility.examples.slice(0, 4).forEach((example, index) => {
      const parameterCount = Object.keys(example.parameters).length
      const outputImageCount = example.imageAssetIds.length + example.images.length
      const inputImageCount = example.inputImageAssetIds.length + example.inputImages.length
      const summary = [
        parameterCount ? labels.parameterSummary(parameterCount) : '',
        outputImageCount ? labels.outputImageSummary(outputImageCount) : '',
        inputImageCount ? labels.inputImageSummary(inputImageCount) : '',
      ].filter(Boolean).join(' · ')
      const description = example.description || example.text
      blocks.push({
        label: labels.exampleTitle(index + 1),
        text: [summary, description].filter(Boolean).join('\n'),
        images: examplePreviewImages[index] || [],
      })
    })
  }
  if (sections.versions && promptAsset && promptAsset.versions.length > 0) {
    blocks.push({
      label: labels.versionsTitle,
      text: promptAsset.versions
        .slice(0, 6)
        .map((version) => labels.versionTitle(version.version, version.id === promptAsset.currentVersionId))
        .join('\n'),
    })
  }
  blocks.push({
    label: labels.importNoteTitle,
    text: labels.pngImportNoteText,
    tone: 'amber',
  })

  context.font = '700 56px sans-serif'
  const titleLines = wrapCanvasText(context, result.favorite.title, maxWidth)
  const measuredBlocks: Array<{
    label: string
    lines: string[]
    tone?: 'blue' | 'amber'
    images: HTMLImageElement[]
    imageHeight: number
    height: number
  }> = []
  const mediaHeight = previewImages.length > 0 ? 236 : 0
  let height = padding + 36 + titleLines.length * 72 + 32 + mediaHeight
  for (const block of blocks) {
    context.font = '400 25px sans-serif'
    const lines = wrapCanvasText(context, block.text, maxWidth - 48)
    const imageHeight = block.images && block.images.length > 0 ? 154 : 0
    const imageGap = imageHeight > 0 && lines.length > 0 ? 18 : 0
    const blockHeight = 76 + lines.length * 38 + imageGap + imageHeight
    measuredBlocks.push({
      label: block.label,
      lines,
      tone: block.tone,
      images: block.images || [],
      imageHeight,
      height: blockHeight,
    })
    height += blockHeight + 18
  }
  if (watermarkText) height += 46
  height += padding

  canvas.width = width
  canvas.height = Math.max(760, Math.ceil(height))
  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#dbeafe'
  context.fillRect(0, 0, canvas.width, 18)
  context.fillStyle = '#2563eb'
  context.fillRect(0, 0, 280, 18)
  context.fillStyle = '#d97706'
  context.fillRect(280, 0, 140, 18)

  let y = padding
  context.fillStyle = '#eff6ff'
  context.fillRect(padding, y, 328, 42)
  context.font = '700 20px sans-serif'
  context.fillStyle = '#1d4ed8'
  context.fillText(labels.pngHeaderBadge, padding + 18, y + 28)
  y += 82

  context.font = '700 56px sans-serif'
  context.fillStyle = '#0f172a'
  for (const line of titleLines) {
    context.fillText(line, padding, y)
    y += 72
  }
  y += 20

  if (previewImages.length > 0) {
    const gap = 16
    const imageWidth = (maxWidth - gap * (previewImages.length - 1)) / previewImages.length
    const imageHeight = 210
    previewImages.forEach((image, index) => {
      const x = padding + index * (imageWidth + gap)
      context.fillStyle = '#ffffff'
      context.fillRect(x, y, imageWidth, imageHeight)
      drawImageCover(context, image, x, y, imageWidth, imageHeight)
    })
    y += imageHeight + 26
  }

  for (const block of measuredBlocks) {
    context.fillStyle = '#ffffff'
    context.fillRect(padding, y, maxWidth, block.height)
    context.fillStyle = block.tone === 'amber' ? '#d97706' : '#2563eb'
    context.fillRect(padding, y, 8, block.height)
    context.font = '800 20px sans-serif'
    context.fillStyle = block.tone === 'amber' ? '#b45309' : '#1d4ed8'
    context.fillText(block.label.toUpperCase(), padding + 28, y + 34)
    context.font = '400 25px sans-serif'
    context.fillStyle = '#172033'
    let lineY = y + 76
    for (const line of block.lines) {
      context.fillText(line, padding + 28, lineY)
      lineY += 38
    }
    if (block.images.length > 0) {
      const imageY = lineY + (block.lines.length > 0 ? 8 : 0)
      const gap = 12
      const maxImageCount = Math.min(block.images.length, 3)
      const imageWidth = Math.min(180, (maxWidth - 56 - gap * (maxImageCount - 1)) / maxImageCount)
      block.images.slice(0, 3).forEach((image, index) => {
        const imageX = padding + 28 + index * (imageWidth + gap)
        context.fillStyle = '#f8fafc'
        context.fillRect(imageX, imageY, imageWidth, block.imageHeight)
        drawImageCover(context, image, imageX, imageY, imageWidth, block.imageHeight)
      })
    }
    y += block.height + 18
  }

  if (watermarkText) {
    context.font = '500 20px sans-serif'
    context.fillStyle = '#475569'
    context.fillText(watermarkText, padding, y + 28)
  }

  const rendered = await canvasToPngBlob(canvas)
  const pngBytes = new Uint8Array(await rendered.arrayBuffer())
  const payloadText = JSON.stringify(result.payload)
  const withMetadata = insertPngInternationalTextChunk(pngBytes, FAVORITE_SHARE_PNG_TEXT_KEYWORD, payloadText)
  return {
    blob: new Blob([uint8ArrayToArrayBuffer(withMetadata)], { type: 'image/png' }),
    result,
  }
}

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0

const writeUint32 = (target: Uint8Array, offset: number, value: number) => {
  target[offset] = (value >>> 24) & 0xff
  target[offset + 1] = (value >>> 16) & 0xff
  target[offset + 2] = (value >>> 8) & 0xff
  target[offset + 3] = value & 0xff
}

let crcTable: Uint32Array | null = null

const getCrcTable = (): Uint32Array => {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  crcTable = table
  return table
}

const crc32 = (bytes: Uint8Array): number => {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const isPng = (bytes: Uint8Array): boolean =>
  PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)

export const insertPngTextChunk = (
  pngBytes: Uint8Array,
  keyword: string,
  text: string,
): Uint8Array => {
  if (!isPng(pngBytes)) throw new Error('Not a PNG file')
  const encoder = new TextEncoder()
  const type = encoder.encode('tEXt')
  const data = encoder.encode(`${keyword}\u0000${text}`)
  const chunk = createPngChunk(type, data)

  return insertPngChunkAfterIhdr(pngBytes, chunk)
}

export const insertPngInternationalTextChunk = (
  pngBytes: Uint8Array,
  keyword: string,
  text: string,
  options: {
    compressed?: boolean
    languageTag?: string
    translatedKeyword?: string
  } = {},
): Uint8Array => {
  if (!isPng(pngBytes)) throw new Error('Not a PNG file')
  const encoder = new TextEncoder()
  const type = encoder.encode('iTXt')
  const keywordBytes = encoder.encode(keyword)
  const languageBytes = encoder.encode(options.languageTag || '')
  const translatedKeywordBytes = encoder.encode(options.translatedKeyword || '')
  const textBytes = strToU8(text)
  const compressed = options.compressed !== false
  const encodedTextBytes = compressed ? zlibSync(textBytes) : textBytes
  const data = new Uint8Array(
    keywordBytes.length +
      1 +
      1 +
      1 +
      languageBytes.length +
      1 +
      translatedKeywordBytes.length +
      1 +
      encodedTextBytes.length,
  )
  let offset = 0
  data.set(keywordBytes, offset)
  offset += keywordBytes.length
  data[offset++] = 0
  data[offset++] = compressed ? 1 : 0
  data[offset++] = 0
  data.set(languageBytes, offset)
  offset += languageBytes.length
  data[offset++] = 0
  data.set(translatedKeywordBytes, offset)
  offset += translatedKeywordBytes.length
  data[offset++] = 0
  data.set(encodedTextBytes, offset)

  const chunk = createPngChunk(type, data)
  return insertPngChunkAfterIhdr(pngBytes, chunk)
}

const createPngChunk = (type: Uint8Array, data: Uint8Array): Uint8Array => {
  const chunk = new Uint8Array(12 + data.length)
  writeUint32(chunk, 0, data.length)
  chunk.set(type, 4)
  chunk.set(data, 8)
  const crcInput = new Uint8Array(type.length + data.length)
  crcInput.set(type, 0)
  crcInput.set(data, type.length)
  writeUint32(chunk, 8 + data.length, crc32(crcInput))
  return chunk
}

const insertPngChunkAfterIhdr = (pngBytes: Uint8Array, chunk: Uint8Array): Uint8Array => {
  const ihdrLength = readUint32(pngBytes, 8)
  const insertOffset = 8 + 12 + ihdrLength
  const output = new Uint8Array(pngBytes.length + chunk.length)
  output.set(pngBytes.slice(0, insertOffset), 0)
  output.set(chunk, insertOffset)
  output.set(pngBytes.slice(insertOffset), insertOffset + chunk.length)
  return output
}

export const readPngTextChunk = (
  pngBytes: Uint8Array,
  keyword: string,
): string | null => {
  if (!isPng(pngBytes)) return null
  const decoder = new TextDecoder()
  let offset = 8
  while (offset + 12 <= pngBytes.length) {
    const length = readUint32(pngBytes, offset)
    const type = decoder.decode(pngBytes.slice(offset + 4, offset + 8))
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > pngBytes.length) return null

    if (type === 'tEXt') {
      const data = pngBytes.slice(dataStart, dataEnd)
      const separator = data.indexOf(0)
      if (separator > 0) {
        const currentKeyword = decoder.decode(data.slice(0, separator))
        if (currentKeyword === keyword) {
          return decoder.decode(data.slice(separator + 1))
        }
      }
    }
    if (type === 'iTXt') {
      const text = readPngInternationalTextData(pngBytes.slice(dataStart, dataEnd), keyword)
      if (text !== null) return text
    }
    offset = dataEnd + 4
  }
  return null
}

const readPngInternationalTextData = (
  data: Uint8Array,
  expectedKeyword: string,
): string | null => {
  const decoder = new TextDecoder()
  const keywordEnd = data.indexOf(0)
  if (keywordEnd <= 0 || keywordEnd + 5 > data.length) return null

  const keyword = decoder.decode(data.slice(0, keywordEnd))
  if (keyword !== expectedKeyword) return null

  const compressionFlag = data[keywordEnd + 1]
  const compressionMethod = data[keywordEnd + 2]
  if (compressionFlag !== 0 && compressionFlag !== 1) return null
  if (compressionMethod !== 0) return null

  let offset = keywordEnd + 3
  const languageEnd = data.indexOf(0, offset)
  if (languageEnd < 0) return null
  offset = languageEnd + 1
  const translatedKeywordEnd = data.indexOf(0, offset)
  if (translatedKeywordEnd < 0) return null
  offset = translatedKeywordEnd + 1

  const textBytes = data.slice(offset)
  try {
    return compressionFlag === 1
      ? strFromU8(unzlibSync(textBytes))
      : strFromU8(textBytes)
  } catch {
    return null
  }
}

const parseSharePayload = (value: string): FavoriteSharePayload => {
  const parsed = JSON.parse(value) as unknown
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== FAVORITE_SHARE_SCHEMA_VERSION ||
    parsed.format !== 'favorite-share' ||
    typeof parsed.packageBase64 !== 'string'
  ) {
    throw new Error('Invalid favorite share payload')
  }
  return parsed as FavoriteSharePayload
}

export const readFavoriteSharePackage = (
  input: ArrayBuffer | Uint8Array | string,
): Uint8Array => {
  if (typeof input === 'string') {
    const parser = new DOMParser()
    const document = parser.parseFromString(input, 'text/html')
    const script = document.getElementById(FAVORITE_SHARE_HTML_SCRIPT_ID)
    if (!script?.textContent) {
      throw new Error('This HTML file does not contain GlobalCloud XiaoC favorite share data')
    }
    return base64ToBytes(parseSharePayload(script.textContent).packageBase64)
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const chunk = readPngTextChunk(bytes, FAVORITE_SHARE_PNG_TEXT_KEYWORD)
  if (!chunk) {
    throw new Error('This PNG file does not contain GlobalCloud XiaoC favorite share data. Use the original exported PNG file; screenshots or compressed images cannot be imported.')
  }
  return base64ToBytes(parseSharePayload(chunk).packageBase64)
}

export const looksLikeFavoriteShareHtml = (
  fileName: string | undefined,
  text: string,
): boolean => {
  const normalizedName = String(fileName || '').toLowerCase()
  return (
    normalizedName.endsWith('.html') ||
    normalizedName.endsWith('.htm') ||
    text.includes(FAVORITE_SHARE_HTML_SCRIPT_ID)
  ) && text.includes(FAVORITE_SHARE_SCHEMA_VERSION)
}

export const looksLikeFavoriteSharePng = (
  fileName: string | undefined,
  bytes: Uint8Array,
): boolean => {
  const normalizedName = String(fileName || '').toLowerCase()
  return (normalizedName.endsWith('.png') || isPng(bytes)) && readPngTextChunk(bytes, FAVORITE_SHARE_PNG_TEXT_KEYWORD) !== null
}
