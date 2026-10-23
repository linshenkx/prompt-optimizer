import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useTestSourcePreview } from '../../../src/composables/workspaces/useTestSourcePreview'

function createPreview(mode: 'live' | 'snapshot') {
  const sources = ref({
    a: { content: 'original', editable: true, view: 'original' as const, title: 'A' },
    b: { content: 'draft', editable: true, view: 'workspace' as const, title: 'B' },
    c: { content: 'saved v1', editable: false, view: 'original' as const, title: 'C' },
    d: { content: 'saved v2', editable: false, view: 'original' as const, title: 'D' },
  })
  const onEdit = vi.fn(async () => {})
  return { sources, onEdit, ...useTestSourcePreview({ mode, readSource: id => ({ ...sources.value[id] }), onEdit }) }
}

describe('test source preview state', () => {
  it('follows restored sources and version selection live in basic modes', () => {
    const preview = createPreview('live')
    preview.preview('b')
    expect(preview.show.value).toBe(true)
    expect(preview.content.value).toBe('draft')
    preview.sources.value = {
      ...preview.sources.value,
      b: { ...preview.sources.value.b, content: 'restored draft', title: 'B · v3', editable: false },
    }
    expect(preview.content.value).toBe('restored draft')
    expect(preview.title.value).toBe('B · v3')
    expect(preview.editable.value).toBe(false)
    preview.preview('a')
    expect(preview.content.value).toBe('original')
    expect(preview.editable.value).toBe(true)
  })

  it('retains context/image content, editability and target until the next opening', async () => {
    const preview = createPreview('snapshot')
    preview.preview('b')
    preview.sources.value = {
      ...preview.sources.value,
      b: { ...preview.sources.value.b, content: 'new version', editable: false },
    }
    expect(preview.content.value).toBe('draft')
    expect(preview.editable.value).toBe(true)
    await preview.edit()
    expect(preview.onEdit).toHaveBeenCalledWith('workspace')
    preview.preview('b')
    expect(preview.content.value).toBe('new version')
    expect(preview.editable.value).toBe(false)
  })

  it.each(['live', 'snapshot'] as const)('%s closes before navigation and awaits its completion', async mode => {
    let finish!: () => void
    const navigation = new Promise<void>(resolve => { finish = resolve })
    const preview = createPreview(mode)
    preview.onEdit.mockImplementation(async () => {
      expect(preview.show.value).toBe(false)
      await navigation
    })
    preview.preview('a')
    let completed = false
    const editing = preview.edit().then(() => { completed = true })
    expect(preview.onEdit).toHaveBeenCalledWith('original')
    expect(completed).toBe(false)
    finish()
    await editing
    expect(completed).toBe(true)
  })

  it.each(['live', 'snapshot'] as const)('%s exposes all four sources without modifying their data', mode => {
    const preview = createPreview(mode)
    for (const id of ['a', 'b', 'c', 'd'] as const) {
      preview.preview(id)
      expect(preview.selectedId.value).toBe(id)
      expect(preview.content.value).toBe(preview.sources.value[id].content)
      expect(preview.editable.value).toBe(id === 'a' || id === 'b')
      preview.show.value = false
    }
    expect(preview.sources.value.c.content).toBe('saved v1')
    expect(preview.onEdit).not.toHaveBeenCalled()
  })
})
