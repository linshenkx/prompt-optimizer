import { describe, expect, it, vi } from 'vitest'
import { CORE_ERROR_CODES } from '../../../src/constants/error-codes'
import {
  debugIPCSerializability,
  safeSerializeArgs,
  safeSerializeForIPC,
} from '../../../src/utils/ipc-serialization'

describe('IPC serialization utilities', () => {
  it('returns null, undefined, and primitive values without conversion', () => {
    expect(safeSerializeForIPC(null)).toBeNull()
    expect(safeSerializeForIPC(undefined)).toBeUndefined()
    expect(safeSerializeForIPC('小词')).toBe('小词')
    expect(safeSerializeForIPC(42)).toBe(42)
    expect(safeSerializeForIPC(true)).toBe(true)
  })

  it('converts complex payloads to plain serializable values', () => {
    const createdAt = new Date('2026-06-06T00:00:00.000Z')
    const original = {
      name: 'XC',
      nested: { enabled: true },
      createdAt,
      omitted: undefined,
    }

    const serialized = safeSerializeForIPC(original)

    expect(serialized).toEqual({
      name: 'XC',
      nested: { enabled: true },
      createdAt: '2026-06-06T00:00:00.000Z',
    })
    expect(serialized).not.toBe(original)
    expect(serialized.nested).not.toBe(original.nested)
  })

  it('throws a structured IPC serialization error for circular objects', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const circular: Record<string, unknown> = { name: 'XC' }
    circular.self = circular

    expect(() => safeSerializeForIPC(circular)).toThrow(/Failed to serialize object for IPC/)

    try {
      safeSerializeForIPC(circular)
    } catch (error) {
      expect(error).toMatchObject({
        name: 'IpcSerializationError',
        code: CORE_ERROR_CODES.IPC_SERIALIZATION_FAILED,
      })
      expect((error as { params?: { details?: string } }).params?.details).toContain(
        'Failed to serialize object for IPC',
      )
    }

    consoleError.mockRestore()
  })

  it('serializes multiple IPC arguments independently', () => {
    const [first, second, third] = safeSerializeArgs(
      { id: 'prompt-1', value: undefined },
      ['wiki', 'mcp'],
      'plain',
    )

    expect(first).toEqual({ id: 'prompt-1' })
    expect(second).toEqual(['wiki', 'mcp'])
    expect(third).toBe('plain')
  })

  it('logs serializability diagnostics for valid and invalid payloads', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const circular: Record<string, unknown> = { name: 'XC' }
    circular.self = circular

    debugIPCSerializability({ ok: true }, 'validPayload')
    debugIPCSerializability(circular, 'invalidPayload')

    expect(consoleLog).toHaveBeenCalledWith('[IPC Debug] validPayload is serializable')
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[IPC Debug] invalidPayload is NOT serializable:'),
      expect.any(TypeError),
    )
    expect(consoleError).toHaveBeenCalledWith('[IPC Debug] Object:', circular)

    consoleLog.mockRestore()
    consoleError.mockRestore()
  })
})
