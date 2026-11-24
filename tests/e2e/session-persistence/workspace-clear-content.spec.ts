import { resolve } from 'node:path'

import { test, expect, type Page } from '../fixtures'
import { navigateToMode, switchModeViaUI } from '../helpers/common'
import {
  addProMultiUserMessage,
  fillOriginalPrompt,
  getWorkspace,
  readOutputByTestIdText,
  type OptimizeWorkspaceMode,
} from '../helpers/optimize'

const BASIC_USER_PROMPT = 'E2E clear content should remove only basic user prompt'
const IMAGE_TEXT2IMAGE_PROMPT = 'E2E image text2image prompt must survive basic user clear'

type ClearableWorkspaceMode = OptimizeWorkspaceMode | 'image-multiimage'

type WorkspaceRoute = {
  mode: 'basic' | 'pro' | 'image'
  subMode: string
  workspaceMode: ClearableWorkspaceMode
}

type WorkspaceClearCase = WorkspaceRoute & {
  name: string
  seed: (page: Page) => Promise<void>
  expectSeeded: (page: Page) => Promise<void>
  expectCleared: (page: Page) => Promise<void>
  expectDerivedSeeded?: (page: Page) => Promise<void>
  expectDerivedCleared?: (page: Page) => Promise<void>
}

const IMAGE_FIXTURE = resolve(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')
const SECOND_IMAGE_FIXTURE = resolve(process.cwd(), 'packages/desktop/icons/app-icon.png')
const FAKE_IMAGE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

const TEXT_RESULT_MODES = new Set<ClearableWorkspaceMode>([
  'basic-system',
  'basic-user',
  'pro-multi',
  'pro-variable',
])

const IMAGE_RESULT_MODES = new Set<ClearableWorkspaceMode>([
  'image-text2image',
  'image-image2image',
  'image-multiimage',
])

async function getOriginalPromptEditor(page: Page, mode: ClearableWorkspaceMode) {
  const workspace = getWorkspace(page, mode)
  await expect(workspace).toBeVisible({ timeout: 20000 })

  const input = workspace.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 20000 })

  return input
}

async function readOriginalPromptValue(page: Page, mode: ClearableWorkspaceMode): Promise<string> {
  const input = await getOriginalPromptEditor(page, mode)
  const textarea = input.locator('textarea').first()
  if ((await textarea.count()) > 0) {
    return textarea.inputValue()
  }

  const cmContent = input.locator('.cm-content').first()
  if ((await cmContent.count()) > 0) {
    if ((await cmContent.locator('.cm-placeholder').count()) > 0) {
      return ''
    }
    return (await cmContent.innerText()).trim()
  }

  return ''
}

async function expectOriginalPromptValue(page: Page, mode: ClearableWorkspaceMode, value: string) {
  await expect.poll(async () => readOriginalPromptValue(page, mode), { timeout: 20000 }).toBe(value)
}

function getStoreId(mode: ClearableWorkspaceMode) {
  return {
    'basic-system': 'basicSystemSession',
    'basic-user': 'basicUserSession',
    'pro-multi': 'proMultiMessageSession',
    'pro-variable': 'proVariableSession',
    'image-text2image': 'imageText2ImageSession',
    'image-image2image': 'imageImage2ImageSession',
    'image-multiimage': 'imageMultiImageSession',
  }[mode]
}

function getTextOutputTestIds(mode: ClearableWorkspaceMode) {
  return {
    original: `${mode}-test-original-output`,
    optimized: `${mode}-test-optimized-output`,
  }
}

function getImageOutputTestIds(mode: ClearableWorkspaceMode) {
  const prefix = mode
  return {
    original: `${prefix}-original-image`,
    optimized: `${prefix}-optimized-image`,
  }
}

async function fillTestInputIfAvailable(page: Page, mode: ClearableWorkspaceMode) {
  const input = page.getByTestId(`${mode}-test-input`)
  if ((await input.count()) === 0) return

  const textarea = input.locator('textarea').first()
  await expect(textarea).toBeVisible({ timeout: 10000 })
  await textarea.fill(`E2E test input ${mode}`)
}

async function expectTestInputClearedIfAvailable(page: Page, mode: ClearableWorkspaceMode) {
  const input = page.getByTestId(`${mode}-test-input`)
  if ((await input.count()) === 0) return

  await expect(input.locator('textarea').first()).toHaveValue('')
}

