import { describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import type { FavoritePrompt } from '@prompt-optimizer/core'

import {
  DEFAULT_FAVORITE_SHARE_SECTIONS,
  createFavoriteShareFavorite,
  createFavoriteShareHtml,
  createFavoriteSharePng,
  insertPngInternationalTextChunk,
  insertPngTextChunk,
  readFavoriteSharePackage,
  readPngTextChunk,
} from '../../../src/utils/favorite-share-export'

const createFavorite = (): FavoritePrompt => ({
  id: 'fav-1',
  title: 'Private image prompt',
  description: 'Private description',
  content: 'Private prompt content',
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  tags: ['private'],
  category: 'secret-category',
  useCount: 0,
  functionMode: 'image',
  imageSubMode: 'text2image',
  metadata: {
    media: {
      coverAssetId: 'cover-asset',
    },
    originalContent: 'Raw private original',
    gardenSnapshot: {
      importCode: 'SECRET',
    },
    reproducibility: {
      variables: [
        {
          name: 'style',
          defaultValue: 'cinematic',
          required: false,
          options: [],
        },
      ],
      examples: [
        {
          text: 'Example that should not leak',
          parameters: { style: 'watercolor' },
          imageAssetIds: ['example-output'],
        },
      ],
    },
    promptAsset: {
      schemaVersion: 'prompt-model/v1',
      id: 'asset-1',
      title: 'Private image prompt',
      tags: ['private'],
      contract: {
        family: 'image',
        subMode: 'text2image',
        modeKey: 'image-text2image',
        variables: [{ name: 'style', required: false, options: [] }],
      },
      currentVersionId: 'v2',
      versions: [
        {
          id: 'v1',
          version: 1,
          content: { kind: 'image-prompt', text: 'Old private prompt' },
          createdAt: 1700000000000,
        },
        {
          id: 'v2',
          version: 2,
          content: { kind: 'image-prompt', text: 'Private prompt content' },
          createdAt: 1700000001000,
        },
      ],
      examples: [
        {
          id: 'example-1',
          basedOnVersionId: 'v2',
          input: { text: 'private example input' },
        },
      ],
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
    },
  },
})

const createGardenFavorite = (): FavoritePrompt => ({
  id: 'garden-fav',
  title: 'Garden image prompt',
  description: 'Garden description',
  content: 'Generate {{subject}} in {{scene}}',
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  tags: ['garden'],
  useCount: 0,
  functionMode: 'image',
  imageSubMode: 'text2image',
  metadata: {
    gardenSnapshot: {
      schema: 'prompt-garden.prompt.v1',
      schemaVersion: 1,
      importCode: 'ZH-T2I-006',
      gardenBaseUrl: 'https://garden.always200.com',
      optimizerTarget: {
        subModeKey: 'image-text2image',
      },
      prompt: {
        format: 'text',
        text: 'Generate {{subject}} in {{scene}}',
      },
      variables: [
        {
          name: 'subject',
          description: 'Main subject',
          required: true,
        },
      ],
      assets: {
        examples: [
          {
            id: 'ex-001',
            url: 'https://garden.example/output.webp',
            images: ['https://garden.example/output.webp'],
            imageAssetIds: ['garden-output'],
            inputImages: ['https://garden.example/input.png'],
            inputImageAssetIds: ['garden-input'],
            description: '来源气质复现示例',
            parameters: {
              subject: 'paper doll',
              scene: 'macro book',
            },
          },
        ],
      },
      meta: {
        title: 'Garden image prompt',
        description: 'Garden meta description',
        tags: ['paper doll'],
      },
      importedAt: new Date(1700000000000).toISOString(),
    },
  },
})

const readFavoritesFromPackageBytes = (bytes: Uint8Array) => {
  const files = unzipSync(bytes)
  return JSON.parse(strFromU8(files['favorites.json']))
}

const createMinimalPng = (): Uint8Array => new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00,
  0x90, 0x77, 0x53, 0xde,
  0x00, 0x00, 0x00, 0x00,
  0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
])

const readPngChunkTypes = (bytes: Uint8Array): string[] => {
  const decoder = new TextDecoder()
  const types: string[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
    types.push(decoder.decode(bytes.slice(offset + 4, offset + 8)))
    offset += 12 + length
  }
  return types
}

