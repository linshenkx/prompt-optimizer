import { describe, expect, it } from 'vitest'
import {
  collectBackupImageReferences,
  findMissingBackupImageReferences,
} from '../../../src/utils/image-resource-references'

describe('backup business image references', () => {
  it('finds all workspace image shapes without mistaking prompt asset bindings for images', () => {
    const modes = ['basic-system', 'basic-user', 'pro-multi', 'pro-variable', 'image-text2image', 'image-image2image', 'image-multiimage']
    const sessions = Object.fromEntries(modes.map(mode => [mode, {
      assetBinding: { assetId: `prompt-asset-${mode}` },
      origin: { kind: 'asset', metadata: { assetId: 'also-a-prompt-asset' } },
      testVariantResults: { a: { images: [{ _type: 'image-ref', id: `${mode}-output` }] } },
    }]))
    Object.assign(sessions['basic-system'], { testImageAssetId: 'test-input' })
    Object.assign(sessions['image-image2image'], { inputImageId: 'single-input' })
    Object.assign(sessions['image-multiimage'], { inputImages: [{ id: 'ui-item-id', assetId: 'multi-input' }] })
    const references = collectBackupImageReferences(JSON.stringify({ version: 1, data: {
      workspaceSessions: { version: 1, sessions },
    } }), { favorites: [] })

    expect([...references.imageCache].sort()).toEqual([
      ...modes.map(mode => `${mode}-output`), 'test-input', 'single-input', 'multi-input',
    ].sort())
    expect(references.favoriteImages.size).toBe(0)
    expect([...references.imageCache]).not.toContain('ui-item-id')
  })

  it('finds favorite cover, version and example images and leaves URLs external', () => {
    const references = collectBackupImageReferences({}, JSON.stringify({ favorites: [{
      id: 'fav', metadata: {
        media: { coverAssetId: 'cover', assetIds: ['cover'], urls: ['https://example.test/external.png'] },
        promptAsset: {
          id: 'prompt-asset',
          versions: [{ content: { images: [{ kind: 'asset', assetId: 'version-input' }] } }],
          examples: [{ output: { images: [{ kind: 'asset', assetId: 'example-output' }] } }],
        },
        gardenSnapshot: { assets: { examples: [{ inputImageAssetIds: ['garden-input'] }] } },
      },
    }] }))
    expect([...references.favoriteImages].sort()).toEqual(['cover', 'example-output', 'garden-input', 'version-input'])
    expect(references.imageCache.size).toBe(0)
  })

  it('reports missing business references even if the metadata scan had no entries', () => {
    const references = collectBackupImageReferences({ workspaceSessions: { sessions: {
      'image-image2image': { inputImageId: 'gone' },
    } } }, { favorites: [{ metadata: { media: { coverAssetId: 'gone' } } }] })
    expect(findMissingBackupImageReferences(references, [])).toEqual([
      { store: 'imageCache', id: 'gone' }, { store: 'favoriteImages', id: 'gone' },
    ])
    expect(findMissingBackupImageReferences(references, [{ store: 'imageCache', id: 'gone' }])).toEqual([
      { store: 'favoriteImages', id: 'gone' },
    ])
  })
})
