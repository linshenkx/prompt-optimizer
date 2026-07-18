import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 相对本测试文件定位 packages/core/src，不依赖 process.cwd()。 */
const corePackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const readCoreSource = (relativePath: string) =>
  readFileSync(resolve(corePackageRoot, relativePath), 'utf8')

describe('core runtime english guards', () => {
  it('keeps prompt and template services free of hardcoded chinese runtime defaults', () => {
    const promptServiceSource = readCoreSource('src/services/prompt/service.ts')
    const templateLanguageSource = readCoreSource('src/services/template/languageService.ts')
    const templateLanguageProxySource = readCoreSource('src/services/template/electron-language-proxy.ts')
    const templateManagerSource = readCoreSource('src/services/template/manager.ts')
    const templateProcessorSource = readCoreSource('src/services/template/processor.ts')
    const variableExtractionSource = readCoreSource('src/services/variable-extraction/service.ts')

    expect(promptServiceSource).toMatch(/label:\s*`Image \$\{index \+ 1\}`/)
    expect(promptServiceSource).not.toMatch(/label:\s*`图\$\{index \+ 1\}`/)

    expect(templateLanguageSource).toMatch(/return '中文'/)
    expect(templateLanguageProxySource).toMatch(/return '中文'/)

    expect(templateManagerSource).toContain('(Imported copy)')
    expect(templateManagerSource).not.toMatch(/\(导入副本\)/)

    expect(templateProcessorSource).toMatch(/Tool name:/)
    expect(templateProcessorSource).toMatch(/Description:/)
    expect(templateProcessorSource).toMatch(/Parameters:/)
    expect(templateProcessorSource).not.toMatch(/工具名称:/)

    expect(variableExtractionSource).toMatch(/\|\| 'None'/)
    expect(variableExtractionSource).not.toMatch(/\|\| '无'/)
  })
})
