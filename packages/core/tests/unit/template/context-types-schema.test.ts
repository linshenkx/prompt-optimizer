import { describe, it, expect } from 'vitest'
import { templateSchema } from '../../../src/services/template/types'

const base = {
  id: 'test-id',
  name: '测试模板',
  content: 'Hello',
  metadata: {
    version: '1.0.0',
    lastModified: Date.now()
  }
}

describe('template schema - context types', () => {
  it('accepts conversationMessageOptimize', () => {
    const result = templateSchema.safeParse({
      ...base,
      metadata: { ...base.metadata, templateType: 'conversationMessageOptimize' }
    })
    expect(result.success).toBe(true)
  })

  it('accepts contextUserOptimize', () => {
    const result = templateSchema.safeParse({
      ...base,
      metadata: { ...base.metadata, templateType: 'contextUserOptimize' }
    })
    expect(result.success).toBe(true)
  })

  it('accepts contextIterate', () => {
    const result = templateSchema.safeParse({
      ...base,
      metadata: { ...base.metadata, templateType: 'contextIterate' }
    })
    expect(result.success).toBe(true)
  })
})

