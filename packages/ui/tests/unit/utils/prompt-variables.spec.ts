import { describe, expect, it } from 'vitest'

import {
  findMissingVariables,
  replaceVariablesInContent,
  scanVariableNames,
} from '../../../src/utils/prompt-variables'

describe('prompt-variables', () => {
  it('scanVariableNames dedupes, trims, and skips Mustache control tags', () => {
    const input = [
      'Hello {{ foo }} and {{foo}} and {{bar}}',
      '{{#if something}}ignore{{/if}}',
      '{{> partial}} {{& raw}} {{! comment}}',
    ].join('\n')

    expect(scanVariableNames(input)).toEqual(['foo', 'bar'])
  })

  it('replaceVariablesInContent replaces provided variables and keeps missing placeholders', () => {
    const vars = { foo: 'X' }
    expect(replaceVariablesInContent('A {{foo}} B {{bar}}', vars)).toBe(
      'A X B {{bar}}',
    )
  })

  it('replaceVariablesInContent skips Mustache control tags', () => {
    const vars = { if: 'SHOULD_NOT_APPLY' }
    expect(replaceVariablesInContent('{{#if}} ok {{/if}}', vars)).toBe(
      '{{#if}} ok {{/if}}',
    )
  })

  it('findMissingVariables treats undefined and empty as missing', () => {
    const vars = { foo: '', bar: 'Y' }
    expect(findMissingVariables('{{foo}} {{bar}} {{baz}}', vars)).toEqual([
      'foo',
      'baz',
    ])
  })
})
