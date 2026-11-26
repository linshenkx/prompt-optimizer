import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readWorkspaceSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/image-mode/ImageMultiImageWorkspace.vue'),
    'utf8',
  )

const readPickerSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/media/ReferenceImagePicker.vue'),
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

  it('uses the shared ReferenceImagePicker card-style upload surface across image and video workspaces', () => {
    const workspaceSource = readWorkspaceSource()
    const pickerSource = readPickerSource()
    const image2ImageSource = readFileSync(
      resolve(process.cwd(), 'src/components/image-mode/ImageImage2ImageWorkspace.vue'),
      'utf8',
    )
    const videoSource = readFileSync(
      resolve(process.cwd(), 'src/components/video-mode/VideoWorkspace.vue'),
      'utf8',
    )

    expect(workspaceSource).toMatch(/<ReferenceImagePicker/)
    expect(image2ImageSource).toMatch(/<ReferenceImagePicker/)
    expect(videoSource).toMatch(/<ReferenceImagePicker/)
    expect(pickerSource).toMatch(/class="image-card-list"/)
    expect(pickerSource).toMatch(/class="image-card"/)
    expect(pickerSource).toMatch(/class="image-upload-card"/)
    expect(pickerSource).toMatch(/handleSurfaceDrop/)
    expect(workspaceSource).not.toMatch(/clearImages/)
    expect(workspaceSource).not.toMatch(/imageWorkspace\.input\.selectImage'\) }}/)
    expect(workspaceSource).not.toMatch(/class="image-item"/)
    expect(workspaceSource).not.toMatch(/:download-filename=/)
  })

  it('removes file metadata and arrow controls in favor of direct drag reordering and OS file drop', () => {
    const workspaceSource = readWorkspaceSource()
    const pickerSource = readPickerSource()

    expect(workspaceSource).not.toMatch(/<NText depth="3">\{\{ item\.mimeType/)
    expect(workspaceSource).not.toMatch(/moveImage\(index, index - 1\)/)
    expect(workspaceSource).not.toMatch(/moveImage\(index, index \+ 1\)/)
    expect(pickerSource).toMatch(/class="image-card__footer"/)
    expect(pickerSource).toMatch(/class="image-card__drag-handle"/)
    expect(pickerSource).toMatch(/handleImageDragStart/)
    expect(pickerSource).toMatch(/handleCardDrop/)
    expect(pickerSource).toMatch(/handleUploadCardDrop/)
    expect(pickerSource).toMatch(/overscroll-behavior-x:\s*contain/)
    expect(pickerSource).not.toMatch(/preview-disabled/)
  })

  it('keeps a visible remove icon overlay in the preview instead of hiding it in the footer action row', () => {
    const pickerSource = readPickerSource()

    expect(pickerSource).toMatch(/class="image-card__remove"/)
    expect(pickerSource).toMatch(/imageWorkspace\.input\.removeImageAriaLabel/)
    expect(pickerSource).toMatch(/class="image-card__remove-icon"/)

    const previewWrapIndex = pickerSource.indexOf('class="image-card__preview-wrap"')
    const removeIndex = pickerSource.indexOf('class="image-card__remove"')
    const footerIndex = pickerSource.indexOf('class="image-card__footer"')

    expect(previewWrapIndex).toBeGreaterThan(-1)
    expect(removeIndex).toBeGreaterThan(-1)
    expect(footerIndex).toBeGreaterThan(-1)
    expect(footerIndex).toBeGreaterThan(previewWrapIndex)
    expect(removeIndex).toBeGreaterThan(previewWrapIndex)
    expect(removeIndex).toBeLessThan(footerIndex)

    const previewSegment = pickerSource.slice(previewWrapIndex, footerIndex)
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