describe('favorite share export', () => {
  it('filters the importable favorite with WYSIWYG section semantics', () => {
    const favorite = createFavoriteShareFavorite(createFavorite(), {
      ...DEFAULT_FAVORITE_SHARE_SECTIONS,
      description: false,
      content: false,
      tags: false,
      media: false,
      variables: false,
      examples: false,
      versions: false,
    })

    expect(favorite.description).toBeUndefined()
    expect(favorite.content).toBe('')
    expect(favorite.tags).toEqual([])
    expect(favorite.category).toBeUndefined()
    expect(favorite.metadata?.media).toBeUndefined()
    expect(favorite.metadata?.originalContent).toBeUndefined()
    expect(favorite.metadata?.gardenSnapshot).toBeUndefined()
    expect((favorite.metadata?.reproducibility as any)?.variables).toEqual([])
    expect((favorite.metadata?.reproducibility as any)?.examples).toEqual([])

    const promptAsset = favorite.metadata?.promptAsset as any
    expect(promptAsset.contract.variables).toEqual([])
    expect(promptAsset.examples).toEqual([])
    expect(promptAsset.versions).toHaveLength(1)
    expect(promptAsset.versions[0].id).toBe('v2')
    expect(promptAsset.versions[0].content.text).toBe('')
  })

  it('embeds a filtered package in independent HTML', async () => {
    const { blob } = await createFavoriteShareHtml({
      favorite: createFavorite(),
      sections: {
        ...DEFAULT_FAVORITE_SHARE_SECTIONS,
        examples: false,
        versions: false,
      },
      branding: {
        projectName: 'GlobalCloud XiaoC',
        projectUrl: 'https://example.test',
      },
      imageStorageServices: [],
    })

    const html = await blob.text()
    expect(html).toContain('Private image prompt')
    expect(html).toContain('GlobalCloud XiaoC')
    expect(html).toContain('https://prompt.always200.com/')
    expect(html).toContain('Favorites -&gt; Import -&gt; upload this HTML file')

    const packageBytes = readFavoriteSharePackage(html)
    const exported = readFavoritesFromPackageBytes(packageBytes)
    const favorite = exported.favorites[0]
    expect(favorite.title).toBe('Private image prompt')
    expect(favorite.metadata.reproducibility.examples).toEqual([])
    expect(favorite.metadata.promptAsset.examples).toEqual([])
    expect(favorite.metadata.promptAsset.versions).toHaveLength(1)
  })

  it('localizes visible HTML share labels when labels are provided', async () => {
    const { blob } = await createFavoriteShareHtml({
      favorite: createFavorite(),
      sections: {
        ...DEFAULT_FAVORITE_SHARE_SECTIONS,
        examples: false,
        versions: false,
      },
      labels: {
        htmlLang: 'zh-CN',
        documentTitleSuffix: 'GlobalCloud XiaoC 收藏分享',
        eyebrow: 'GlobalCloud XiaoC 收藏分享',
        metaPrefix: '收藏分享',
        headerImportNote: '导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传此 HTML 文件。',
        copyButton: '复制',
        copiedButton: '已复制',
        copyFailedButton: '复制失败',
        descriptionTitle: '描述',
        promptTitle: '提示词正文',
        tagsTitle: '标签',
        modeTitle: '模式',
        variablesTitle: '变量',
        importNoteTitle: '导入说明',
        htmlImportNoteBody1: '导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传此 HTML 文件。',
        htmlImportNoteBody2: '请使用原始 HTML 文件恢复数据。',
      },
      imageStorageServices: [],
    })

    const html = await blob.text()
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('GlobalCloud XiaoC 收藏分享')
    expect(html).toContain('<h2>导入说明</h2>')
    expect(html).toContain('导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传此 HTML 文件。')
    expect(html).toContain('data-copy-button>复制</button>')
    expect(html).toContain("setButtonText(target, \"已复制\")")
  })

  it('preserves sanitized Garden example media and renders HTML copy controls', async () => {
    const imageStorageService = {
      getImage: vi.fn(async (assetId: string) => {
        if (assetId === 'garden-output') {
          return {
            data: 'b3V0cHV0',
            metadata: {
              mimeType: 'image/png',
              createdAt: 1700000000000,
              source: 'uploaded',
            },
          }
        }
        if (assetId === 'garden-input') {
          return {
            data: 'aW5wdXQ=',
            metadata: {
              mimeType: 'image/png',
              createdAt: 1700000000000,
              source: 'uploaded',
            },
          }
        }
        return null
      }),
    }

    const { blob } = await createFavoriteShareHtml({
      favorite: createGardenFavorite(),
      sections: DEFAULT_FAVORITE_SHARE_SECTIONS,
      imageStorageServices: [imageStorageService],
    })

    const html = await blob.text()
    expect(html).toContain('来源气质复现示例')
    expect(html).toContain('https://garden.example/output.webp')
    expect(html).toContain('data:image/png;base64,b3V0cHV0')
    expect(html).toContain('data-copy-button')

    const packageBytes = readFavoriteSharePackage(html)
    const exported = readFavoritesFromPackageBytes(packageBytes)
    const example = exported.favorites[0].metadata.gardenSnapshot.assets.examples[0]
    expect(example.imageAssetIds).toEqual(['garden-output'])
    expect(example.inputImageAssetIds).toEqual(['garden-input'])
    expect(example.parameters.subject).toBe('paper doll')
  })

  it('strips Garden example images when media is not selected', () => {
    const favorite = createFavoriteShareFavorite(createGardenFavorite(), {
      ...DEFAULT_FAVORITE_SHARE_SECTIONS,
      media: false,
    })

    const example = (favorite.metadata?.gardenSnapshot as any).assets.examples[0]
    expect(example.parameters.subject).toBe('paper doll')
    expect(example.images).toBeUndefined()
    expect(example.imageAssetIds).toBeUndefined()
    expect(example.inputImages).toBeUndefined()
    expect(example.inputImageAssetIds).toBeUndefined()
  })

  it('can read legacy PNG tEXt metadata chunks', () => {
    const png = createMinimalPng()
    const withChunk = insertPngTextChunk(png, 'PromptOptimizerFavoriteShare', '{"ok":true}')

    expect(readPngTextChunk(withChunk, 'PromptOptimizerFavoriteShare')).toBe('{"ok":true}')
  })

  it('writes and reads PNG iTXt metadata chunks with UTF-8 JSON', () => {
    const png = createMinimalPng()
    const payload = JSON.stringify({ ok: true, favoriteTitle: '纸偶微距童话 🧚' })
    const withChunk = insertPngInternationalTextChunk(png, 'PromptOptimizerFavoriteShare', payload)

    expect(readPngTextChunk(withChunk, 'PromptOptimizerFavoriteShare')).toBe(payload)
  })

  it('reads uncompressed PNG iTXt metadata chunks', () => {
    const png = createMinimalPng()
    const payload = JSON.stringify({ ok: true, favoriteTitle: '收藏分享' })
    const withChunk = insertPngInternationalTextChunk(png, 'PromptOptimizerFavoriteShare', payload, {
      compressed: false,
    })

    expect(readPngTextChunk(withChunk, 'PromptOptimizerFavoriteShare')).toBe(payload)
  })

  it('embeds an importable package in the original PNG export', async () => {
    const fillText = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        font: '',
        fillStyle: '',
        measureText: (text: string) => ({ width: text.length * 12 }),
        fillRect: vi.fn(),
        fillText,
      }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(new Blob([createMinimalPng()], { type: 'image/png' }))
      },
    } as unknown as HTMLCanvasElement

    const { blob } = await createFavoriteSharePng({
      favorite: createFavorite(),
      sections: {
        ...DEFAULT_FAVORITE_SHARE_SECTIONS,
        content: false,
        examples: false,
      },
      imageStorageServices: [],
      canvasFactory: () => canvas,
    })

    const packageBytes = readFavoriteSharePackage(await blob.arrayBuffer())
    const chunkTypes = readPngChunkTypes(new Uint8Array(await blob.arrayBuffer()))
    const exported = readFavoritesFromPackageBytes(packageBytes)
    expect(chunkTypes).toContain('iTXt')
    expect(chunkTypes).not.toContain('tEXt')
    expect(exported.favorites[0].content).toBe('')
    expect(exported.favorites[0].metadata.reproducibility.examples).toEqual([])
    expect(fillText).toHaveBeenCalledWith('IMPORT NOTE', expect.any(Number), expect.any(Number))
    expect(fillText).toHaveBeenCalledWith(
      expect.stringContaining('https://prompt.always200.com/'),
      expect.any(Number),
      expect.any(Number),
    )
    expect(fillText).toHaveBeenCalledWith(
      expect.stringContaining('Use the original image'),
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('localizes visible PNG share labels when labels are provided', async () => {
    const fillText = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        font: '',
        fillStyle: '',
        measureText: (text: string) => ({ width: text.length * 12 }),
        fillRect: vi.fn(),
        fillText,
      }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(new Blob([createMinimalPng()], { type: 'image/png' }))
      },
    } as unknown as HTMLCanvasElement

    await createFavoriteSharePng({
      favorite: createFavorite(),
      sections: {
        ...DEFAULT_FAVORITE_SHARE_SECTIONS,
        examples: false,
      },
      labels: {
        pngHeaderBadge: 'GlobalCloud XiaoC 收藏分享',
        descriptionTitle: '描述',
        promptTitle: '提示词正文',
        tagsTitle: '标签',
        modeTitle: '模式',
        variablesTitle: '变量',
        importNoteTitle: '导入说明',
        pngImportNoteText: '导入：访问 https://prompt.always200.com/ → 收藏夹 → 导入 → 上传原始 PNG 文件。\n必须使用原图。',
      },
      imageStorageServices: [],
      canvasFactory: () => canvas,
    })

    expect(fillText).toHaveBeenCalledWith('GlobalCloud XiaoC 收藏分享', expect.any(Number), expect.any(Number))
    expect(fillText).toHaveBeenCalledWith('导入说明', expect.any(Number), expect.any(Number))
    expect(fillText).toHaveBeenCalledWith(
      expect.stringContaining('上传原始 PNG 文件'),
      expect.any(Number),
      expect.any(Number),
    )
  })
})
