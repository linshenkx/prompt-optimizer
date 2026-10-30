import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type ComponentRequirement = {
  component: string
  listeners: string[]
}

type FileComponentRequirement = ComponentRequirement & {
  file: string
  requirePresence?: boolean
}

const sourceRoot = join(process.cwd(), 'src')

const filesToCheck = [
  'components/PromptPanel.vue',
  'components/TestAreaPanel.vue',
  'components/TestResultSection.vue',
  'components/context-mode/ContextUserTestPanel.vue',
  'components/context-mode/ConversationTestPanel.vue',
  'components/basic-mode/BasicUserWorkspace.vue',
  'components/basic-mode/BasicSystemWorkspace.vue',
  'components/context-mode/ContextUserWorkspace.vue',
  'components/context-mode/ContextSystemWorkspace.vue',
  'components/image-mode/ImageText2ImageWorkspace.vue',
  'components/image-mode/ImageImage2ImageWorkspace.vue',
  'components/image-mode/ImageMultiImageWorkspace.vue',
]

const requirements: ComponentRequirement[] = [
  {
    component: 'EvaluationPanel',
    listeners: ['@apply-local-patch', '@apply-improvement'],
  },
  {
    component: 'EvaluationScoreBadge',
    listeners: ['@apply-improvement', '@apply-patch'],
  },
  {
    component: 'PromptPanelUI',
    listeners: ['@apply-improvement', '@apply-patch'],
  },
  {
    component: 'TestResultSection',
    listeners: [
      '@evaluate-with-feedback',
      '@show-primary-detail',
      '@show-secondary-detail',
      '@apply-improvement',
      '@apply-patch',
    ],
  },
]

const workspaceFiles = [
  'components/basic-mode/BasicUserWorkspace.vue',
  'components/basic-mode/BasicSystemWorkspace.vue',
  'components/context-mode/ContextUserWorkspace.vue',
  'components/context-mode/ContextSystemWorkspace.vue',
  'components/image-mode/ImageText2ImageWorkspace.vue',
  'components/image-mode/ImageImage2ImageWorkspace.vue',
  'components/image-mode/ImageMultiImageWorkspace.vue',
]

const promptPanelWorkspaceFiles = workspaceFiles

const textInputWorkspaceFiles = [
  'components/basic-mode/BasicUserWorkspace.vue',
  'components/basic-mode/BasicSystemWorkspace.vue',
  'components/context-mode/ContextUserWorkspace.vue',
]

const promptPanelPreviewWorkspaceFiles = [
  'components/context-mode/ContextUserWorkspace.vue',
  'components/context-mode/ContextSystemWorkspace.vue',
  'components/image-mode/ImageText2ImageWorkspace.vue',
  'components/image-mode/ImageImage2ImageWorkspace.vue',
  'components/image-mode/ImageMultiImageWorkspace.vue',
]

const promptPanelOriginalVersionWorkspaceFiles = [
  'components/basic-mode/BasicUserWorkspace.vue',
  'components/basic-mode/BasicSystemWorkspace.vue',
  'components/context-mode/ContextUserWorkspace.vue',
  'components/context-mode/ContextSystemWorkspace.vue',
]

const buildFileRequirements = (
  files: string[],
  component: string,
  listeners: string[],
): FileComponentRequirement[] =>
  files.map((file) => ({
    file,
    component,
    listeners,
    requirePresence: true,
  }))

const workspaceRequirements: FileComponentRequirement[] = [
  ...buildFileRequirements(workspaceFiles, 'WorkspaceUtilityMenu', ['@clear']),
  ...buildFileRequirements(textInputWorkspaceFiles, 'InputPanelUI', [
    '@submit',
    '@analyze',
  ]),
  ...buildFileRequirements(promptPanelWorkspaceFiles, 'PromptPanelUI', [
    '@iterate',
    '@openTemplateManager',
    '@switchVersion',
    '@save-favorite',
    '@apply-improvement',
    '@apply-patch',
    '@save-local-edit',
  ]),
  ...buildFileRequirements(promptPanelPreviewWorkspaceFiles, 'PromptPanelUI', [
    '@open-preview',
  ]),
  ...buildFileRequirements(promptPanelOriginalVersionWorkspaceFiles, 'PromptPanelUI', [
    '@switchToV0',
  ]),
  ...buildFileRequirements(workspaceFiles, 'TextModelSelector', [
    ':options',
    ':disabled',
    '@focus',
  ]),
]

const extractComponentBlocks = (source: string, component: string) => {
  const lines = source.split(/\r?\n/)
  const blocks: Array<{ line: number; text: string }> = []

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index]?.includes(`<${component}`)) continue

    const start = index
    const collected: string[] = []
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] || ''
      collected.push(line)
      if (line.includes('/>') || line.includes(`</${component}>`)) {
        index = cursor
        break
      }
    }

    blocks.push({
      line: start + 1,
      text: collected.join('\n'),
    })
  }

  return blocks
}

const collectMissingListeners = (requirementsToCheck: FileComponentRequirement[]) => {
  const missing: string[] = []

  for (const requirement of requirementsToCheck) {
    const source = readFileSync(join(sourceRoot, requirement.file), 'utf8')
    const blocks = extractComponentBlocks(source, requirement.component)

    if (blocks.length === 0) {
      if (requirement.requirePresence) {
        missing.push(`${requirement.file} missing <${requirement.component}>`)
      }
      continue
    }

    for (const block of blocks) {
      const missingListeners = requirement.listeners.filter(
        (listener) => !block.text.includes(listener),
      )

      if (missingListeners.length) {
        missing.push(
          `${requirement.file}:${block.line} <${requirement.component}> missing ${missingListeners.join(', ')}`,
        )
      }
    }
  }

  return missing
}

describe('evaluation action wiring', () => {
  it('keeps apply action events connected at workspace boundaries', () => {
    const requirementsToCheck = filesToCheck.flatMap((file) =>
      requirements.map((requirement) => ({
        ...requirement,
        file,
      })),
    )

    const missing = collectMissingListeners(requirementsToCheck)

    expect(missing).toEqual([])
  })

  it('keeps shared workspace action controls wired consistently across modes', () => {
    const missing = collectMissingListeners(workspaceRequirements)

    expect(missing).toEqual([])
  })

  it('keeps column model selection connected through the shared config control', () => {
    const textWorkspaceFiles = promptPanelOriginalVersionWorkspaceFiles
    const missing = collectMissingListeners([
      ...buildFileRequirements(textWorkspaceFiles, 'TestVariantConfig', [
        ':model-key', ':options', ':refresh-models', '@update:model-key', '@config',
      ]),
      ...buildFileRequirements(['components/TestVariantConfig.vue'], 'TextModelSelector', [
        ':model-value', ':options', 'scope="column"', '@update:model-value', '@focus', '@config',
      ]),
    ])

    for (const file of workspaceFiles) {
      const source = readFileSync(join(sourceRoot, file), 'utf8')
      for (const block of extractComponentBlocks(source, 'TextModelSelector')) {
        if (!block.text.includes('v-model=') &&
          !(block.text.includes(':model-value=') && block.text.includes('@update:model-value='))) {
          missing.push(`${file}:${block.line} missing a two-way model selection binding`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('keeps image column model selection, refresh and configuration connected', () => {
    const missing = collectMissingListeners(buildFileRequirements(
      workspaceFiles.filter(file => file.includes('/image-mode/')),
      'ImageModelSelector',
      [':model-value', '@update:model-value', ':options', '@focus', '@config'],
    ))

    expect(missing).toEqual([])
  })
})