async function seedAndPersistDerivedState(page: Page, mode: ClearableWorkspaceMode) {
  await fillTestInputIfAvailable(page, mode)

  await page.evaluate(
    async ({ mode, storeId, fakeImageB64 }) => {
      const app = (document.querySelector('#app') as any)?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      const store = pinia?._s?.get(storeId)
      if (!store) throw new Error(`Store not found for ${mode}: ${storeId}`)

      store.updateOptimizedResult?.({
        optimizedPrompt: `E2E optimized workspace result ${mode}`,
        reasoning: `E2E reasoning ${mode}`,
        chainId: '',
        versionId: '',
      })
      store.updateTestContent?.(`E2E test input ${mode}`)

      if (mode === 'pro-multi' && store.updateConversationMessages) {
        const messages = Array.isArray(store.conversationMessagesSnapshot)
          ? store.conversationMessagesSnapshot
          : []
        if (messages.length === 0) {
          store.updateConversationMessages([
            {
              id: `e2e-message-${mode}`,
              role: 'user',
              content: `E2E clear pro multi message`,
              timestamp: Date.now(),
            },
          ])
        }
      }

      const textResult = {
        a: { result: `E2E test result ${mode} original`, reasoning: `E2E result reasoning ${mode} original` },
        b: { result: `E2E test result ${mode} optimized`, reasoning: `E2E result reasoning ${mode} optimized` },
        c: { result: '', reasoning: '' },
        d: { result: '', reasoning: '' },
      }

      const imageResult = (label: string) => ({
        images: [{ b64: fakeImageB64, mimeType: 'image/png' }],
        text: `E2E image test result ${mode} ${label}`,
        metadata: {
          providerId: 'e2e',
          modelId: 'e2e-image-model',
          configId: 'e2e-config',
          tokenUsage: {
            totalTokens: 12,
          },
        },
      })

      if (mode.startsWith('image-')) {
        store.updateOriginalImageResult?.(imageResult('original'))
        store.updateOptimizedImageResult?.(imageResult('optimized'))
        store.updateTestVariantResult?.('a', imageResult('original'))
        store.updateTestVariantResult?.('b', imageResult('optimized'))
        store.setTestVariantLastRunFingerprint?.('a', `e2e-fingerprint-${mode}-a`)
        store.setTestVariantLastRunFingerprint?.('b', `e2e-fingerprint-${mode}-b`)
      } else {
        store.testVariantResults = {
          ...(store.testVariantResults || {}),
          ...textResult,
        }
        store.testVariantLastRunFingerprint = {
          ...(store.testVariantLastRunFingerprint || {}),
          a: `e2e-fingerprint-${mode}-a`,
          b: `e2e-fingerprint-${mode}-b`,
        }
      }

      await store.saveSession?.()
    },
    { mode, storeId: getStoreId(mode), fakeImageB64: FAKE_IMAGE_B64 },
  )
}

