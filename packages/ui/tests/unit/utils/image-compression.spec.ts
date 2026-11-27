import { describe, expect, it, vi } from 'vitest'
import {
  compressImageFile,
  imageInputRefToFile,
  prepareImageFiles,
  type ImageCompressionRuntime,
} from '../../../src/utils/image-compression'

const createFile = (size: number, type = 'image/jpeg') =>
  new File([new Uint8Array(size)], 'large-image.jpg', { type, lastModified: 123 })

const createRuntime = (encodedSizes: number[], dimensions = { width: 6000, height: 4000 }) => {
  const dispose = vi.fn()
  let encodeIndex = 0
  const runtime: ImageCompressionRuntime = {
    decode: vi.fn(async () => ({
      source: {} as CanvasImageSource,
      width: dimensions.width,
      height: dimensions.height,
      dispose,
    })),
    encode: vi.fn(async (_image, _width, _height, mimeType) => {
      const size = encodedSizes[Math.min(encodeIndex, encodedSizes.length - 1)]
      encodeIndex += 1
      return new Blob([new Uint8Array(size)], { type: mimeType })
    }),
  }

  return { runtime, dispose }
}

describe('compressImageFile', () => {
  it('keeps files within both byte and dimension limits unchanged', async () => {
    const file = createFile(80)
    const { runtime, dispose } = createRuntime([50], { width: 1000, height: 800 })

    const result = await compressImageFile(file, { maxBytes: 100, runtime })

    expect(result.file).toBe(file)
    expect(result.compressed).toBe(false)
    expect(result.requiresConfirmation).toBe(false)
    expect(runtime.decode).toHaveBeenCalledOnce()
    expect(runtime.encode).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('compresses an oversized image and preserves its file metadata', async () => {
    const file = createFile(200)
    const { runtime, dispose } = createRuntime([150, 90])

    const result = await compressImageFile(file, {
      maxBytes: 100,
      maxDimension: 4000,
      runtime,
    })

    expect(result.compressed).toBe(true)
    expect(result.file.name).toBe(file.name)
    expect(result.file.type).toBe(file.type)
    expect(result.file.lastModified).toBe(file.lastModified)
    expect(result.outputBytes).toBe(90)
    expect(result.outputWidth).toBe(4000)
    expect(result.outputHeight).toBe(2667)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.confirmationReasons).toContain('dimensions')
    expect(runtime.encode).toHaveBeenCalledTimes(2)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('releases decoded image resources when compression fails', async () => {
    const file = createFile(200, 'image/png')
    const { runtime, dispose } = createRuntime([200])

    await expect(compressImageFile(file, {
      maxBytes: 100,
      maxDimension: 256,
      runtime,
    })).rejects.toThrow('Unable to compress image')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('requires confirmation when JPEG quality drops below 0.8', async () => {
    const file = createFile(200)
    const { runtime } = createRuntime([200, 190, 180, 90], { width: 1000, height: 800 })

    const result = await compressImageFile(file, { maxBytes: 100, runtime })

    expect(result.outputQuality).toBeCloseTo(0.75)
    expect(result.requiresConfirmation).toBe(true)
    expect(result.confirmationReasons).toContain('quality')
  })

  it('asks once for a batch and leaves all inputs untouched when cancelled', async () => {
    const first = createFile(200)
    const second = new File([new Uint8Array(200)], 'second.jpg', { type: 'image/jpeg' })
    const { runtime } = createRuntime([90], { width: 6000, height: 4000 })
    const confirm = vi.fn().mockResolvedValue(false)

    const result = await prepareImageFiles([first, second], confirm, {
      maxBytes: 100,
      maxDimension: 4000,
      runtime,
    })

    expect(result).toBeNull()
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0][0]).toHaveLength(2)
  })
})

describe('image input conversion', () => {

  it('turns a stored input reference back into a typed file for batch rebalancing', async () => {
    const file = imageInputRefToFile({ b64: 'AQIDBA==', mimeType: 'image/jpeg' }, 2)

    expect(file.name).toBe('image-3.jpg')
    expect(file.type).toBe('image/jpeg')
    expect(file.size).toBe(4)
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([1, 2, 3, 4])
  })
})
