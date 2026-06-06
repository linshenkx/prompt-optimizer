import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isStandardLlmInputMimeType,
  normalizeImageInputForLlm,
  normalizeImageInputsForLlm,
} from '../../../src/services/image/input-normalizer'
import type { ImageInputRef } from '../../../src/services/image/types'

describe('image input normalizer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recognizes supported LLM image mime types and treats missing mime as compatible', () => {
    expect(isStandardLlmInputMimeType()).toBe(true)
    expect(isStandardLlmInputMimeType(' image/png ')).toBe(true)
    expect(isStandardLlmInputMimeType('IMAGE/JPEG')).toBe(true)
    expect(isStandardLlmInputMimeType('image/webp')).toBe(false)
  })

  it('normalizes image/jpg to image/jpeg without changing other fields', async () => {
    const input = { b64: 'abc', mimeType: ' image/jpg ', source: 'upload' }

    await expect(normalizeImageInputForLlm(input)).resolves.toEqual({
      b64: 'abc',
      mimeType: 'image/jpeg',
      source: 'upload',
    })
  })

  it('returns standard inputs unchanged by reference', async () => {
    const input = { b64: 'abc', mimeType: 'image/png' }

    const normalized = await normalizeImageInputForLlm(input)

    expect(normalized).toBe(input)
  })

  it('uses a custom converter for unsupported mime types and strips data URL prefixes', async () => {
    const converter = vi.fn(async () => ({
      b64: 'data:image/png;base64,Y29udmVydGVk',
      mimeType: '',
    }))

    const normalized = await normalizeImageInputForLlm(
      { b64: 'original', mimeType: 'image/webp', id: 'input-1' },
      { imageInputConverter: converter },
    )

    expect(converter).toHaveBeenCalledWith({ b64: 'original', mimeType: 'image/webp' })
    expect(normalized).toEqual({
      b64: 'Y29udmVydGVk',
      mimeType: 'image/png',
      id: 'input-1',
    })
  })

  it('keeps the original input when conversion fails or returns unusable data', async () => {
    const input = { b64: 'original', mimeType: 'image/webp' }
    const tooLarge = 'a'.repeat(14 * 1024 * 1024)

    await expect(
      normalizeImageInputForLlm(input, { imageInputConverter: async () => null }),
    ).resolves.toBe(input)
    await expect(
      normalizeImageInputForLlm(input, { imageInputConverter: async () => ({ b64: '', mimeType: 'image/png' }) }),
    ).resolves.toBe(input)
    await expect(
      normalizeImageInputForLlm(input, { imageInputConverter: async () => ({ b64: tooLarge, mimeType: 'image/png' }) }),
    ).resolves.toBe(input)
    await expect(
      normalizeImageInputForLlm(input, {
        imageInputConverter: async () => {
          throw new Error('converter failed')
        },
      }),
    ).resolves.toBe(input)
  })

  it('normalizes batches and preserves undefined batch input', async () => {
    const converter = vi.fn(async (input: ImageInputRef) => ({
      b64: `${input.b64}-converted`,
      mimeType: 'image/png',
    }))

    await expect(normalizeImageInputsForLlm(undefined, { imageInputConverter: converter })).resolves.toBeUndefined()
    await expect(
      normalizeImageInputsForLlm(
        [
          { b64: 'one', mimeType: 'image/webp' },
          { b64: 'two', mimeType: 'image/png' },
        ],
        { imageInputConverter: converter },
      ),
    ).resolves.toEqual([
      { b64: 'one-converted', mimeType: 'image/png' },
      { b64: 'two', mimeType: 'image/png' },
    ])
    expect(converter).toHaveBeenCalledTimes(1)
  })

  it('falls back to the original input when browser canvas conversion is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('OffscreenCanvas', undefined)

    const input = { b64: 'd2VicA==', mimeType: 'image/webp' }

    await expect(normalizeImageInputForLlm(input)).resolves.toBe(input)
  })

  it('keeps original browser inputs when base64 decoding or canvas rendering cannot produce PNG data', async () => {
    const input = { b64: '', mimeType: 'image/webp' }
    vi.stubGlobal('createImageBitmap', vi.fn())
    vi.stubGlobal('document', { createElement: vi.fn() })
    vi.stubGlobal('OffscreenCanvas', undefined)

    await expect(normalizeImageInputForLlm(input)).resolves.toBe(input)
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
    vi.stubGlobal('atob', undefined)
    vi.stubGlobal('createImageBitmap', vi.fn())
    vi.stubGlobal('document', { createElement: vi.fn() })
    vi.stubGlobal('OffscreenCanvas', undefined)

    await expect(normalizeImageInputForLlm({ b64: 'AQID', mimeType: 'image/webp' })).resolves.toEqual({
      b64: 'AQID',
      mimeType: 'image/webp',
    })
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
    vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'))
    vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'))
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 1,
        height: 1,
        close: vi.fn(),
      })),
    )
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => null),
      })),
    })
    vi.stubGlobal('OffscreenCanvas', undefined)

    await expect(normalizeImageInputForLlm({ b64: 'AQID', mimeType: 'image/webp' })).resolves.toEqual({
      b64: 'AQID',
      mimeType: 'image/webp',
    })
  })

  it('converts unsupported browser inputs through canvas when browser APIs are available', async () => {
    const drawImage = vi.fn()
    const close = vi.fn()
    const outputBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })

    vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'))
    vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'))
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 12,
        height: 8,
        close,
      })),
    )
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage })),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(outputBlob)),
      })),
    })
    vi.stubGlobal('OffscreenCanvas', undefined)

    const normalized = await normalizeImageInputForLlm({
      b64: 'data:image/webp;base64,AQID',
      mimeType: 'image/webp',
    })

    expect(globalThis.createImageBitmap).toHaveBeenCalledWith(expect.any(Blob))
    expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 12, height: 8 }), 0, 0)
    expect(close).toHaveBeenCalled()
    expect(normalized).toEqual({
      b64: 'AQID',
      mimeType: 'image/png',
    })
  })

  it('uses OffscreenCanvas when document is unavailable', async () => {
    const drawImage = vi.fn()
    const close = vi.fn()
    const outputBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' })
    const convertToBlob = vi.fn(async () => outputBlob)

    vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'))
    vi.stubGlobal('btoa', (value: string) => Buffer.from(value, 'binary').toString('base64'))
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 20,
        height: 10,
        close,
      })),
    )
    vi.stubGlobal('document', undefined)
    const OffscreenCanvasMock = vi.fn(function (this: {
      getContext: () => { drawImage: typeof drawImage }
      convertToBlob: typeof convertToBlob
    }) {
      this.getContext = vi.fn(() => ({ drawImage }))
      this.convertToBlob = convertToBlob
    })
    vi.stubGlobal('OffscreenCanvas', OffscreenCanvasMock)

    const normalized = await normalizeImageInputForLlm({ b64: 'BAUG', mimeType: 'image/avif' })

    expect(OffscreenCanvasMock).toHaveBeenCalledWith(20, 10)
    expect(drawImage).toHaveBeenCalledWith(expect.objectContaining({ width: 20, height: 10 }), 0, 0)
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/png' })
    expect(close).toHaveBeenCalled()
    expect(normalized).toEqual({
      b64: 'BAUG',
      mimeType: 'image/png',
    })
  })

  it('keeps original input when browser conversion encodes an empty result', async () => {
    vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'))
    vi.stubGlobal('btoa', undefined)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 1,
        height: 1,
        close: vi.fn(),
      })),
    )
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(new Blob([new Uint8Array([1])]))),
      })),
    })
    vi.stubGlobal('OffscreenCanvas', undefined)

    const input = { b64: 'AQ==', mimeType: 'image/webp' }

    await expect(normalizeImageInputForLlm(input)).resolves.toBe(input)
  })
})
