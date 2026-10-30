import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import enUS from '../../../src/i18n/locales/en-US'
import zhCN from '../../../src/i18n/locales/zh-CN'
import zhTW from '../../../src/i18n/locales/zh-TW'

const readUiSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('ui runtime english guards', () => {
  it('localizes favorite list item actions and relative time labels', () => {
    const source = readUiSource('src/components/FavoriteListItem.vue')

    expect(source).toMatch(/useI18n/)
    expect(source).toMatch(/favorites\.library\.card\.edit/)
    expect(source).toMatch(/favorites\.library\.time\.justNow/)
    expect(source).not.toMatch(/title="复制"/)
    expect(source).not.toMatch(/label:\s*'编辑'/)
    expect(source).not.toMatch(/'刚刚'/)
  })

  it('removes hardcoded chinese helper text from the multi-image workspace', () => {
    const source = readUiSource('src/components/image-mode/ImageMultiImageWorkspace.vue')

    expect(source).toMatch(/imageWorkspace\.input\.multiImagePromptPlaceholder/)
    expect(source).toMatch(/imageWorkspace\.input\.removeImageAriaLabel/)
    expect(source).toMatch(/imageWorkspace\.input\.reorderImageAriaLabel/)
    expect(source).toMatch(/imageWorkspace\.input\.multiImageHint/)
    expect(source).toMatch(/imageWorkspace\.input\.multiImageMinHint/)
    expect(source).toMatch(/imageWorkspace\.input\.multiImageReadyHint/)
    expect(source).not.toMatch(/请使用图1 \/ 图2 \/ 图3 来描述图片关系和生成目标/)
    expect(source).not.toMatch(/拖动卡片可调整图1 \/ 图2 \/ 图3 的顺序语义/)
  })

  it('uses locale-backed messaging in context management and focus management', () => {
    const contextSource = readUiSource('src/composables/context/useContextManagement.ts')
    const focusSource = readUiSource('src/composables/accessibility/useFocusManager.ts')

    expect(contextSource).toMatch(/useI18n/)
    expect(contextSource).toMatch(/contextEditor\.saveSuccess/)
    expect(contextSource).toMatch(/contextEditor\.switchModeFailed/)
    expect(contextSource).not.toMatch(/上下文已更新/)
    expect(contextSource).not.toMatch(/切换上下文模式失败/)

    expect(focusSource).toMatch(/announce\(t\('accessibility\.liveRegion\.focusMoved'/)
    expect(focusSource).toMatch(/announce\(t\('accessibility\.liveRegion\.focusTrapped'/)
    expect(focusSource).toMatch(/announce\(t\('accessibility\.liveRegion\.focusReleased'/)
    expect(focusSource).not.toMatch(/已聚焦到/)
    expect(focusSource).not.toMatch(/焦点已限制在当前区域内/)
  })

  it('keeps app-layout success and startup repair toasts locale-backed', () => {
    const source = readUiSource('src/components/app-layout/PromptOptimizerApp.vue')

    expect(source).toMatch(/toast\.success\(t\('context\.saveSuccess'\)\)/)
    expect(source).toMatch(/toast\.warning\(t\('toast\.warning\.startupRepair',\s*\{\s*count:\s*report\.actions\.length\s*\}\)\)/)
    expect(source).not.toMatch(/toast\.success\('Context updated'\)/)
    expect(source).not.toMatch(/Automatically repaired .* local storage issue\(s\) during startup\./)

    expect(enUS.toast.warning.startupRepair).toContain('{count}')
    expect(zhCN.toast.warning.startupRepair).toContain('{count}')
    expect(zhTW.toast.warning.startupRepair).toContain('{count}')
  })

  it('keeps template loading failures locale-backed', () => {
    const source = readUiSource('src/components/TemplateManager.vue')

    expect(source).toMatch(/toast\.error\(t\('toast\.error\.loadTemplatesFailed'\)\)/)
    expect(source).not.toMatch(/toast\.error\('Failed to load templates'\)/)
  })

  it('keeps context editor import-export feedback locale-backed', () => {
    const source = readUiSource('src/composables/context/useContextEditor.ts')

    expect(source).toMatch(/useI18n/)
    expect(source).toMatch(/contextEditor\.feedback\./)
    expect(source).not.toMatch(/LangFuse data converted successfully/)
    expect(source).not.toMatch(/OpenAI data converted successfully/)
    expect(source).not.toMatch(/No editable data available/)
    expect(source).not.toMatch(/Template converted successfully/)
    expect(source).not.toMatch(/Variables applied successfully/)
    expect(source).not.toMatch(/Clipboard data imported successfully/)
    expect(source).not.toMatch(/No data available to export/)
    expect(source).not.toMatch(/Data copied to clipboard/)
    expect(source).not.toMatch(/Copy failed/)
  })

  it('keeps Prompt Garden warnings locale-backed', () => {
    const source = readUiSource('src/composables/app/useAppPromptGardenImport.ts')

    expect(source).toMatch(/toast\.warning\(String\(i18n\.global\.t\('toast\.warning\.promptGardenExampleInputImageLoadFailed'\)\)\)/)
    expect(source).toMatch(/toast\.warning\(String\(i18n\.global\.t\('toast\.warning\.promptGardenExampleInputImagesPartialLoadFailed'\)\)\)/)
    expect(source).toMatch(/toast\.warning\(String\(i18n\.global\.t\('toast\.warning\.promptGardenFavoriteSaveFailed'\)\)\)/)
    expect(source).toMatch(/toast\.error\(String\(i18n\.global\.t\('toast\.error\.promptGardenImportFailed'\)\)\)/)
    expect(source).not.toMatch(/toast\.warning\('Failed to load the example input image\./)
    expect(source).not.toMatch(/toast\.warning\('Some example input images could not be loaded\./)
    expect(source).not.toMatch(/toast\.warning\('Prompt Garden import succeeded, but saving the favorite failed\.'\)/)
  })

  it('keeps DeepSeek advanced parameter labels locale-backed', () => {
    const source = readUiSource('../core/src/services/llm/adapters/deepseek-adapter.ts')

    expect(source).toMatch(/params\.deepseek\.thinking_type\.label/)
    expect(source).toMatch(/params\.deepseek\.thinking_type\.enabled/)
    expect(source).toMatch(/params\.reasoning_effort\.label/)
    expect(enUS.params.deepseek.thinking_type.enabled).toBe('Enabled')
    expect(zhCN.params.deepseek.thinking_type.enabled).toBe('开启')
    expect(zhTW.params.deepseek.thinking_type.enabled).toBe('開啟')
    expect(enUS.params.reasoning_effort.label).toBe('Reasoning Effort')
    expect(zhCN.params.reasoning_effort.label).toBe('推理强度')
    expect(zhTW.params.reasoning_effort.label).toBe('推理強度')
  })

  it('keeps favorites management fallbacks locale-backed', () => {
    const categorySource = readUiSource('src/components/CategoryManager.vue')
    const tagSource = readUiSource('src/components/TagManager.vue')
    const favoriteEditorSource = readUiSource('src/components/FavoriteEditorForm.vue')
    const previewSource = readUiSource('src/components/PromptGardenFavoritePreviewPanel.vue')

    expect(categorySource).toMatch(/message\.warning\(t\('favorites\.manager\.messages\.unavailable'\)\)/)
    expect(categorySource).not.toMatch(/message\.warning\('Favorites are temporarily unavailable\.'\)/)

    expect(tagSource).toMatch(/getI18nErrorMessage/)
    expect(tagSource).not.toMatch(/'Unknown error'/)

    expect(favoriteEditorSource).toMatch(/getI18nErrorMessage/)
    expect(favoriteEditorSource).not.toMatch(/'Unknown error'/)

    expect(previewSource).toMatch(/getI18nErrorMessage/)
    expect(previewSource).not.toMatch(/'Unknown error'/)
  })

  it('keeps text model manager error fallbacks locale-backed', () => {
    const source = readUiSource('src/composables/model/useTextModelManager.ts')

    expect(source).toMatch(/t\('common\.error'\)/)
    expect(source).not.toMatch(/'Unknown error'/)
  })

  it('keeps text model API URL and provider guidance locale-backed', () => {
    const source = readUiSource('src/components/TextModelEditModal.vue')

    expect(source).toMatch(/ThemedTooltip/)
    expect(source).toMatch(/modelManager\.apiUrlHintAriaLabel/)
    expect(source).toMatch(/modelManager\.provider\.xiaomiMimoHint/)
    expect(source).toMatch(/modelManager\.provider\.minimaxHint/)
    expect(source).not.toMatch(/:title="t\('modelManager\.apiUrlHint'\)"/)

    expect(enUS.modelManager.apiUrlHintAriaLabel).toBe('Show API URL help')
    expect(enUS.modelManager.provider.xiaomiMimoHint).toContain('https://token-plan-cn.xiaomimimo.com/v1')
    expect(zhCN.modelManager.provider.xiaomiMimoHint).toContain('https://token-plan-cn.xiaomimimo.com/v1')
    expect(zhTW.modelManager.provider.xiaomiMimoHint).toContain('https://token-plan-cn.xiaomimimo.com/v1')
    expect(enUS.modelManager.provider.minimaxHint).toContain('https://api.minimaxi.com/v1')
    expect(zhCN.modelManager.provider.minimaxHint).toContain('https://api.minimaxi.com/v1')
    expect(zhTW.modelManager.provider.minimaxHint).toContain('https://api.minimaxi.com/v1')
  })

  it('keeps prompt testing and test mode config free of hardcoded chinese runtime strings', () => {
    const promptTesterSource = readUiSource('src/composables/prompt/usePromptTester.ts')
    const modeConfigSource = readUiSource('src/composables/ui/useTestModeConfig.ts')
    const responsiveLayoutSource = readUiSource('src/composables/ui/useResponsiveTestLayout.ts')

    expect(promptTesterSource).toMatch(/Please follow your role instructions and show your capabilities in the conversation\./)
    expect(promptTesterSource).not.toMatch(/请按照你的角色设定，展示你的能力并与我互动。/)

    expect(modeConfigSource).toMatch(/test\.modeHelp\.system\.title/)
    expect(modeConfigSource).toMatch(/test\.validation\.promptRequired/)
    expect(modeConfigSource).toMatch(/test\.validation\.contentRequired/)
    expect(modeConfigSource).not.toMatch(/系统提示词测试模式/)
    expect(modeConfigSource).not.toMatch(/需要提供提示词/)

    expect(responsiveLayoutSource).toMatch(/title:\s*'test\.testResult'/)
    expect(responsiveLayoutSource).not.toMatch(/title:\s*'测试结果'/)
  })

  it('keeps variable extraction runtime validation and evaluation context free of chinese hardcoding', () => {
    const selectionSource = readUiSource('src/components/variable-extraction/useTextSelection.ts')
    const inputSource = readUiSource('src/components/variable-extraction/VariableAwareInput.vue')
    const evaluationContextSource = readUiSource('src/composables/prompt/useEvaluationContext.ts')

    expect(selectionSource).toMatch(/TEXT_SELECTION_ERRORS/)
    expect(selectionSource).not.toMatch(/输入框未就绪/)
    expect(selectionSource).not.toMatch(/未选中任何文本/)
    expect(selectionSource).not.toMatch(/不能跨越变量边界/)

    expect(inputSource).toMatch(/TEXT_SELECTION_ERRORS/)
    expect(inputSource).not.toMatch(/未选中任何文本/)
    expect(inputSource).not.toMatch(/不能跨越变量边界/)

    expect(evaluationContextSource).toContain(
      '[useEvaluationContext] This composable must be used inside a component tree that provides evaluation context.'
    )
    expect(evaluationContextSource).not.toMatch(/必须在提供了评估上下文的组件树中使用/)
  })

  it('keeps image token usage labels locale-driven', () => {
    const source = readUiSource('src/components/image-mode/ImageTokenUsage.vue')

    expect(source).toContain("t('imageWorkspace.usage.image')")
    expect(source).not.toMatch(/图\{\{ index \+ 1 \}\}/)
  })

  it('keeps theme config language-neutral and locale-driven', () => {
    const themeConfigSource = readUiSource('src/config/naive-theme.ts')
    const themeToggleSource = readUiSource('src/components/ThemeToggleUI.vue')

    expect(themeConfigSource).toContain("labelKey: 'theme.light'")
    expect(themeConfigSource).toContain("labelKey: 'theme.dark'")
    expect(themeConfigSource).toContain("labelKey: 'theme.classic'")
    expect(themeConfigSource).not.toMatch(/name:\s*'日间模式'/)
    expect(themeConfigSource).not.toMatch(/name:\s*'夜间模式'/)
    expect(themeConfigSource).not.toMatch(/name:\s*'米杏模式'/)

    expect(themeToggleSource).toMatch(/t\(`theme\.\$\{themeId\.value\}`\)/)
    expect(themeToggleSource).toMatch(/label:\s*t\(`theme\.\$\{theme\.id\}`\)/)
  })

  it('keeps test result titles and variable importer feedback locale-backed', () => {
    const testResultSource = readUiSource('src/components/TestResultSection.vue')
    const variableImporterSource = readUiSource('src/components/variable/VariableImporter.vue')

    expect(testResultSource).toMatch(/t\('evaluation\.evaluate'\)/)
    expect(testResultSource).toMatch(/t\('test\.compareResultA'\)/)
    expect(testResultSource).toMatch(/t\('test\.compareResultB'\)/)
    expect(testResultSource).toMatch(/t\('test\.testResult'\)/)
    expect(testResultSource).not.toMatch(/t\('evaluation\.evaluate', '评估'\)/)
    expect(testResultSource).not.toMatch(/t\('test\.compareResultA', '结果 A'\)/)
    expect(testResultSource).not.toMatch(/t\('test\.compareResultB', '结果 B'\)/)
    expect(testResultSource).not.toMatch(/t\('test\.testResult', '测试结果'\)/)

    expect(variableImporterSource).toMatch(/t\('variables\.importer\.selectedFile'\)/)
    expect(variableImporterSource).not.toMatch(/已选择文件：/)
  })

  it('keeps compare-ui suggestion fallbacks english-first', () => {
    const source = readUiSource('src/components/evaluation/compare-ui.ts')

    expect(source).toContain(
      'This is the only workspace column, so it is suggested as the optimization target.'
    )
    expect(source).toContain(
      'It matches the current workspace content, so it is suggested as a retest.'
    )
    expect(source).not.toMatch(/这是当前唯一的工作区，所以建议作为优化目标。/)
    expect(source).not.toMatch(/它和工作区当前内容相同，所以建议按复测处理。/)
  })

  it('keeps evaluation handler context blocks and template processor suggestions english-first', () => {
    const evaluationHandlerSource = readUiSource('src/composables/prompt/useEvaluationHandler.ts')
    const templateProcessorSource = readUiSource('src/services/EnhancedTemplateProcessor.ts')

    expect(evaluationHandlerSource).toContain('[Current workspace prompt under optimization]')
    expect(evaluationHandlerSource).toContain('This block describes the template variable structure only.')
    expect(evaluationHandlerSource).toContain('Variables: ${variableNames.join')
    expect(evaluationHandlerSource).toContain('Target message role:')
    expect(evaluationHandlerSource).toContain('Conversation context:')
    expect(evaluationHandlerSource).not.toMatch(/当前工作区要优化的提示词/)
    expect(evaluationHandlerSource).not.toMatch(/这里只说明模板变量结构/)
    expect(evaluationHandlerSource).not.toMatch(/目标消息角色|会话上下文|当前分析目标/)

    expect(templateProcessorSource).toContain('Consider merging similar variables:')
    expect(templateProcessorSource).toContain('is too complex and may need to be split')
    expect(templateProcessorSource).toContain('Numeric variable')
    expect(templateProcessorSource).toContain('Boolean variable')
    expect(templateProcessorSource).toContain('Array variable')
    expect(templateProcessorSource).toContain('Object variable')
    expect(templateProcessorSource).not.toMatch(/考虑合并相似的变量/)
    expect(templateProcessorSource).not.toMatch(/内容过于复杂，建议拆分/)
    expect(templateProcessorSource).not.toMatch(/数值型变量|布尔型变量|数组型变量|对象型变量/)
  })

  it('keeps image text-to-image evaluation seeded copy english-first', () => {
    const source = readUiSource('src/components/image-mode/imageText2ImageEvaluation.ts')

    expect(source).toContain("const TEST_CASE_LABEL = 'Generation Intent'")
    expect(source).toContain("const OUTPUT_BLOCK_LABEL = 'Generated Output'")
    expect(source).toContain('Show the generated image result for column')
    expect(source).not.toMatch(/生成意图/)
    expect(source).not.toMatch(/生成结果/)
    expect(source).not.toMatch(/展示 .* 列执行 prompt 生成的结果图/)
  })

  it('keeps performance monitor runtime feedback english-first', () => {
    const source = readUiSource('src/composables/performance/usePerformanceMonitor.ts')

    expect(source).toContain('Component updates are too frequent. Consider using debounce or throttle.')
    expect(source).toContain('Render time exceeds 16ms and may impact a 60fps experience.')
    expect(source).toContain('Memory usage is high. Check for possible memory leaks.')
    expect(source).toContain('The update-to-render ratio is high. Consider optimizing reactive data flow.')
    expect(source).toContain("return { grade: 'A', color: 'success', text: 'Excellent' }")
    expect(source).not.toMatch(/组件更新过于频繁/)
    expect(source).not.toMatch(/渲染时间超过 16ms/)
    expect(source).not.toMatch(/内存使用量较高/)
    expect(source).not.toMatch(/更新渲染比例过高/)
    expect(source).not.toMatch(/优秀|良好|一般|较差|需要优化/)
  })

  it('keeps accessibility testing runtime copy english-first', () => {
    const source = readUiSource('src/composables/accessibility/useAccessibilityTesting.ts')

    expect(source).toContain('Accessibility Test Report')
    expect(source).toContain('Image is missing alternative text.')
    expect(source).toContain('Form control is missing a label.')
    expect(source).toContain('Link text is not descriptive enough.')
    expect(source).toContain('Button is missing a text label.')
    expect(source).toContain('Accessibility test failed.')
    expect(source).not.toMatch(/可访问性测试报告/)
    expect(source).not.toMatch(/图片缺少替代文本/)
    expect(source).not.toMatch(/表单控件缺少标签/)
    expect(source).not.toMatch(/链接文本不够描述性/)
    expect(source).not.toMatch(/按钮缺少文本标签/)
    expect(source).not.toMatch(/无障碍测试失败/)
  })
})
