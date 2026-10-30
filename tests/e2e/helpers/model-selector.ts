import { expect, type Locator, type Page } from '@playwright/test'

// Select the configuration's current/default model, preserving recorded request
// inputs while exercising the grouped selector through its visible controls.
export async function selectModelConfiguration(page: Page, selector: Locator, name: RegExp) {
  await expect(selector).toBeVisible({ timeout: 20000 })
  await selector.click()
  const menu = page.locator('.text-model-menu:visible')
  await expect(menu).toBeVisible()
  const group = menu.locator('[data-config-id]').filter({
    has: page.locator('.text-model-menu__heading').filter({ hasText: name }),
  }).first()
  await expect(group).toBeVisible()
  await group.locator('[data-model-choice]').first().click()
  await expect(menu).toBeHidden()
  await expect(selector).toContainText(name)
}
