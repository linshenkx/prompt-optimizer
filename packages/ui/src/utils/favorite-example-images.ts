import type { IImageStorageService } from '@prompt-optimizer/core'
import type { FavoriteReproducibilityDraft, FavoriteReproducibilityExample } from './favorite-reproducibility'
import { persistImagePayloadAsAssetId, persistImageSourceAsAssetId } from './image-asset-storage'

const dedupeStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

export const persistFavoriteExampleImages = async (
  draft: FavoriteReproducibilityDraft,
  favoriteStorage: IImageStorageService | null | undefined,
  workspaceStorage: IImageStorageService | null | undefined,
): Promise<FavoriteReproducibilityDraft> => {
  const preferred = favoriteStorage || workspaceStorage
  const fallback = workspaceStorage !== preferred ? workspaceStorage : undefined

  const persistSourcesForFavoriteAssets = async (sources: string[]) => {
    const normalizedSources = dedupeStrings(
      sources.map((item) => String(item || '').trim()).filter(Boolean),
    )
    const assetIds: string[] = []
    const fallbackSources: string[] = []

    for (const source of normalizedSources) {
      if (!preferred) {
        fallbackSources.push(source)
        continue
      }

      try {
        const assetId = await persistImageSourceAsAssetId({
          source,
          storageService: preferred,
          sourceType: 'uploaded',
        })

        if (assetId) {
          assetIds.push(assetId)
        } else {
          fallbackSources.push(source)
        }
      } catch (error) {
        console.warn('[Favorites] Failed to persist example image source:', error)
        fallbackSources.push(source)
      }
    }

    return {
      assetIds: dedupeStrings(assetIds),
      fallbackSources: dedupeStrings(fallbackSources),
    }
  }

  const ensureExampleAssetsInFavoriteStorage = async (ids: string[]): Promise<string[]> => {
    if (!preferred || !fallback || ids.length === 0) return ids
    if (typeof preferred.getMetadata !== 'function' || typeof fallback.getImage !== 'function') return ids

    const resolved: string[] = []
    for (const id of dedupeStrings(ids)) {
      try {
        if (await preferred.getMetadata(id)) {
          resolved.push(id)
          continue
        }
        const image = await fallback.getImage(id)
        if (!image) {
          resolved.push(id)
          continue
        }
        const copiedId = await persistImagePayloadAsAssetId({
          payload: { b64: image.data, mimeType: image.metadata.mimeType },
          storageService: preferred,
          sourceType: image.metadata.source,
        })
        resolved.push(copiedId || id)
      } catch (error) {
        console.warn('[Favorites] Failed to copy example image to favorite storage:', id, error)
        resolved.push(id)
      }
    }
    return resolved
  }

  const examples: FavoriteReproducibilityExample[] = []

  for (const example of draft.examples) {
    const exampleImages = await persistSourcesForFavoriteAssets(example.images || [])
    const inputImages = await persistSourcesForFavoriteAssets(example.inputImages || [])
    const copiedOutputIds = await ensureExampleAssetsInFavoriteStorage(example.imageAssetIds || [])
    const copiedInputIds = await ensureExampleAssetsInFavoriteStorage(example.inputImageAssetIds || [])

    examples.push({
      ...example,
      messages: example.messages?.map((message) => ({ ...message })) || [],
      parameters: { ...example.parameters },
      outputText: example.outputText,
      images: exampleImages.fallbackSources,
      imageAssetIds: dedupeStrings([
        ...copiedOutputIds,
        ...exampleImages.assetIds,
      ]),
      inputImages: inputImages.fallbackSources,
      inputImageAssetIds: dedupeStrings([
        ...copiedInputIds,
        ...inputImages.assetIds,
      ]),
      metadata: example.metadata ? { ...example.metadata } : undefined,
    })
  }

  return {
    variables: draft.variables.map((variable) => ({
      ...variable,
      options: [...variable.options],
    })),
    examples,
  }
}
