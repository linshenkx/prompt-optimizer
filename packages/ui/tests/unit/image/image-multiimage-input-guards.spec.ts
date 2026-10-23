import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readWorkspaceSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/image-mode/ImageMultiImageWorkspace.vue'),
    'utf8',
  )

describe('image multiimage input UI guards', () => {
  it('reuses the image2image split workspace skeleton instead of a custom page layout', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/ref="splitRootRef"/)
    // Keep the desktop split contract without forbidding a compact layout branch.
    expect(source).toContain('`${mainSplitLeftPct}% 12px 1fr`')
    expect(source).toMatch(/class="split-divider"/)
    expect(source).toMatch(/@pointerdown="onSplitPointerDown"/)
    expect(source).toMatch(/@keydown="onSplitKeydown"/)
  })

  it('uses card-style image tiles with a trailing upload placeholder instead of the old button row', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/class="image-card-list"/)
    expect(source).toMatch(/class="image-card"/)
    expect(source).toMatch(/class="image-upload-card"/)
    expect(source).not.toMatch(/clearImages/)
    expect(source).not.toMatch(/imageWorkspace\.input\.selectImage'\) }}/)
    expect(source).not.toMatch(/class="image-item"/)
    expect(source).not.toMatch(/:download-filename=/)
  })

  it('removes file metadata and arrow controls in favor of direct drag reordering', () => {
    const source = readWorkspaceSource()

    expect(source).not.toMatch(/<NText depth="3">\{\{ item\.mimeType/)
    expect(source).not.toMatch(/moveImage\(index, index - 1\)/)
    expect(source).not.toMatch(/moveImage\(index, index \+ 1\)/)
    expect(source).toMatch(/class="image-card__footer"/)
    expect(source).toMatch(/class="image-card__drag-handle"/)
    expect(source).toMatch(/class="image-card__drag-handle"/)
    expect(source).toMatch(/handleImageDragStart/)
    expect(source).toMatch(/handleImageDrop/)
    expect(source).toMatch(/handleUploadCardDrop/)
    expect(source).toMatch(/overscroll-behavior-x:\s*contain/)
    expect(source).not.toMatch(/preview-disabled/)
  })

  it('keeps a visible remove icon overlay in the preview instead of hiding it in the footer action row', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/class="image-card__remove"/)
    expect(source).toMatch(/imageWorkspace\.input\.removeImageAriaLabel/)
    expect(source).toMatch(/class="image-card__remove-icon"/)

    const previewWrapIndex = source.indexOf('class="image-card__preview-wrap"')
    const removeIndex = source.indexOf('class="image-card__remove"')
    const footerIndex = source.indexOf('class="image-card__footer"')

    expect(previewWrapIndex).toBeGreaterThan(-1)
    expect(removeIndex).toBeGreaterThan(-1)
    expect(footerIndex).toBeGreaterThan(-1)
    expect(footerIndex).toBeGreaterThan(previewWrapIndex)
    expect(removeIndex).toBeGreaterThan(previewWrapIndex)
    expect(removeIndex).toBeLessThan(footerIndex)

    const previewSegment = source.slice(previewWrapIndex, footerIndex)
    expect(previewSegment).toContain('class="image-card__remove"')
    expect(previewSegment).toContain('class="image-card__remove-icon"')
  })

  it('splits the left pane into an input card and a fill-height optimized prompt workspace', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/<VariableAwareInput/)
    expect(source).toMatch(/imageWorkspace\.input\.multiImagePromptPlaceholder/)
    expect(source).toMatch(/isInputPanelCollapsed/)
    expect(source).toMatch(/openFullscreen/)
    expect(source).toMatch(/<PromptPanelUI/)
    expect(source).toMatch(/:show-preview="true"/)
    expect(source).toMatch(/@open-preview="handleOpenPromptPreview"/)
    expect(source).toMatch(/<PromptPreviewPanel/)
    expect(source).not.toMatch(/class="optimized-prompt-input"/)
  })

  it('uses i18n-backed optimize toasts instead of hardcoded chinese copy', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/toast\.success\(t\('toast\.success\.optimizeSuccess'\)\)/)
    expect(source).toMatch(/toast\.error\(getI18nErrorMessage\(error, t\('toast\.error\.optimizeFailed'\)\)\)/)
    expect(source).not.toMatch(/已生成多图优化提示词/)
    expect(source).not.toMatch(/toast\.error\(error instanceof Error \? error\.message : '优化失败'\)/)
  })
})
