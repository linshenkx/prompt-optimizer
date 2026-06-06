import { describe, expect, it } from 'vitest'
import { CompareValidationError } from '../../../src/services/compare/errors'
import { CompareService, createCompareService } from '../../../src/services/compare/service'
import { ChangeType } from '../../../src/services/compare/types'

describe('CompareService', () => {
  it('compares prompt text at word granularity and summarizes changed fragments', () => {
    const service = new CompareService()

    const result = service.compareTexts(
      'Write a short product intro',
      'Write a detailed product intro',
    )

    expect(result.fragments).toEqual([
      { text: 'Write a ', type: ChangeType.UNCHANGED, index: 0 },
      { text: 'short', type: ChangeType.REMOVED, index: 1 },
      { text: 'detailed', type: ChangeType.ADDED, index: 2 },
      { text: ' product intro', type: ChangeType.UNCHANGED, index: 3 },
    ])
    expect(result.summary).toEqual({
      additions: 1,
      deletions: 1,
      unchanged: 2,
    })
  })

  it('supports character-level comparison for compact prompt edits', () => {
    const service = new CompareService()

    const result = service.compareTexts('tone: warm', 'tone: farm', {
      granularity: 'char',
    })

    expect(result.fragments.map((fragment) => fragment.type)).toEqual([
      ChangeType.UNCHANGED,
      ChangeType.REMOVED,
      ChangeType.ADDED,
      ChangeType.UNCHANGED,
    ])
    expect(result.fragments.map((fragment) => fragment.text).join('')).toContain('tone: ')
    expect(result.summary).toEqual({
      additions: 1,
      deletions: 1,
      unchanged: 2,
    })
  })

  it('can ignore whitespace and letter case before comparing prompts', () => {
    const service = new CompareService()

    const result = service.compareTexts('  Use   JSON Output  ', 'use json output', {
      ignoreWhitespace: true,
      caseSensitive: false,
    })

    expect(result.fragments).toEqual([
      { text: 'use json output', type: ChangeType.UNCHANGED, index: 0 },
    ])
    expect(result.summary).toEqual({
      additions: 0,
      deletions: 0,
      unchanged: 1,
    })
  })

  it('returns a single unchanged fragment for identical text', () => {
    const service = createCompareService()

    const result = service.compareTexts('Keep all constraints.', 'Keep all constraints.')

    expect(result.fragments).toEqual([
      { text: 'Keep all constraints.', type: ChangeType.UNCHANGED, index: 0 },
    ])
    expect(result.summary).toEqual({
      additions: 0,
      deletions: 0,
      unchanged: 1,
    })
  })

  it('validates both compare inputs before diffing', () => {
    const service = new CompareService()

    expect(() => service.compareTexts(null as any, 'optimized')).toThrow(CompareValidationError)
    expect(() => service.compareTexts('original', undefined as any)).toThrow(CompareValidationError)
  })
})