async function expectDerivedSeeded(page: Page, mode: ClearableWorkspaceMode) {
  if (TEXT_RESULT_MODES.has(mode)) {
    const ids = getTextOutputTestIds(mode)
    await expect
      .poll(async () => readOutputByTestIdText(page, ids.original), { timeout: 20000 })
      .toContain(`E2E test result ${mode} original`)
    await expect
      .poll(async () => readOutputByTestIdText(page, ids.optimized), { timeout: 20000 })
      .toContain(`E2E test result ${mode} optimized`)
  }

  if (IMAGE_RESULT_MODES.has(mode)) {
    const ids = getImageOutputTestIds(mode)
    await expect(page.getByTestId(ids.original).locator('img')).toHaveAttribute('src', /^data:image\//, { timeout: 20000 })
    await expect(page.getByTestId(ids.optimized).locator('img')).toHaveAttribute('src', /^data:image\//, { timeout: 20000 })
  }
}

async function expectDerivedCleared(page: Page, mode: ClearableWorkspaceMode) {
  await expectTestInputClearedIfAvailable(page, mode)

  const workspace = getWorkspace(page, mode)
  await expect(workspace.getByText(`E2E test result ${mode} original`)).toHaveCount(0)
  await expect(workspace.getByText(`E2E test result ${mode} optimized`)).toHaveCount(0)
  await expect(workspace.getByText(`E2E image test result ${mode} original`)).toHaveCount(0)
  await expect(workspace.getByText(`E2E image test result ${mode} optimized`)).toHaveCount(0)

  if (IMAGE_RESULT_MODES.has(mode)) {
    const ids = getImageOutputTestIds(mode)
    await expect(page.getByTestId(ids.original)).toHaveCount(0)
    await expect(page.getByTestId(ids.optimized)).toHaveCount(0)
  }
}

async function clearWorkspaceContent(page: Page, mode: ClearableWorkspaceMode) {
  await page.getByTestId(`${mode}-workspace-utility-menu`).click()

  const clearOption = page.locator('.n-dropdown-option').filter({
    hasText: /清理内容|Clear Content|清理內容/i,
  })
  await expect(clearOption).toBeVisible({ timeout: 10000 })
  await clearOption.click()

  const dialog = page.locator('.n-dialog').filter({
    hasText: /清理内容|Clear Content|清理內容/i,
  }).last()
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await expect(dialog).toContainText(/提示词、派生结果、测试结果、临时变量|prompts, derived results, test (results|outputs), temporary variables/i)
  await expect(dialog).toContainText(/模型、模板、布局选择|model, template, (and )?layout selections/i)

  await dialog.getByRole('button', { name: /确认|Confirm|確定/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10000 })
}

async function switchToWorkspace(
  page: Page,
  mode: 'basic' | 'pro' | 'image',
  subMode: string,
  workspaceMode: ClearableWorkspaceMode,
) {
  await switchModeViaUI(page, mode, subMode)
  await expect(getWorkspace(page, workspaceMode)).toBeVisible({ timeout: 20000 })
}

async function navigateToWorkspace(page: Page, route: WorkspaceRoute) {
  await navigateToMode(page, route.mode, route.subMode)
  await expect(getWorkspace(page, route.workspaceMode)).toBeVisible({ timeout: 20000 })
}

async function fillPrompt(page: Page, mode: Exclude<OptimizeWorkspaceMode, 'pro-multi'>, value: string) {
  await fillOriginalPrompt(page, mode, value)
}

async function fillPromptWithoutWaitingForActions(page: Page, mode: ClearableWorkspaceMode, value: string) {
  const input = await getOriginalPromptEditor(page, mode)
  const cmContent = input.locator('.cm-content').first()
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
    return
  }

  const textarea = input.locator('textarea').first()
  await expect(textarea).toBeVisible({ timeout: 20000 })
  await textarea.fill(value)
}

async function seedImageImage2Image(page: Page) {
  await page.getByTestId('image-image2image-open-upload').click()
  await page.getByTestId('image-image2image-upload').locator('input[type="file"]').setInputFiles(IMAGE_FIXTURE)
  await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('image-image2image-upload-modal')).toBeHidden({ timeout: 20000 })
  await fillPromptWithoutWaitingForActions(page, 'image-image2image', 'E2E clear image2image prompt')
}

async function seedImageMultiImage(page: Page) {
  const workspace = getWorkspace(page, 'image-multiimage')
  await expect(workspace).toBeVisible({ timeout: 20000 })

  await fillPromptWithoutWaitingForActions(page, 'image-multiimage', 'E2E clear multiimage prompt')
  await workspace.locator('input[type="file"]').first().setInputFiles([IMAGE_FIXTURE, SECOND_IMAGE_FIXTURE])

  await expect(workspace.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
  await expect(workspace.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })
}

async function expectProMultiSeedMessage(page: Page, visible: boolean) {
  await expect.poll(
    async () => {
      const cards = page.locator('[data-testid^="pro-multi-message-card-"]')
      const values: string[] = []
      for (let i = 0; i < await cards.count(); i += 1) {
        const card = cards.nth(i)
        const textarea = card.locator('textarea').first()
        if ((await textarea.count()) > 0) {
          values.push(await textarea.inputValue())
          continue
        }

        const cmContent = card.locator('.cm-content').first()
        if ((await cmContent.count()) > 0 && (await cmContent.locator('.cm-placeholder').count()) === 0) {
          values.push((await cmContent.innerText()).trim())
        }
      }
      return values.some((value) => value.includes('E2E clear pro multi message'))
    },
    { timeout: 20000 },
  ).toBe(visible)
}

