import { test, expect, type Page } from '@playwright/test'
import { startBackupWebDav } from './helpers/backup-webdav'

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })
const tokenPrefix = 'prompt-optimizer:google-drive-token:'
const empty = /暂无远程备份|No remote backups/

async function openData(page: Page) {
  await page.getByRole('button', { name: /数据管理|Data Manager/ }).first().click()
  await page.getByTestId('data-tab-settings').click()
  await expect(page.getByTestId('remote-settings-status')).toBeVisible()
}
async function refreshList(page: Page) {
  await page.getByTestId('data-tab-restore').click()
  await page.getByTestId('restore-source-cloud').click()
  await page.getByTestId('remote-backup-refresh').click()
  await page.getByTestId('data-tab-settings').click()
}
const readToken = (page: Page) => page.evaluate(prefix => {
  const key = Object.keys(localStorage).find(key => key.startsWith(prefix))
  return key ? localStorage.getItem(key) : null
}, tokenPrefix)

test('mock Google authorization survives reload and another tab; failures never auto-authorize or erase it', async ({ context, page }) => {
  test.setTimeout(120_000)
  await context.addInitScript(() => {
    localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({ provider: { kind: 'google-drive' } }))
    const state = window as any
    state.oauthCalls = 0
    state.cancelOAuth = false
    state.google = { accounts: { oauth2: { initTokenClient: ({ callback }: any) => ({ requestAccessToken() {
      state.oauthCalls++
      callback(state.cancelOAuth ? { error: 'access_denied' } : {
        access_token: `test-token-${Date.now()}-${state.oauthCalls}`, expires_in: 3600,
      })
    } }) } } }
  })
  let failure = 0
  const methods: string[] = []
  await context.route('https://www.googleapis.com/**', async route => {
    methods.push(route.request().method())
    if (failure === -1) { await route.abort('failed'); return }
    await route.fulfill({ status: failure || 200, contentType: 'application/json',
      body: JSON.stringify(failure ? { error: { message: 'quota-details-test' } } : { files: [] }) })
  })
  await page.goto('/#/basic/system')
  await openData(page)
  expect(await readToken(page)).toBeNull()
  await expect(page.getByTestId('remote-settings-status')).not.toHaveText(empty)
  await page.getByTestId('remote-google-authorize').click()
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
    await expect(page.getByTestId('remote-settings-status')).toContainText(/失败|Failed|重新授权|Reauthorize/)
    if (status === 403) await expect(page.getByTestId('remote-settings-status')).toContainText('quota-details-test')
    expect(await readToken(page)).toBe(initial)
    expect(await page.evaluate(() => (window as any).oauthCalls)).toBe(0)
  }
  await page.evaluate(() => { (window as any).cancelOAuth = true })
  await page.getByTestId('remote-google-authorize').click()
  await expect(page.getByTestId('remote-google-authorize')).toBeEnabled()
  expect(await readToken(page)).toBe(initial)

  failure = 0
  await page.evaluate(() => { (window as any).cancelOAuth = false })
  await page.getByTestId('remote-google-authorize').click()
  await expect(page.getByTestId('remote-settings-status')).toHaveText(empty)
  expect(await readToken(page)).not.toBe(initial)
  await page.evaluate(prefix => {
    const key = Object.keys(localStorage).find(key => key.startsWith(prefix))!
    const token = JSON.parse(localStorage.getItem(key)!)
    localStorage.setItem(key, JSON.stringify({ ...token, expiresAt: 1 }))
  }, tokenPrefix)
  await refreshList(page)
  await expect(page.getByTestId('remote-settings-status')).not.toHaveText(empty)
  expect(await page.evaluate(() => (window as any).oauthCalls)).toBe(2)
  expect(JSON.parse((await readToken(page))!).expiresAt).toBe(1)
  await expect(page.getByTestId('restore-confirmation')).toBeHidden()
  expect(methods.length).toBeGreaterThan(3)
  expect(methods.every(method => method === 'GET')).toBe(true)
})

test('WebDAV connects and refreshes a missing backup directory without creating anything', async ({ page }) => {
  const dav = await startBackupWebDav()
  try {
    await page.addInitScript(endpoint => localStorage.setItem('prompt-optimizer:remote-backup-settings', JSON.stringify({
      provider: { kind: 'webdav', endpoint, username: 'backup-user', password: 'test-secret', directory: 'backups' },
    })), dav.endpoint)
    await page.goto('/#/basic/system')
    await openData(page)
    await expect(page.getByTestId('remote-settings-status')).toHaveText(empty)
    expect(dav.requests.map(request => request.method)).toEqual(['PROPFIND', 'PROPFIND'])
    await page.getByRole('button', { name: /保存并连接|Save and Connect/ }).click()
    await expect(page.getByRole('button', { name: /保存并连接|Save and Connect/ })).toBeEnabled()
    await refreshList(page)
    await expect.poll(() => dav.requests.length).toBe(6)
    expect(dav.requests.every(request => request.method === 'PROPFIND')).toBe(true)
    expect(dav.files.size).toBe(0)
  } finally { await dav.close() }
})
