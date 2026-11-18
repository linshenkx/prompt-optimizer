import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Keep the three independently deployed documentation surfaces on the same assets.
const root = fileURLToPath(new URL('../', import.meta.url))
const sourceDir = path.join(root, 'images/product/2026-11')
const check = process.argv.includes('--check')
const scenariosWithoutDocs = ['system-workspace', 'variable-workspace', 'variable-workspace-low-offer']
const scenarios = ['basic-workspace', ...scenariosWithoutDocs, 'arena-comparison', 'model-parameters', 'model-manager', 'model-form']
let different = 0

for (const [locale, docsLocale] of [['zh-CN', 'zh'], ['en', 'en']]) {
  for (const scenario of scenarios) {
    const name = `${scenario}-${locale}.jpg`
    const source = path.join(sourceDir, name)
    const canonical = await readFile(source)
    const destinations = scenariosWithoutDocs.includes(scenario)
      ? []
      : [path.join(root, `mkdocs/docs/${docsLocale}/assets/images/product/2026-11/${scenario}.jpg`)]
    if (['system-workspace', 'arena-comparison'].includes(scenario)) {
      destinations.push(path.join(root, `site/public/images/product/2026-11/${name}`))
    }
    for (const destination of destinations) {
      if (check) {
        const actual = await readFile(destination).catch(() => null)
        if (!actual || !canonical.equals(actual)) {
          console.error(`Out of sync: ${path.relative(root, destination)}`)
          different++
        }
      } else {
        await mkdir(path.dirname(destination), { recursive: true })
        await copyFile(source, destination)
      }
    }
  }
}

if (different) process.exitCode = 1
else console.log(check ? 'Product screenshots match.' : 'Product screenshots synchronized.')
