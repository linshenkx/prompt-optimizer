import { test, expect } from '../fixtures'

type ModeCase = {
  name: string
  route: string
  templateLabel: RegExp
  switchTo: string
}

const MODE_CASES: ModeCase[] = [
  {
    name: 'basic-system',
    route: '/#/basic/system',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/pro/variable',
  },
  {
    name: 'basic-user',
    route: '/#/basic/user',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/pro/variable',
  },
  {
    name: 'pro-multi',
    route: '/#/pro/multi',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/image/text2image',
  },
  {
    name: 'pro-variable',
    route: '/#/pro/variable',
    templateLabel: /优化提示词模板|Optimization Template/i,
    switchTo: '/#/image/text2image',
  },
  {
    name: 'image-text2image',
    route: '/#/image/text2image',
    templateLabel: /优化模板|Optimization Template/i,
    switchTo: '/#/basic/user',
  },
  {
    name: 'image-image2image',
    route: '/#/image/image2image',
    templateLabel: /优化模板|Optimization Template/i,
    switchTo: '/#/basic/user',
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

async function openSelectAndGetOptions(page: any, select: any): Promise<string[]> {
  await select.click()
  const optionLocator = page.locator('.n-base-select-option')
  await expect(optionLocator.first()).toBeVisible({ timeout: 20000 })
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

      const templateSelect = await getSelectByLabel(page, c.templateLabel)
      // Open and select the last option (avoid relying on a cached index across opens)
      await templateSelect.click()
      const optionLocator = page.locator('.n-base-select-option')
      await expect(optionLocator.first()).toBeVisible({ timeout: 20000 })

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

      await page.reload()
      await page.waitForLoadState('networkidle')

      await page.goto(c.route)
      await page.waitForLoadState('networkidle')

      const templateSelectAfter = await getSelectByLabel(page, c.templateLabel)
      await expectSelectionEquals(page, templateSelectAfter, last)
    })
  }
})
