import { describe, expect, it } from 'vitest'
import { prepareMarkdownOutput } from '../../../src/utils/markdown-output'

const render = (content: string, previewHtml: boolean) => {
  const result = prepareMarkdownOutput(content, previewHtml)
  if (result.kind !== 'html') throw new Error('Expected HTML output')
  return result.html
}

describe('prepareMarkdownOutput CJK emphasis', () => {
  it.each([false, true])('bolds text that ends in CJK punctuation before a CJK letter (previewHtml: %s)', previewHtml => {
    expect(render('**注意：**请先备份数据。', previewHtml)).toContain('<strong>注意：</strong>请先备份数据。')
    expect(render('1. **角色定位：**你是一名资深产品经理', previewHtml)).toContain('<strong>角色定位：</strong>你是一名资深产品经理')
    expect(render('**「重点」**内容', previewHtml)).toContain('<strong>「重点」</strong>内容')
    expect(render('**この文は強調されます。**次の文。', previewHtml)).toContain('<strong>この文は強調されます。</strong>次の文。')
  })

  it('keeps emphasis that CommonMark already handles', () => {
    expect(render('**角色**：你是 *a* **b**', false)).toBe('<p><strong>角色</strong>：你是 <em>a</em> <strong>b</strong></p>\n')
    expect(render('2 * 3 * 4', false)).toBe('<p>2 * 3 * 4</p>\n')
  })
})
