import { describe, expect, it } from 'vitest'
import { applyPatchOperationsToText } from '../../../src/utils/patch-plan'
import type { PatchOperation } from '../../../src/services/evaluation/types'

describe('patch-plan', () => {
  describe('applyPatchOperationsToText', () => {
    it('should apply replace operation', () => {
      const input = 'Hello World'
      const operation: PatchOperation = {
        op: 'replace',
        oldText: 'World',
        newText: 'Universe',
        instruction: 'Replace World',
      }

      const result = applyPatchOperationsToText(input, operation)

      expect(result.ok).toBe(true)
      expect(result.text).toBe('Hello Universe')
      expect(result.report.status).toBe('applied')
    })

    it('should apply insert operation (newText contains oldText + inserted content)', () => {
      const input = 'Hello World'
      const operation: PatchOperation = {
        op: 'insert',
        oldText: 'Hello',
        newText: 'Hello Beautiful',
        instruction: 'Insert Beautiful',
      }

      const result = applyPatchOperationsToText(input, operation)

      expect(result.ok).toBe(true)
      expect(result.text).toBe('Hello Beautiful World')
    })

    it('should apply delete operation', () => {
      const input = 'Hello Beautiful World'
      const operation: PatchOperation = {
        op: 'delete',
        oldText: ' Beautiful',
        newText: '',
        instruction: 'Delete Beautiful',
      }

      const result = applyPatchOperationsToText(input, operation)

      expect(result.ok).toBe(true)
      expect(result.text).toBe('Hello World')
    })

    it('should replace second occurrence when occurrence=2', () => {
      const input = 'foo bar foo baz foo'
      const operation: PatchOperation = {
        op: 'replace',
        oldText: 'foo',
        newText: 'FOO',
        instruction: 'Replace second foo',
        occurrence: 2,
      }

      const result = applyPatchOperationsToText(input, operation)

      expect(result.ok).toBe(true)
      expect(result.text).toBe('foo bar FOO baz foo')
    })

    it('should fail when oldText not found', () => {
      const input = 'Hello World'
      const operation: PatchOperation = {
        op: 'replace',
        oldText: 'NotExist',
        newText: 'Something',
        instruction: 'Replace missing',
      }

      const result = applyPatchOperationsToText(input, operation)

      expect(result.ok).toBe(false)
      expect(result.text).toBe('Hello World')
      expect(result.report.status).toBe('skipped')
      expect(result.report.reason).toContain('not found')
    })

    it('should fail when oldText is empty', () => {
      const input = 'Hello World'
      const operation: PatchOperation = {
        op: 'replace',
        oldText: '',
        newText: 'Something',
        instruction: 'Replace empty',
      }

      const result = applyPatchOperationsToText(input, operation)

      expect(result.ok).toBe(false)
      expect(result.report.status).toBe('skipped')
      expect(result.report.reason).toContain('Missing oldText')
    })
  })
})
