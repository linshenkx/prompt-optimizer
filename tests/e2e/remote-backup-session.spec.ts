import { test, expect, type Page } from '@playwright/test'
import { startBackupWebDav } from './helpers/backup-webdav'

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })
const tokenPrefix = 'prompt-optimizer:google-drive-token:'
const empty = /暂无远程备份|No remote backups/

async function openData(page: Page, openSettings = true) {
  await page
    .getByRole('button', { name: /数据管理|Data Manager/ })
    .first()
    .click()
  if (openSettings) {
    await page.getByTestId('manage-cloud-connection').click()
    await expect(page.getByTestId('remote-settings-status')).toBeVisible()
  }
}
async function refreshList(page: Page) {
  await page.getByTestId('remote-backup-refresh').click()
}
const readToken = (page: Page) =>
  page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find((key) => key.startsWith(prefix))
    return key ? localStorage.getItem(key) : null
  }, tokenPrefix)

test('mock Google authorization survives reload and another tab; failures never auto-authorize or erase it', async ({
  context,
  page,
}) => {
  test.setTimeout(120_000)
  await context.addInitScript(() => {
    localStorage.setItem(
      'prompt-optimizer:remote-backup-settings',
      JSON.stringify({ provider: { kind: 'google-drive' } }),
    )
    const state = window as any
    state.oauthCalls = 0
    state.cancelOAuth = false
    state.google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }: any) => ({
            requestAccessToken() {
              state.oauthCalls++
              callback(
                state.cancelOAuth
                  ? { error: 'access_denied' }
                  : {
                      access_token: `test-token-${Date.now()}-${state.oauthCalls}`,
                      expires_in: 3600,
                    },
              )
            },
          }),
        },
      },
    }
  })
  let failure = 0
  const methods: string[] = []
  await context.route('https://www.googleapis.com/**', async (route) => {
    methods.push(route.request().method())
    if (failure === -1) {
      await route.abort('failed')
      return
    }
    await route.fulfill({
      status: failure || 200,
      contentType: 'application/json',
      body: JSON.stringify(failure ? { error: { message: 'quota-details-test' } } : { files: [] }),
    })
  })
  await page.goto('/#/basic/system')
  await openData(page, false)
  expect(await readToken(page)).toBeNull()
  await expect(page.getByTestId('remote-list-status')).toBeHidden()
  await expect(page.getByTestId('manage-cloud-connection')).toBeHidden()
  await expect(page.getByTestId('remote-backup-create')).toBeHidden()
  await expect(page.getByTestId('remote-backup-refresh')).toBeHidden()
  await page.getByTestId('connect-cloud-account').click()
  await expect(page.getByTestId('remote-list-status')).toHaveText(empty)
  await expect(page.getByTestId('remote-backup-create')).toBeEnabled()
  await expect(page.getByTestId('remote-backup-refresh')).toBeEnabled()
  await page.getByTestId('manage-cloud-connection').click()
  await expect(page.getByTestId('remote-settings-status')).toHaveText(empty)
  const initial = await readToken(page)
  expect(initial).toContain('test-token-')
  expect(await page.evaluate(() => (window as any).oauthCalls)).toBe(1)

  await page.reload()
  await openData(page)
  await expect(page.getByTestId('remote-settings-status')).toHaveText(empty)
  expect(await page.evaluate(() => (window as any).oauthCalls)).toBe(0)
  const second = await context.newPage()
  await second.goto('/#/basic/system')
  await openData(second)
  await expect(second.getByTestId('remote-settings-status')).toHaveText(empty)
  expect(await readToken(second)).toBe(initial)
  expect(await second.evaluate(() => (window as any).oauthCalls)).toBe(0)
  await second.close()

  for (const status of [403, -1, 401]) {
    failure = status
    await refreshList(page)
    await expect(page.getByTestId('remote-settings-status')).not.toHaveText(empty)
    await expect(page.getByTestId('remote-settings-status')).toContainText(
      /失败|Failed|重新授权|Reauthorize/,
    )
    if (status === 403)
      await expect(page.getByTestId('remote-settings-status')).toContainText('quota-details-test')
    expect(await readToken(page)).toBe(initial)
    expect(await page.evaluate(() => (window as any).oauthCalls)).toBe(0)
    for (const id of ['remote-backup-create', 'remote-backup-refresh']) {
      if (status === 401) await expect(page.getByTestId(id)).toBeHidden()
      else await expect(page.getByTestId(id)).toBeEnabled()
    }
  }
  await page.getByTestId('manage-cloud-connection').click()
  await expect(page.getByTestId('connect-cloud-account')).toBeFocused()
  await page.evaluate(() => {
    ;(window as any).cancelOAuth = true
  })
  await page.getByTestId('connect-cloud-account').click()
  await expect(page.getByTestId('connect-cloud-account')).toBeEnabled()
  expect(await readToken(page)).toBe(initial)

  failure = 0
  await page.evaluate(() => {
    ;(window as any).cancelOAuth = false
  })
  await page.getByTestId('connect-cloud-account').click()
  await expect(page.getByTestId('remote-list-status')).toHaveText(empty)
  await page.getByTestId('manage-cloud-connection').click()
  await expect(page.getByTestId('remote-settings-status')).toHaveText(empty)
  expect(await readToken(page)).not.toBe(initial)
  await page.evaluate((prefix) => {
    const key = Object.keys(localStorage).find((key) => key.startsWith(prefix))!
    const token = JSON.parse(localStorage.getItem(key)!)
    localStorage.setItem(key, JSON.stringify({ ...token, expiresAt: 1 }))
  }, tokenPrefix)
  await refreshList(page)
  await expect(page.getByTestId('remote-settings-status')).not.toHaveText(empty)
  expect(await page.evaluate(() => (window as any).oauthCalls)).toBe(2)
  await expect(page.getByTestId('remote-backup-create')).toBeHidden()
  await expect(page.getByTestId('remote-backup-refresh')).toBeHidden()
  expect(JSON.parse((await readToken(page))!).expiresAt).toBe(1)
  await expect(page.getByTestId('restore-confirmation')).toBeHidden()
  expect(methods.length).toBeGreaterThan(3)
  expect(methods.every((method) => method === 'GET')).toBe(true)
})

test('WebDAV connects and refreshes a missing backup directory without creating anything', async ({
  page,
}) => {
  const dav = await startBackupWebDav()
  try {
    await page.addInitScript(
      (endpoint) =>
        localStorage.setItem(
          'prompt-optimizer:remote-backup-settings',
          JSON.stringify({
            provider: {
              kind: 'webdav',
              endpoint,
              username: 'backup-user',
              password: 'test-secret',
              directory: 'backups',
            },
          }),
        ),
      dav.endpoint,
    )
    await page.goto('/#/basic/system')
    await openData(page)
    await expect(page.getByTestId('remote-settings-status')).toHaveText(empty)
    expect(dav.requests.map((request) => request.method)).toEqual(['PROPFIND', 'PROPFIND'])
    await page.getByRole('button', { name: /保存并连接|Save and Connect/ }).click()
    await expect(page.getByTestId('data-storage-panel')).toBeHidden()
    await expect(page.getByTestId('remote-list-status')).toHaveText(empty)
    await refreshList(page)
    await expect.poll(() => dav.requests.length).toBe(6)
    expect(dav.requests.every((request) => request.method === 'PROPFIND')).toBe(true)
    expect(dav.files.size).toBe(0)
  } finally {
    await dav.close()
  }
})
