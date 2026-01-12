import { test, expect } from '../fixtures'

type ModeCase = {
  name: string
  route: string
  templateLabel: RegExp
  switchTo: string
  workspaceMode: string
}

const MODE_CASES: ModeCase[] = [
  {
    name: 'basic-system',
    route: '/#/basic/system',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/pro/variable',
    workspaceMode: 'basic-system',
  },
  {
    name: 'basic-user',
    route: '/#/basic/user',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/pro/variable',
    workspaceMode: 'basic-user',
  },
  {
    name: 'pro-multi',
    route: '/#/pro/multi',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/image/text2image',
    workspaceMode: 'pro-multi',
  },
  {
    name: 'pro-variable',
    route: '/#/pro/variable',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/image/text2image',
    workspaceMode: 'pro-variable',
  },
  {
    name: 'image-text2image',
    route: '/#/image/text2image',
    templateLabel: /优化模板|Optimization Template/i,
    switchTo: '/#/basic/user',
    workspaceMode: 'image-text2image',
  },
  {
    name: 'image-image2image',
    route: '/#/image/image2image',
    templateLabel: /优化模板|Optimization Template/i,
    switchTo: '/#/basic/user',
    workspaceMode: 'image-image2image',
  },
]

function normalizeText(text: string | null | undefined): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

async function gotoMode(page: any, route: string) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.goto(route)
  await page.waitForLoadState('networkidle')
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

  // Naive UI Select options are rendered in a portal and may appear after async options load.
  // Retry once to reduce flakiness when the first click happens before options are ready.
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

test.describe('Template default selection + cross-mode persistence', () => {
  for (const c of MODE_CASES) {
    test(`${c.name}: first open selects first template by default`, async ({ page }) => {
      await gotoMode(page, c.route)
      await waitForWorkspace(page, c.workspaceMode)

      const templateSelect = await getSelectByLabel(page, c.templateLabel)
      const options = await openSelectAndGetOptions(page, templateSelect)

      expect(options.length).toBeGreaterThan(0)
      const first = options[0]

      await expectSelectionEquals(page, templateSelect, first)
    })
  }

  for (const c of MODE_CASES) {
    test(`${c.name}: selecting last template persists across mode switch + reload + back`, async ({ page }) => {
      await gotoMode(page, c.route)
      await waitForWorkspace(page, c.workspaceMode)

      const templateSelect = await getSelectByLabel(page, c.templateLabel)
      // Open and select the last option (avoid relying on a cached index across opens)
      const optionLocator = await openSelectAndWaitForOptions(page, templateSelect)

      const count = await optionLocator.count()
      expect(count).toBeGreaterThan(0)
      if (count < 2) {
        test.skip(true, `${c.name} has only one template option`)
      }

      const lastOption = optionLocator.nth(count - 1)
      const last = normalizeText(await lastOption.textContent())
      await lastOption.click()

      await expectSelectionEquals(page, templateSelect, last)

      // Switch to another mode, reload, then switch back
      await page.goto(c.switchTo)
      await page.waitForLoadState('networkidle')
      await waitForWorkspace(page, workspaceModeFromRoute(c.switchTo))

      await page.reload()
      await page.waitForLoadState('networkidle')
      await waitForWorkspace(page, workspaceModeFromRoute(c.switchTo))

      await page.goto(c.route)
      await page.waitForLoadState('networkidle')
      await waitForWorkspace(page, c.workspaceMode)

      const templateSelectAfter = await getSelectByLabel(page, c.templateLabel)
      await expectSelectionEquals(page, templateSelectAfter, last)
    })
  }
})
