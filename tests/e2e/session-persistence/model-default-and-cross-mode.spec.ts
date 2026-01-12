import { test, expect } from '../fixtures'

type ModeCase = {
  name: string
  route: string
  modelLabel: RegExp
  switchTo: string
  workspaceMode: string
}

const LABEL_OPTIMIZATION_MODEL = /优化模型|Optimization Model/i
const LABEL_TEXT_MODEL = /Text Model|文本模型/i

const MODE_CASES: ModeCase[] = [
  {
    name: 'basic-system',
    route: '/#/basic/system',
    modelLabel: LABEL_OPTIMIZATION_MODEL,
    switchTo: '/#/pro/variable',
    workspaceMode: 'basic-system',
  },
  {
    name: 'basic-user',
    route: '/#/basic/user',
    modelLabel: LABEL_OPTIMIZATION_MODEL,
    switchTo: '/#/pro/variable',
    workspaceMode: 'basic-user',
  },
  {
    name: 'pro-multi',
    route: '/#/pro/multi',
    modelLabel: LABEL_OPTIMIZATION_MODEL,
    switchTo: '/#/image/text2image',
    workspaceMode: 'pro-multi',
  },
  {
    name: 'pro-variable',
    route: '/#/pro/variable',
    modelLabel: LABEL_OPTIMIZATION_MODEL,
    switchTo: '/#/image/text2image',
    workspaceMode: 'pro-variable',
  },
  {
    name: 'image-text2image',
    route: '/#/image/text2image',
    modelLabel: LABEL_TEXT_MODEL,
    switchTo: '/#/basic/user',
    workspaceMode: 'image-text2image',
  },
  {
    name: 'image-image2image',
    route: '/#/image/image2image',
    modelLabel: LABEL_TEXT_MODEL,
    switchTo: '/#/basic/user',
    workspaceMode: 'image-image2image',
  },
]

function normalizeText(text: string | null | undefined): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function workspaceModeFromRoute(route: string): string {
  if (route.includes('/#/basic/system')) return 'basic-system'
  if (route.includes('/#/basic/user')) return 'basic-user'
  if (route.includes('/#/pro/multi')) return 'pro-multi'
  if (route.includes('/#/pro/variable')) return 'pro-variable'
  if (route.includes('/#/image/text2image')) return 'image-text2image'
  if (route.includes('/#/image/image2image')) return 'image-image2image'
  return ''
}

async function gotoMode(page: any, route: string) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.goto(route)
  await page.waitForLoadState('networkidle')
}

async function waitForWorkspace(page: any, mode: string) {
  const workspace = page.locator(`[data-testid="workspace"][data-mode="${mode}"]`).first()
  await expect(workspace).toBeVisible({ timeout: 20000 })
}

async function getSelectByLabel(page: any, label: RegExp) {
  const labelEl = page.getByText(label).first()
  await expect(labelEl).toBeVisible({ timeout: 20000 })

  const container = labelEl.locator(
    'xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]'
  )
  const select = container.locator('.n-base-selection').first()
  await expect(select).toBeVisible({ timeout: 20000 })
  return select
}

async function openSelectAndWaitForOptions(page: any, select: any) {
  const optionLocator = page.locator('.n-base-select-option')

  await select.click()

  const ensureOptionsVisible = async () => {
    await expect
      .poll(async () => await optionLocator.count(), { timeout: 20000 })
      .toBeGreaterThan(0)
  }

  try {
    await ensureOptionsVisible()
  } catch {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await select.click()
    await ensureOptionsVisible()
  }

  return optionLocator
}

async function openSelectAndGetOptions(page: any, select: any): Promise<string[]> {
  const optionLocator = await openSelectAndWaitForOptions(page, select)
  const options = (await optionLocator.allTextContents()).map(normalizeText).filter(Boolean)
  await page.keyboard.press('Escape')
  return options
}

async function expectSelectionEquals(page: any, select: any, expected: string) {
  await expect.poll(async () => normalizeText(await select.textContent()), { timeout: 20000 })
    .toBe(normalizeText(expected))
}

test.describe('Model default selection + cross-mode persistence', () => {
  for (const c of MODE_CASES) {
    test(`${c.name}: first open selects first model by default`, async ({ page }) => {
      await gotoMode(page, c.route)
      await waitForWorkspace(page, c.workspaceMode)

      const modelSelect = await getSelectByLabel(page, c.modelLabel)
      const options = await openSelectAndGetOptions(page, modelSelect)

      expect(options.length).toBeGreaterThan(0)
      const first = options[0]

      await expectSelectionEquals(page, modelSelect, first)
    })
  }

  for (const c of MODE_CASES) {
    test(`${c.name}: selecting last model persists across mode switch + reload + back`, async ({ page }) => {
      await gotoMode(page, c.route)
      await waitForWorkspace(page, c.workspaceMode)

      const modelSelect = await getSelectByLabel(page, c.modelLabel)
      const optionLocator = await openSelectAndWaitForOptions(page, modelSelect)

      const count = await optionLocator.count()
      expect(count).toBeGreaterThan(0)
      if (count < 2) {
        test.skip(true, `${c.name} has only one model option`)
      }

      const lastOption = optionLocator.nth(count - 1)
      const last = normalizeText(await lastOption.textContent())
      await lastOption.click()

      await expectSelectionEquals(page, modelSelect, last)

      await page.goto(c.switchTo)
      await page.waitForLoadState('networkidle')
      await waitForWorkspace(page, workspaceModeFromRoute(c.switchTo))

      await page.reload()
      await page.waitForLoadState('networkidle')
      await waitForWorkspace(page, workspaceModeFromRoute(c.switchTo))

      await page.goto(c.route)
      await page.waitForLoadState('networkidle')
      await waitForWorkspace(page, c.workspaceMode)

      const modelSelectAfter = await getSelectByLabel(page, c.modelLabel)
      await expectSelectionEquals(page, modelSelectAfter, last)
    })
  }
})
