import { describe, expect, it } from 'vitest'

import {
  buildTestResultExampleDraft,
  buildTestResultVariableDraft,
  type TestResultExampleEntry,
} from '../../../src/utils/test-result-example-draft'
import type { FavoriteReproducibilityExample } from '../../../src/utils/favorite-reproducibility'

const example = (
  parameters: Record<string, string>,
  outputText: string,
): FavoriteReproducibilityExample => ({
  parameters,
  outputText,
  images: [],
  imageAssetIds: [],
  inputImages: [],
  inputImageAssetIds: [],
})

describe('test-result-example-draft', () => {
  it('merges variable names across examples in first-seen order without duplicates', () => {
    const variables = buildTestResultVariableDraft([
      example({ topic: 'a', tone: 'calm' }, 'A'),
      example({ tone: 'bold', audience: 'devs' }, 'B'),
    ])

    expect(variables.map((variable) => variable.name)).toEqual(['topic', 'tone', 'audience'])
    expect(variables.every((variable) => variable.source === 'test-run' && !variable.required)).toBe(true)
  })

  it('drops parameter names that are not valid variable names', () => {
    const variables = buildTestResultVariableDraft([
      example({ valid_name: 'x', 'not valid': 'y' }, 'A'),
    ])

    expect(variables.map((variable) => variable.name)).toEqual(['valid_name'])
  })

  it('keeps entry order when building the draft', () => {
    const entries: TestResultExampleEntry[] = [
      { variantId: 'c', example: example({}, 'C') },
      { variantId: 'a', example: example({}, 'A') },
    ]

    expect(buildTestResultExampleDraft(entries).examples.map((item) => item.outputText)).toEqual(['C', 'A'])
  })
})
