import { describe, expect, it, vi } from 'vitest'

import { DataImportExportManager } from '../../../src/services/DataImportExportManager'
import type { StandardPromptData } from '../../../src/types'

const sampleData: StandardPromptData = {
  messages: [
    {
      role: 'user',
      content: 'Hello',
    },
  ],
  metadata: {},
}

describe('DataImportExportManager errors', () => {
  it('returns actionable errors without Unknown error for empty clipboard input', () => {
    const manager = new DataImportExportManager()

    const result = manager.importFromClipboard('')

    expect(result.success).toBe(false)
    expect(result.error).toBe('No text provided')
    expect(result.error).not.toContain('Unknown error')
  })

  it('returns parse details without Unknown error for invalid clipboard JSON', () => {
    const manager = new DataImportExportManager()

    const result = manager.importFromClipboard('{bad json')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid JSON format')
    expect(result.error).not.toContain('Unknown error')
  })

  it('returns unsupported format details without Unknown error', () => {
    const manager = new DataImportExportManager()

    const result = manager.importFromClipboard('{"not":"a supported prompt format"}')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown or unsupported data format. Detected: unknown')
    expect(result.error).not.toContain('Unknown error')
  })

  it('throws export errors without Unknown error details', () => {
    const manager = new DataImportExportManager()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('blob url unavailable')
    })
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    expect(() => manager.exportToFile(sampleData, 'standard')).toThrow(
      'Export failed: blob url unavailable',
    )

    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    consoleError.mockRestore()
  })
})
