import { expect, test } from '@playwright/test'
import { fixtureSession, mockRecipients, profiles, testStudentCode } from './helpers/recipientFixture'

const name = 'Tên của cậu là gì?'
const code = 'Mã sinh viên của cậu'
async function login(page: import('@playwright/test').Page) {
  await page.getByLabel(name).fill(profiles[0].fullName)
  await page.getByLabel(code, { exact: true }).fill(testStudentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.greeting-card')).toBeVisible()
}
test.beforeEach(async ({ page }) => { await mockRecipients(page) })

test('keeps private content unavailable before login and sends credentials only in a POST body', async ({ page }, testInfo) => {
  await page.goto('/#/your-wish')
  await expect(page.locator('.greeting-card,.match-list,.demo-hint')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(profiles[0].fullName)
  await page.screenshot({ path: testInfo.outputPath('recipient-login-desktop.png'), fullPage: true })
  const requests: { method: string; url: string; body: unknown }[] = []
  page.on('request', request => {
    if (request.url().includes('/api/recipient/')) requests.push({ method: request.method(), url: request.url(), body: request.postDataJSON() })
  })
  await login(page)
  expect(requests).toContainEqual({ method: 'POST', url: expect.stringContaining('/api/recipient/login'), body: { fullName: profiles[0].fullName, studentCode: testStudentCode } })
  expect(requests.every(request => !request.url.includes(testStudentCode))).toBe(true)
  expect(await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }))).toEqual({ local: [], session: [] })
  await expect(page).not.toHaveURL(new RegExp(testStudentCode))
})

test('shows the number of wishes and switches only the selected letter and sender', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const text: string[] = [];
    Object.assign(window, { cardPaintedText: text });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      text.push(value);
      if (maxWidth === undefined) return original.call(this, value, x, y);
      return original.call(this, value, x, y, maxWidth);
    };
  })
  await page.goto('/#/your-wish')
  await login(page)
  await expect(page.locator('.wish-selection')).toContainText('2 lời chúc')
  const select = page.getByLabel('Chọn lời chúc muốn đọc')
  await expect(select.locator('option')).toHaveCount(2)
  await expect(page.locator('.card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
  await expect(page.getByRole('button', { name: 'Lưu thiệp của mình' })).toBeEnabled()
  await page.evaluate(() => { (window as unknown as { cardPaintedText: string[] }).cardPaintedText.length = 0 })
  await select.selectOption('wish-0-2')
  await expect(page.locator('.card-letter')).toHaveText('Một lời chúc khác cho bạn mẫu 1.')
  await expect(page.locator('.card-signature')).toContainText('Bạn gửi mẫu')
  await expect(page.getByRole('button', { name: 'Lưu thiệp của mình' })).toBeEnabled()
  const exportedText = await page.evaluate(() => (window as unknown as { cardPaintedText: string[] }).cardPaintedText.join(' '))
  expect(exportedText).toContain('Một lời chúc khác cho bạn mẫu 1.')
  expect(exportedText).toContain('From Bạn gửi mẫu')
  expect(exportedText).not.toContain('Lời chúc kiểm thử số 1.')
  await page.screenshot({ path: testInfo.outputPath('recipient-wishes-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('recipient-wishes-phone.png'), fullPage: true })
  await select.selectOption('wish-0-1')
  await expect(page.locator('.card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
})

test('restores only an authenticated server session after reload and clears content on unauthorized restore', async ({ page }) => {
  await page.goto('/#/your-wish')
  await login(page)
  await page.reload()
  await expect(page.locator('.greeting-card')).toBeVisible()
  await page.route('**/api/recipient/session', route => route.fulfill({ status: 401, json: { error: 'unauthorized' } }))
  await page.reload()
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Lời chúc kiểm thử số 1.')
})

test('clears the code after failure and gives a generic error when the server cannot be reached', async ({ page }) => {
  await page.goto('/#/your-wish')
  await page.route('**/api/recipient/login', route => route.abort('failed'))
  await page.getByLabel(name).fill(profiles[0].fullName)
  await page.getByLabel(code, { exact: true }).fill(testStudentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.getByRole('alert')).toContainText('Chưa thể kết nối')
  await expect(page.getByLabel(code, { exact: true })).toHaveValue('')
  await expect(page.locator('.greeting-card')).toHaveCount(0)
})

test('revokes the server session before permitting another recipient and retries failed logout', async ({ page }) => {
  await page.goto('/#/your-wish')
  await login(page)
  await page.route('**/api/recipient/logout', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }))
  await page.getByRole('button', { name: 'Đăng xuất và đổi người nhận' }).click()
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('Chưa thể đăng xuất an toàn')
  await expect(page.getByLabel(name)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Nhận lời chúc của mình' })).toBeDisabled()
  await page.unroute('**/api/recipient/logout')
  await page.getByRole('button', { name: 'Thử đăng xuất lại' }).click()
  await expect(page.getByLabel(name)).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.locator('.greeting-card')).toHaveCount(0)
})

test('ignores a late private response after leaving the wish page', async ({ page }) => {
  await page.goto('/#/your-wish')
  let release: (() => void) | undefined
  let requested = false
  await page.route('**/api/recipient/login', async route => {
    requested = true
    await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: { authenticated: true } })
  })
  await page.getByLabel(name).fill(profiles[0].fullName)
  await page.getByLabel(code, { exact: true }).fill(testStudentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect.poll(() => requested).toBe(true)
  await page.locator('nav a[href="#/our-memories"]').click()
  release?.()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.locator('.greeting-card')).toHaveCount(0)
})

test('can open an authenticated recipient who has no wishes yet', async ({ page }) => {
  await page.route('**/api/recipient/session', route => route.fulfill({ json: { ...fixtureSession(), wishes: [] } }))
  await page.goto('/#/your-wish')
  await expect(page.locator('.wish-selection')).toContainText('0 lời chúc')
  await expect(page.locator('.wish-empty')).toContainText('đang được chuẩn bị')
  await expect(page.locator('.greeting-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu thiệp của mình' })).toHaveCount(0)
})


test('clears private content when a focus check discovers an expired session', async ({ page }) => {
  await page.goto('/#/your-wish')
  await login(page)
  await page.route('**/api/recipient/session', route => route.fulfill({ status: 401, json: { error: 'expired' } }))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('Phiên đăng nhập đã hết hạn')
  await expect(page.locator('.greeting-card,.wish-selection,.save-image-full')).toHaveCount(0)
})


test('waits for pending session revocation when navigating away and back', async ({ page }) => {
  await page.goto('/#/your-wish')
  await login(page)
  let release: (() => void) | undefined
  await page.route('**/api/recipient/logout', async route => {
    await new Promise<void>(resolve => { release = resolve })
    await route.fallback()
  })
  await page.getByRole('button', { name: 'Đăng xuất và đổi người nhận' }).click()
  await expect.poll(() => typeof release).toBe('function')
  await page.locator('nav a[href="#/our-memories"]').click()
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.getByLabel(name)).toBeDisabled()
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
  release?.()
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
})
