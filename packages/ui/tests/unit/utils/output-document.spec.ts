import { describe, expect, it, vi } from 'vitest'
import { reactive, ref, watch } from 'vue'
import { beginOutputStream, createOutputChannel, OutputInterruptedError, resolveOutputRecord, liveOutputValue, restoredOutputStatus } from '../../../src/utils/output-document'
import { createSessionSnapshotWriter } from '../../../src/stores/session/sessionPersistence'
import type { IPreferenceService } from '@prompt-optimizer/core'

describe('output document resource and publication contract', () => {
  it('publishes a plain producer record through the store proxy only at completion', () => {
    const record = { result: '', reasoning: '' }, store = reactive({ record })
    const changes = vi.fn()
    const stop = watch(() => store.record.result, changes, { flush: 'sync' })
    const stream = beginOutputStream(record)
    stream.onToken('complete text')
    expect(changes).not.toHaveBeenCalled()
    stream.finish()
    expect(changes).toHaveBeenCalledTimes(1)
    expect(store.record.result).toBe('complete text')
    stop()
  })
  it('does not let an obsolete run overwrite a newer optimization or edited draft', () => {
    const result = ref(''), reasoning = ref(''), owner = { $state: reactive({ optimizedPrompt: result, reasoning }) }
    const first = createOutputChannel(result, reasoning, owner).begin()
    first.onToken('old')
    const next = createOutputChannel(result, reasoning, owner).begin()
    expect(first.signal.aborted).toBe(true)
    first.finish()
    expect(result.value).toBe('')
    next.onToken('new')
    next.document.interrupt()
    next.finish()
    result.value = 'manual edit'
    expect(liveOutputValue(result)).toBeUndefined()
    expect(restoredOutputStatus('streaming')).toEqual({ status: 'cancelled' })
    expect(restoredOutputStatus('other')).toEqual({})
  })
  it('retains literal line endings and tiny chunks without keeping per-token history', () => {
    const record = { result: '', reasoning: '' }, stream = beginOutputStream(record)
    const source = "\r\n🐋 $& $`\r\n".repeat(1000)
    for (const token of source) stream.onToken(token)
    expect(stream.document.read('result')).toBe(source)
    stream.finish()
    expect(record.result).toBe(source)
  })
  it('keeps every delta outside reactive state and publishes once at completion', () => {
    const record = reactive({ result: '', reasoning: '' })
    const changes = vi.fn()
    const stop = watch(record, changes, { flush: 'sync' })
    const stream = beginOutputStream(record)
    changes.mockClear()
    const tokens = ['a', '\ud83d', '\ude00', '\n', "$& $' $`", ...Array(1000).fill('小鲸鱼\n')]
    for (const token of tokens) stream.onToken(token)
    stream.onReasoningToken('reason')
    expect(record.result).toBe('')
    expect(changes).not.toHaveBeenCalled()
    expect(resolveOutputRecord(record)).toMatchObject({ result: tokens.join(''), reasoning: 'reason', status: 'streaming' })
    stream.finish()
    expect(record.result).toBe(tokens.join(''))
    expect(changes).toHaveBeenCalledTimes(3)
    stream.finish()
    expect(changes).toHaveBeenCalledTimes(3)
    stop()
  })

  it('retains cancelled partial content even when the last view detaches before finalization', () => {
    const record = { result: '', reasoning: '' }
    const stream = beginOutputStream(record)
    const detach = stream.document.subscribe(() => {})
    stream.onToken('received')
    stream.document.interrupt()
    detach()
    expect(stream.signal.aborted).toBe(true)
    expect(() => stream.onToken('late')).toThrow(OutputInterruptedError)
    stream.finish(true)
    expect(record.result).toBe('received')
    expect(stream.document.phase).toBe('cancelled')
  })

  it('shares the snapshot budget across columns and finalized history', () => {
    const a = { result: '', reasoning: '' }, b = { result: '', reasoning: '' }
    const owner = { $state: { a, b } }
    const first = beginOutputStream(a, owner), second = beginOutputStream(b, owner)
    try {
      first.onToken('a'.repeat(600000))
      second.onToken('b'.repeat(300000))
      first.finish()
      expect(() => second.onToken('b'.repeat(200000))).toThrow(OutputInterruptedError)
      expect(second.document.phase).toBe('capacity')
    } finally { first.finish(); second.finish() }
    expect(b.result.length).toBe(300000)
    expect(new TextEncoder().encode(JSON.stringify(owner.$state)).byteLength).toBeLessThan(1024 * 1024)
  })

  it('enforces the global live budget across workspaces and returns reservations on finish', () => {
    const streams = Array.from({ length: 10 }, () => beginOutputStream({ result: '', reasoning: '' }))
    let interrupted = 0
    try {
      for (const stream of streams) {
        try { stream.onToken('x'.repeat(950000)) } catch { interrupted++ }
      }
      expect(interrupted).toBeGreaterThan(0)
    } finally { streams.forEach(stream => stream.finish()) }
    const next = beginOutputStream({ result: '', reasoning: '' })
    expect(() => next.onToken('x'.repeat(950000))).not.toThrow()
    next.finish()
  })

  it('freezes scalar and variant output at the checkpoint boundary without publishing it', async () => {
    const optimizedPrompt = ref(''), reasoning = ref('')
    const variants = ref({ a: { result: '', reasoning: '' } })
    const owner = { $state: reactive({ optimizedPrompt, reasoning, variants }) }
    const channel = createOutputChannel(optimizedPrompt, reasoning, owner)
    const stream = channel.begin(), variant = beginOutputStream(variants.value.a, owner)
    const writer = createSessionSnapshotWriter(() => ({ optimizedPrompt, reasoning, variants }))
    const cas = vi.fn(async () => true)
    const service = { compareAndSet: cas } as unknown as IPreferenceService
    try {
      stream.onToken('checkpoint'); variant.onToken('partial')
      const captured = writer.capture()
      stream.onToken('-later'); variant.onToken('-later')
      await writer.write(service, 'output-checkpoint', { optimizedPrompt: '', reasoning: '', variants: variants.value }, captured)
      expect(cas.mock.calls[0]?.[2]).toMatchObject({ optimizedPrompt: 'checkpoint', variants: { a: { result: 'partial' } } })
      expect(optimizedPrompt.value).toBe('')
      expect(variants.value.a.result).toBe('')
    } finally { stream.finish(); variant.finish() }
    expect(optimizedPrompt.value).toBe('checkpoint-later')
    expect(variants.value.a.result).toBe('partial-later')
  })
})
