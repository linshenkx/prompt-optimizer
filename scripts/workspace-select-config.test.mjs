import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const workspaceFiles = [
  '../packages/ui/src/components/basic-mode/BasicSystemWorkspace.vue',
  '../packages/ui/src/components/basic-mode/BasicUserWorkspace.vue',
  '../packages/ui/src/components/context-mode/ContextSystemWorkspace.vue',
  '../packages/ui/src/components/context-mode/ContextUserWorkspace.vue',
]

const requiredBindings = [
  ':placeholder=',
  'filterable',
  ':show-config-action="true"',
  ':show-empty-config-c-t-a="true"',
  '@focus=',
  '@config=',
]

for (const relativePath of workspaceFiles) {
  const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url))

  test(`${relativePath} keeps configuration access on every workspace selector`, async () => {
    const source = await readFile(absolutePath, 'utf8')
    const selectors = source.match(/<SelectWithConfig\b[\s\S]*?\/>/g) ?? []

    const textSelectors = source.match(/<TextModelSelector\b[\s\S]*?\/>/g) ?? []
    assert.equal(selectors.length, 1, 'expected the prompt-template selector')
    assert.equal(textSelectors.length, 2, 'expected shared optimize-model and test-model selectors')
    for (const selector of textSelectors) {
      for (const binding of [':placeholder=', '@focus=', '@config=']) {
        assert.ok(selector.includes(binding), `text selector is missing ${binding}`)
      }
    }

    for (const [index, selector] of selectors.entries()) {
      for (const binding of requiredBindings) {
        assert.ok(
          selector.includes(binding),
          `selector ${index + 1} is missing ${binding}`,
        )
      }
    }
  })
}
