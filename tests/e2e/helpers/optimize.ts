import { expect, type Page } from '@playwright/test'

export type OptimizeWorkspaceMode =
  | 'basic-system'
  | 'basic-user'
  | 'pro-variable'
  | 'pro-multi'

export function getWorkspace(page: Page, mode: OptimizeWorkspaceMode) {
  return page.locator(`[data-testid="workspace"][data-mode="${mode}"]`)
}

export async function fillOriginalPrompt(page: Page, mode: OptimizeWorkspaceMode, value: string) {
  const workspace = getWorkspace(page, mode)

  const input = workspace.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 15000 })

  const cmContent = input.locator('.cm-content')
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
  } else {
    const textarea = input.locator('textarea')
    await textarea.fill(value)
  }

  const optimizeButton = workspace.locator(`[data-testid="${mode}-optimize-button"]`)
  await expect(optimizeButton).toBeEnabled({ timeout: 15000 })
}

export async function clickOptimizeButton(page: Page, mode: OptimizeWorkspaceMode) {
  const workspace = getWorkspace(page, mode)

  const button = workspace.locator(`[data-testid="${mode}-optimize-button"]`)
  await expect(button).toBeVisible({ timeout: 15000 })
  await expect(button).toBeEnabled({ timeout: 15000 })

  await button.click()
}

async function ensureOutputSourceView(output: import('@playwright/test').Locator) {
  // OutputDisplay 头部有 Render / Source / Compare 三个 tab（Naive UI 的 n-button）。
  // 并发/渲染抖动时直接读 output.innerText 会把 tab 文案也读进来，导致误判。
  // 这里用 i18n 文案会受语言影响，改用“中间那个按钮”（Render/Source/Compare）更稳定。
  const leftGroupButtons = output.locator('.n-button-group').first().locator('.n-button')
  if ((await leftGroupButtons.count()) >= 2) {
    const source = leftGroupButtons.nth(1)
    // 如果已经处于 Source（disabled），直接返回
    if (!(await source.isDisabled().catch(() => false))) {
      await source.click({ timeout: 20000 })
    }
  }
}

async function readOutputSourceText(output: import('@playwright/test').Locator) {
  if ((await output.count()) === 0) return { kind: 'missing', text: '' }

  // Source 视图下优先读取编辑器/textarea 的“值”，避免拿到整张卡片的 innerText
  const cmContent = output.locator('.cm-content')
  if ((await cmContent.count()) > 0) {
    return { kind: 'cm', text: (await cmContent.first().innerText()).trim() }
  }

  const textarea = output.locator('textarea')
  if ((await textarea.count()) > 0) {
    return { kind: 'textarea', text: (await textarea.first().inputValue()).trim() }
  }

  return { kind: 'text', text: (await output.innerText()).trim() }
}

export async function expectOutputByTestIdNotEmpty(page: Page, testId: string, opts?: { timeoutMs?: number }) {
  const output = page.locator(`[data-testid="${testId}"]`)
  const timeoutMs = opts?.timeoutMs ?? 120000

  await ensureOutputSourceView(output)

  await expect
    .poll(async () => {
      const { text } = await readOutputSourceText(output).catch(() => ({ text: '' }))
      return text
    }, { timeout: timeoutMs })
    .toMatch(/\S/)
}

export async function expectOptimizedResultNotEmpty(page: Page, mode: OptimizeWorkspaceMode) {
  const workspace = getWorkspace(page, mode)

  const output = workspace.locator(`[data-testid="${mode}-output"]`)

  try {
    await ensureOutputSourceView(output)

    await expect
      .poll(async () => {
        const { text } = await readOutputSourceText(output).catch(() => ({ text: '' }))
        return text
      }, { timeout: 120000 })
      .toMatch(/\S/)
  } catch (e) {
    const buttonInfo = await (async () => {
      const optimizeButton = workspace.locator(`[data-testid="${mode}-optimize-button"]`)
      try {
        const visible = await optimizeButton.isVisible()
        const enabled = await optimizeButton.isEnabled()
        const text = (await optimizeButton.innerText().catch(() => '')).trim()
        return { visible, enabled, text }
      } catch {
        return { visible: false, enabled: false, text: '' }
      }
    })()

    const outputInfo = await (async () => {
      try {
        const out = await readOutputSourceText(output)
        const readonly =
          out.kind === 'textarea' ? await output.locator('textarea').first().isDisabled().catch(() => false) : false
        return { ...out, readonly }
      } catch {
        return { kind: 'unknown', text: '', readonly: false }
      }
    })()

    const alertText = await page.locator('.n-alert').allInnerTexts().catch(() => [])
    const messageText = await page.locator('.n-message').allInnerTexts().catch(() => [])

    const debugPayload = {
      mode,
      button: buttonInfo,
      output: outputInfo,
      alerts: alertText.filter(Boolean).slice(0, 5),
      messages: messageText.filter(Boolean).slice(0, 5),
    }

    // eslint-disable-next-line no-console
    console.error('[E2E][optimize] output wait timeout diagnostic:', JSON.stringify(debugPayload, null, 2))
    throw e
  }
}

export async function verifyOptimizeButtonDisabledWhenEmpty(page: Page, mode: OptimizeWorkspaceMode) {
  const workspace = getWorkspace(page, mode)
  const button = workspace.locator(`[data-testid="${mode}-optimize-button"]`)

  await expect(button).toBeVisible({ timeout: 15000 })
  await expect(button).toBeDisabled()
}

export async function addProMultiUserMessage(page: Page, content: string) {
  const addButton = page.getByTestId('pro-multi-add-message').first()
  await expect(addButton).toBeVisible({ timeout: 20000 })
  await addButton.click()

  // 新增消息后，列表最后一项应该出现
  // 我们给 message card 加了 data-testid=pro-multi-message-card-{index}
  // 这里用“最后一个 message card”的内容输入框填写。
  const messageCards = page.locator('[data-testid^="pro-multi-message-card-"]')
  await expect(messageCards.first()).toBeVisible({ timeout: 20000 })

  const lastCard = messageCards.last()
  // VariableAwareInput 内部是 textarea 或 CodeMirror
  const cm = lastCard.locator('.cm-content')
  if ((await cm.count()) > 0) {
    await cm.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(content)
  } else {
    const textarea = lastCard.locator('textarea')
    await textarea.fill(content)
  }
}

export async function selectProMultiMessageForOptimization(page: Page, index: number) {
  // Pro Multi 现在自动选中最新消息；保留此 helper 以兼容旧测试。
  // 若选择按钮存在则点击，不存在则视为已自动选中。
  const selectButton = page.getByTestId(`pro-multi-select-message-${index}`)
  if ((await selectButton.count()) > 0) {
    await expect(selectButton).toBeVisible({ timeout: 20000 })
    await selectButton.click()
  }
}

export async function clickProMultiOptimizeButton(page: Page) {
  const button = page.getByTestId('pro-multi-optimize-button')
  await expect(button).toBeVisible({ timeout: 20000 })
  await expect(button).toBeEnabled({ timeout: 20000 })
  await button.click()
}
