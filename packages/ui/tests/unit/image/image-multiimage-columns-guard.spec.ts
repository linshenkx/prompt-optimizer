import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readWorkspaceSource = () =>
  readFileSync(
    resolve(process.cwd(), 'src/components/image-mode/ImageMultiImageWorkspace.vue'),
    'utf8',
  )

describe('image multiimage workspace guards', () => {
  it('uses the standard variant test area controls', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/<TemporaryVariablesPanel[\s>]/)
    expect(source).toMatch(/:show-generate-values="true"/)
    expect(source).toMatch(/@generate-values="handleGenerateValues"/)
    expect(source).toMatch(/<TestWorkspaceToolbar[\s>]/)
    expect(source).toContain('v-model:count="testColumnCountModel"')
    expect(source).toContain('@run="runAllVariants"')
    expect(source).toMatch(/<TestPanelVersionSelect[\s>]/)
    expect(source).toMatch(/<VariableValuePreviewDialog[\s>]/)
    expect(source).toMatch(/<ImageTokenUsage[\s>]/)
    expect(source).toMatch(/runAllVariants/)
    expect(source).toMatch(/runVariant/)
    expect(source).toMatch(/getVariantLabel/)
    expect(source).toMatch(/variant-cell__controls--stacked/)
    expect(source).toMatch(/circle/)
    expect(source).not.toMatch(/Variant \$\{id\.toUpperCase\(\)\}/)
  })

  it('stores ordered multi-image input metadata and passes it into token usage display', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/createVariantInputImagesInfo/)
    expect(source).toMatch(/withVariantInputImagesInfo/)
    expect(source).toMatch(/inputImagesInfo/)
    expect(source).toMatch(/:input-images-info="getVariantInputImagesInfo\(id\)"/)
  })

  it('persists layout changes through the session save queue', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/watch\(\s*\(\)\s*=>\s*session\.layout,/)
    expect(source).toMatch(/queueSessionSave\(\)/)
  })

  it('registers restore listeners before onMounted and clears stale images on external restore', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/session\.replaceInputImages\(\[\]\)/)

    const restoreListenerIndex = source.indexOf("window.addEventListener('image-workspace-restore-favorite'")
    const onMountedIndex = source.indexOf('onMounted(async () => {')

    expect(restoreListenerIndex).toBeGreaterThanOrEqual(0)
    expect(onMountedIndex).toBeGreaterThanOrEqual(0)
    expect(restoreListenerIndex).toBeLessThan(onMountedIndex)
  })

  it('refreshes template and model selectors like the single-image workspace', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/handleTemplateSelectFocus/)
    expect(source).toMatch(/handleTextModelSelectFocus/)
    expect(source).toMatch(/image-workspace-refresh-iterate-select/)
    expect(source).toMatch(/image-workspace-refresh-text-models/)
    expect(source).toMatch(/image-workspace-refresh-image-models/)
    expect(source).toMatch(/image-workspace-refresh-templates/)
  })

  it('surfaces only unsupported multi-image models in the generation area', () => {
    const source = readWorkspaceSource()

    expect(source).toMatch(/multiImageUnsupported/)
    expect(source).toMatch(/shouldShowVariantModelWarning/)
    expect(source).toMatch(/isVariantModelUnsupported/)
    expect(source).not.toMatch(/multiImageSupportedShort/)
    expect(source).not.toMatch(/multiImageUnsupportedShort/)
    expect(source).not.toMatch(/multiImageSupported:\s/)
  })
})