const CLEAR_CASES: WorkspaceClearCase[] = [
  {
    name: 'basic-system',
    mode: 'basic',
    subMode: 'system',
    workspaceMode: 'basic-system',
    seed: (page) => fillPrompt(page, 'basic-system', 'E2E clear basic system prompt'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'basic-system', 'E2E clear basic system prompt'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'basic-system', ''),
  },
  {
    name: 'basic-user',
    mode: 'basic',
    subMode: 'user',
    workspaceMode: 'basic-user',
    seed: (page) => fillPrompt(page, 'basic-user', 'E2E clear basic user prompt'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'basic-user', 'E2E clear basic user prompt'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'basic-user', ''),
  },
  {
    name: 'pro-multi',
    mode: 'pro',
    subMode: 'multi',
    workspaceMode: 'pro-multi',
    seed: async (page) => {
      await addProMultiUserMessage(page, 'E2E clear pro multi message')
    },
    expectSeeded: (page) => expectProMultiSeedMessage(page, true),
    expectCleared: async (page) => {
      await expectProMultiSeedMessage(page, false)
    },
  },
  {
    name: 'pro-variable',
    mode: 'pro',
    subMode: 'variable',
    workspaceMode: 'pro-variable',
    seed: (page) => fillPrompt(page, 'pro-variable', 'E2E clear pro variable prompt {{topic}}'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'pro-variable', 'E2E clear pro variable prompt {{topic}}'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'pro-variable', ''),
  },
  {
    name: 'image-text2image',
    mode: 'image',
    subMode: 'text2image',
    workspaceMode: 'image-text2image',
    seed: (page) => fillPrompt(page, 'image-text2image', 'E2E clear text2image prompt'),
    expectSeeded: (page) => expectOriginalPromptValue(page, 'image-text2image', 'E2E clear text2image prompt'),
    expectCleared: (page) => expectOriginalPromptValue(page, 'image-text2image', ''),
  },
  {
    name: 'image-image2image',
    mode: 'image',
    subMode: 'image2image',
    workspaceMode: 'image-image2image',
    seed: seedImageImage2Image,
    expectSeeded: async (page) => {
      await expectOriginalPromptValue(page, 'image-image2image', 'E2E clear image2image prompt')
      await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })
    },
    expectCleared: async (page) => {
      await expectOriginalPromptValue(page, 'image-image2image', '')
      await expect(page.getByTestId('image-image2image-input-preview')).toHaveCount(0)
    },
  },
  {
    name: 'image-multiimage',
    mode: 'image',
    subMode: 'multiimage',
    workspaceMode: 'image-multiimage',
    seed: seedImageMultiImage,
    expectSeeded: async (page) => {
      await expectOriginalPromptValue(page, 'image-multiimage', 'E2E clear multiimage prompt')
      const workspace = getWorkspace(page, 'image-multiimage')
      await expect(workspace.getByTestId('image-multiimage-card-1')).toBeVisible({ timeout: 20000 })
      await expect(workspace.getByTestId('image-multiimage-card-2')).toBeVisible({ timeout: 20000 })
    },
    expectCleared: async (page) => {
      await expectOriginalPromptValue(page, 'image-multiimage', '')
      const workspace = getWorkspace(page, 'image-multiimage')
      await expect(workspace.getByTestId('image-multiimage-card-1')).toHaveCount(0)
      await expect(workspace.getByTestId('image-multiimage-card-2')).toHaveCount(0)
    },
  },
]

test.describe('Workspace clear content', () => {
  test.describe.configure({ timeout: 60000 })

  for (const c of CLEAR_CASES) {
    test(`${c.name}: clear content only clears content and persists after reload`, async ({ page }) => {
      await navigateToWorkspace(page, c)

      await c.seed(page)
      await c.expectSeeded(page)
      await seedAndPersistDerivedState(page, c.workspaceMode)
      await expectDerivedSeeded(page, c.workspaceMode)
      await c.expectDerivedSeeded?.(page)

      await clearWorkspaceContent(page, c.workspaceMode)
      await c.expectCleared(page)
      await expectDerivedCleared(page, c.workspaceMode)
      await c.expectDerivedCleared?.(page)

      if (c.workspaceMode === 'pro-multi') {
        await switchToWorkspace(page, 'pro', 'variable', 'pro-variable')
        await switchToWorkspace(page, 'pro', 'multi', 'pro-multi')
        await expect(page.locator('[data-testid^="pro-multi-message-card-"]')).toHaveCount(0)
      }

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(getWorkspace(page, c.workspaceMode)).toBeVisible({ timeout: 20000 })
      await c.expectCleared(page)
      await expectDerivedCleared(page, c.workspaceMode)
      await c.expectDerivedCleared?.(page)
    })
  }

  test('clears only the active workspace content and persists after reload', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')
    await fillOriginalPrompt(page, 'basic-user', BASIC_USER_PROMPT)
    await expectOriginalPromptValue(page, 'basic-user', BASIC_USER_PROMPT)

    // Switching workspaces saves the previous session through the same path real users exercise.
    await switchToWorkspace(page, 'image', 'text2image', 'image-text2image')
    await fillOriginalPrompt(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)
    await expectOriginalPromptValue(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)

    await switchToWorkspace(page, 'basic', 'user', 'basic-user')
    await expectOriginalPromptValue(page, 'basic-user', BASIC_USER_PROMPT)

    await clearWorkspaceContent(page, 'basic-user')
    await expectOriginalPromptValue(page, 'basic-user', '')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(getWorkspace(page, 'basic-user')).toBeVisible({ timeout: 20000 })
    await expectOriginalPromptValue(page, 'basic-user', '')

    await switchToWorkspace(page, 'image', 'text2image', 'image-text2image')
    await expectOriginalPromptValue(page, 'image-text2image', IMAGE_TEXT2IMAGE_PROMPT)
  })
})
