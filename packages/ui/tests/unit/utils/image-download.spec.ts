import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildImageDownloadFilename,
  downloadImageSource,
} from '../../../src/utils/image-download'

describe('downloadImageSource', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds timestamped filenames with the prompt-optimizer prefix by default', () => {
    expect(
      buildImageDownloadFilename({
        src: 'data:image/png;base64,QUJD',
        now: new Date(2026, 3, 2, 15, 16, 17, 89),
      }),
    ).toBe('prompt-optimizer-20260402-151617-089.png')

    expect(
      buildImageDownloadFilename({
        src: 'https://cdn.example.com/assets/render.final.webp?token=abc',
        now: new Date(2026, 3, 2, 15, 16, 17, 89),
      }),
    ).toBe('prompt-optimizer-20260402-151617-089.webp')
  })

  it('downloads an animated GIF without re-encoding its frames', async () => {
    const b64 = 'R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQAFAAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBFAABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7'
    const originalCreateElement = document.createElement.bind(document)
    const anchor = originalCreateElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
      tagName === 'a' ? anchor : originalCreateElement(tagName)
    )
    const createObjectURL = vi.fn(() => 'blob:gif-download')
    await downloadImageSource(`data:image/gif;base64,${b64}`, {
      urlApi: { createObjectURL, revokeObjectURL: vi.fn() },
    })
    expect(anchor.download).toMatch(/\.gif$/)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('image/gif')
    const reader = new FileReader()
    const downloaded = new Promise<string>(resolve => {
      reader.onload = () => resolve(String(reader.result))
    })
    reader.readAsDataURL(blob)
    expect(await downloaded).toBe(`data:image/gif;base64,${b64}`)
  })

  it('forces a named blob download for data urls instead of navigating to the data source', async () => {
    const originalCreateElement = document.createElement.bind(document)
    const anchor = originalCreateElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return anchor
        }
        return originalCreateElement(tagName)
      })

    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    const removeChildSpy = vi.spyOn(document.body, 'removeChild')

    const createObjectURL = vi.fn(() => 'blob:preview-download')
    const revokeObjectURL = vi.fn()

    await downloadImageSource('data:image/png;base64,QUJD', {
      now: new Date(2026, 3, 2, 15, 16, 17, 89),
      urlApi: {
        createObjectURL,
        revokeObjectURL,
      },
    })

    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(anchor.href).toBe('blob:preview-download')
    expect(anchor.download).toBe('prompt-optimizer-20260402-151617-089.png')
    expect(anchor.rel).toBe('noopener')
    expect(click).toHaveBeenCalledTimes(1)
    expect(appendChildSpy).toHaveBeenCalledWith(anchor)
    expect(removeChildSpy).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-download')
  })
})
