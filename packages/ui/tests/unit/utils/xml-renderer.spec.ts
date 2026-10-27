import { describe, expect, it, vi } from 'vitest'

import {
  extractXmlCandidate,
  isValidXmlContent,
  parseXmlContent,
  fitsXmlRenderBudget,
} from '../../../src/utils/xml-renderer'

describe('xml-renderer utils', () => {
  it('rejects excessive depth, size, width and entities before constructing a DOM', () => {
    const parser = vi.spyOn(globalThis, 'DOMParser')
    try {
      const documents = [
        '<n>'.repeat(128) + 'literal $& $`' + '</n>'.repeat(128),
        '<root>' + 'x'.repeat(100000) + '</root>',
        '<root>' + '<item/>'.repeat(300) + '</root>',
        '<!DOCTYPE root [<!ENTITY a "value">]><root>&a;</root>',
      ]
      for (const source of documents) {
        expect(fitsXmlRenderBudget(source)).toBe(false)
        expect(isValidXmlContent(source)).toBe(false)
        parseXmlContent(source)
      }
      expect(parser).not.toHaveBeenCalled()
    } finally { parser.mockRestore() }
  })
  it('extractXmlCandidate should unwrap xml code fences', () => {
    const wrapped = ['```xml', '<root><item id="1">value</item></root>', '```'].join('\n')
    expect(extractXmlCandidate(wrapped)).toBe('<root><item id="1">value</item></root>')
  })

  it('isValidXmlContent should detect plain valid xml', () => {
    expect(isValidXmlContent('<root><item>ok</item></root>')).toBe(true)
  })

  it('isValidXmlContent should reject markdown text', () => {
    expect(isValidXmlContent('# title\n\n- list item')).toBe(false)
  })

  it('parseXmlContent should build xml tree with attributes and text nodes', () => {
    const parsed = parseXmlContent('<root><item id="1">hello</item></root>')

    expect(parsed.error).toBeNull()
    expect(parsed.rootNodes).toHaveLength(1)

    const root = parsed.rootNodes[0]
    expect(root.kind).toBe('element')
    expect(root.name).toBe('root')
    expect(root.children?.[0]?.name).toBe('item')
    expect(root.children?.[0]?.attributes?.[0]).toEqual({ name: 'id', value: '1' })
    expect(root.children?.[0]?.children?.[0]).toEqual({ kind: 'text', value: 'hello' })
  })

  it('parseXmlContent should return parse error for malformed xml', () => {
    const parsed = parseXmlContent('<root><item></root>')
    expect(parsed.rootNodes).toEqual([])
    expect(parsed.error).toBeTruthy()
  })
})
