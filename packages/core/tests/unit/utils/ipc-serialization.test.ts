import { describe, expect, it, vi } from 'vitest'
import { deepStrictEqual } from 'node:assert/strict'
import { safeSerializeArgs, safeSerializeForIPC } from '../../../src/utils/ipc-serialization'

describe('IPC serialization', () => {
  it('keeps explicit clears distinct from omitted and null fields across repeated serialization', () => {
    const input = { parentId: undefined, nested: { customHeaders: undefined, nullable: null }, enabled: false }
    const output = safeSerializeForIPC(safeSerializeForIPC(input))
    deepStrictEqual(output, input)
    expect(Object.hasOwn(output, 'parentId')).toBe(true)
    expect(Object.hasOwn(output, 'omitted')).toBe(false)
    expect(output).not.toBe(input)
    expect(output.nested).not.toBe(input.nested)
  })

  it('keeps clears in nested array objects and shared references', () => {
    const shared = { clear: undefined, keep: 'value' }
    const output = safeSerializeForIPC({ left: shared, right: [shared] })
    expect(output).toStrictEqual({ left: shared, right: [shared] })
    expect(output.left).not.toBe(output.right[0])
  })

  it('unwraps proxies and preserves existing JSON conversions', () => {
    const input = new Proxy({
      clear: undefined,
      date: new Date('2026-01-01T00:00:00.000Z'),
      number: NaN,
      callback: () => {},
      items: [undefined, () => {}, Infinity, { clear: undefined }],
    }, {})
    expect(safeSerializeForIPC(input)).toStrictEqual({
      clear: undefined,
      date: '2026-01-01T00:00:00.000Z',
      number: null,
      items: [null, null, null, { clear: undefined }],
    })
  })

  it('reads getters once and respects toJSON output', () => {
    const getter = vi.fn(() => undefined)
    const input = { get clear() { return getter() }, value: { toJSON: () => ({ clear: undefined }) } }
    expect(safeSerializeForIPC(input)).toStrictEqual({ clear: undefined, value: { clear: undefined } })
    expect(getter).toHaveBeenCalledOnce()
  })

  it('preserves empty and prototype-like keys as own data without changing prototypes', () => {
    const input = JSON.parse('{"__proto__":{},"constructor":{},"":{}}')
    for (const value of Object.values(input) as Record<string, unknown>[]) value.clear = undefined
    Object.defineProperty(input, '__proto__', { value: undefined, enumerable: true })
    Object.defineProperty(input, 'prototype', { value: undefined, enumerable: true })
    const output = safeSerializeForIPC(input)
    deepStrictEqual(output, input)
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype)
    expect(Object.hasOwn(output, '__proto__')).toBe(true)
    expect(Object.hasOwn(output, 'prototype')).toBe(true)
    expect(({} as Record<string, unknown>).clear).toBeUndefined()
  })

  it('keeps argument positions and primitive values', () => {
    expect(safeSerializeArgs('id', undefined, null, { clear: undefined })).toStrictEqual([
      'id', undefined, null, { clear: undefined },
    ])
  })

  it.each(['cycle', 'bigint'])('rejects unsupported %s payloads with the existing error code', (kind) => {
    const input: Record<string, unknown> = kind === 'cycle' ? {} : { value: 1n }
    if (kind === 'cycle') input.self = input
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => safeSerializeForIPC(input)).toThrow(expect.objectContaining({ code: 'error.core.ipc_serialization_failed' }))
    } finally {
      log.mockRestore()
    }
  })
})
