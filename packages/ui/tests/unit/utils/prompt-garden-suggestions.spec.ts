import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildPromptGardenSuggestionsUrl,
  fetchPromptGardenSuggestions,
  fetchPromptGardenCatalog,
  fetchPromptGardenPreview,
} from '../../../src/utils/prompt-garden-suggestions'

describe('prompt-garden-suggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds a lightweight suggestions URL with mode, strategy, exclude, and locale', () => {
    const url = buildPromptGardenSuggestionsUrl({
      gardenBaseUrl: 'https://garden.always200.com/',
      mode: 'image-image2image',
      limit: 3,
      strategy: 'mixed',
      exclude: ['NB-001', 'NB-002', 'NB-001'],
      locale: 'zh-CN',
    })

    expect(url).toBe(
      'https://garden.always200.com/api/public/prompts/suggestions?mode=image-image2image&limit=3&strategy=mixed&exclude=NB-001%2CNB-002&locale=zh-CN',
    )
  })

  it('normalizes valid suggestion cards and drops invalid items', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'prompt-1',
            title: 'Cinematic portrait',
            summary: 'Keep the subject and improve lighting.',
            tags: ['portrait', 'cinematic', 'portrait'],
            importCode: 'NB-001',
            mode: 'image-image2image',
            thumbnailUrl: '/prompt-assets/thumb.webp',
            previewUrl: '/prompt-assets/preview.webp',
            source: 'latest',
          },
          {
            id: 'prompt-2',
            title: 'Curated style transfer',
            summary: 'Featured by Garden before random fill.',
            tags: ['featured'],
            importCode: 'NB-002',
            mode: 'image-image2image',
            source: 'featured',
          },
          {
            id: 'missing-code',
            title: 'Invalid',
            summary: 'No code',
          },
        ],
        browseUrl: '/prompts?mode=image-image2image',
        nextExclude: ['NB-001', 'NB-002'],
        ttlSeconds: 120,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPromptGardenSuggestions({
      gardenBaseUrl: 'https://garden.always200.com',
      mode: 'image-image2image',
      timeoutMs: 1000,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://garden.always200.com/api/public/prompts/suggestions?mode=image-image2image&limit=3&strategy=mixed',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    )
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: 'prompt-1',
      importCode: 'NB-001',
      tags: ['portrait', 'cinematic'],
      thumbnailUrl: 'https://garden.always200.com/prompt-assets/thumb.webp',
      previewUrl: 'https://garden.always200.com/prompt-assets/preview.webp',
    })
    expect(result.items[1]).toMatchObject({
      id: 'prompt-2',
      importCode: 'NB-002',
      source: 'featured',
    })
    expect(result.browseUrl).toBe(
      'https://garden.always200.com/prompts?mode=image-image2image',
    )
    expect(result.nextExclude).toEqual(['NB-001', 'NB-002'])
    expect(result.ttlSeconds).toBe(120)
  })

  it('falls back to a mode-scoped browse URL when Garden omits browseUrl', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      }),
    )

    const result = await fetchPromptGardenSuggestions({
      gardenBaseUrl: 'https://garden.always200.com',
      mode: 'image-text2image',
    })

    expect(result.items).toEqual([])
    expect(result.browseUrl).toBe(
      'https://garden.always200.com/prompts?mode=image-text2image',
    )
  })
  it('requests a stable catalog page with an encoded search, and normalizes image and text metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'BM-1',
            title: 'Coal',
            summary: 'Reasoning',
            excerpt: 'The full question starts here',
            categoryPath: ['Evaluation', 'Reasoning'],
            importCode: 'ZH-BM-1',
            thumbnailUrl: '/cover.webp',
          },
        ],
        total: 22,
        nextOffset: null,
        browseUrl: '/',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchPromptGardenCatalog({
      gardenBaseUrl: 'https://garden.example/',
      mode: 'arena',
      query: '煤 & 水',
      locale: 'zh-CN',
      offset: 20,
    })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/api/public/prompts/catalog')
    expect(url.searchParams.get('q')).toBe('煤 & 水')
    expect(url.searchParams.get('offset')).toBe('20')
    expect(result.items[0]).toMatchObject({
      excerpt: 'The full question starts here',
      categoryPath: ['Evaluation', 'Reasoning'],
      thumbnailUrl: 'https://garden.example/cover.webp',
    })
    expect(result.nextOffset).toBeNull()
  })

  it('rejects invalid catalog paging and reads full prompt text only from the existing source contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], total: 20, nextOffset: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schema: 'prompt-garden.prompt.v1',
          schemaVersion: 1,
          prompt: {
            format: 'messages',
            messages: [
              { content: 'System instructions' },
              { content: '<script>source only</script>' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchPromptGardenCatalog({
        gardenBaseUrl: 'https://garden.example',
        mode: 'arena',
      }),
    ).rejects.toThrow('pagination')
    await expect(
      fetchPromptGardenPreview('https://garden.example', 'ZH-BM-1'),
    ).resolves.toBe('System instructions\n\n<script>source only</script>')
    await expect(
      fetchPromptGardenPreview('https://garden.example', 'ZH-BM-2'),
    ).rejects.toThrow('503')
  })
})
