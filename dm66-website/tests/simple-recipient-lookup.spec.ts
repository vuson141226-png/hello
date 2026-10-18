import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { fixtureRecipient, mockRecipients, profiles, testStudentCode } from './helpers/recipientFixture'

const name = 'Tên của cậu là gì?'
const code = 'Mã sinh viên của cậu'
async function lookup(page: Page, fullName = profiles[0].fullName, studentCode = testStudentCode) {
  await page.getByLabel(name).fill(fullName)
  await page.getByLabel(code, { exact: true }).fill(studentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
}
async function openFirstWish(page: Page) {
  await lookup(page)
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('.greeting-card')).toBeVisible()
}
test.beforeEach(async ({ page }) => { await mockRecipients(page) })

test('looks up both fields locally and shows a count and list before any card', async ({ page }, testInfo) => {
  const apiRequests: string[] = []
  const dataRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/recipient/')) apiRequests.push(request.url())
    if (request.url().includes('/data/recipient-wishes.json')) dataRequests.push(request.method())
  })
  await page.goto('/#/your-wish')
  await expect(page.getByLabel(code, { exact: true })).toHaveAttribute('type', 'text')
  await lookup(page, '  NGUOI  NHAN THU 1 ', ' test-only-01 ')
  await expect(page.locator('.wish-notice')).toContainText('Cậu có 2 lời chúc')
  await expect(page.locator('.wish-choice-list button')).toHaveCount(2)
  await expect(page.locator('.greeting-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu thiệp của mình' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('recipient-notice-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: testInfo.outputPath('recipient-notice-phone.png'), fullPage: true })
  await page.getByRole('button', { name: /^Đọc lời chúc 2/ }).click()
  await expect(page.locator('.card-letter')).toHaveText('Một lời chúc khác cho bạn mẫu 1.')
  expect(apiRequests).toEqual([])
  expect(dataRequests).toEqual(['GET'])
  expect(await page.evaluate(() => ({ local: Object.entries(localStorage), session: Object.entries(sessionStorage), cookies: document.cookie }))).toEqual({ local: [], session: [], cookies: '' })
  await expect(page).not.toHaveURL(new RegExp(testStudentCode))
})

test('opens each selected letter and sender, saves that letter, and returns to the list', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const text: string[] = []
    Object.assign(window, { cardPaintedText: text })
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      text.push(value)
      if (maxWidth === undefined) return original.call(this, value, x, y)
      return original.call(this, value, x, y, maxWidth)
    }
  })
  await page.goto('/#/your-wish')
  await openFirstWish(page)
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
  await page.getByRole('button', { name: 'Xem danh sách lời chúc' }).click()
  await expect(page.locator('.greeting-card')).toHaveCount(0)
  await expect(page.locator('.wish-choice-list button')).toHaveCount(2)
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('.card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
})

test('requires full name and code together and preserves text codes', async ({ page }) => {
  await page.goto('/#/your-wish')
  await lookup(page, profiles[0].fullName, 'WRONG-CODE')
  await expect(page.getByRole('alert')).toContainText('Tên hoặc mã sinh viên chưa đúng')
  await expect(page.locator('.wish-notice,.greeting-card')).toHaveCount(0)
  await lookup(page, profiles[0].displayName, testStudentCode)
  await expect(page.getByRole('alert')).toContainText('Tên hoặc mã sinh viên chưa đúng')
  await lookup(page, 'Người nhận thử', testStudentCode)
  await expect(page.getByRole('alert')).toContainText('Tên hoặc mã sinh viên chưa đúng')
  await lookup(page)
  await expect(page.locator('.wish-notice')).toContainText('2 lời chúc')
})

test('resets locally and starts with empty fields after reload', async ({ page }) => {
  await page.goto('/#/your-wish')
  await openFirstWish(page)
  await page.getByRole('button', { name: 'Nhập lại tên và mã sinh viên' }).click()
  await expect(page.getByLabel(name)).toHaveValue('')
  await expect(page.getByLabel(code, { exact: true })).toHaveValue('')
  await expect(page.getByLabel(name)).toBeFocused()
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
  await openFirstWish(page)
  await page.reload()
  await expect(page.getByLabel(name)).toHaveValue('')
  await expect(page.getByLabel(code, { exact: true })).toHaveValue('')
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
})

test('retries a failed static data download without a server login', async ({ page }) => {
  await page.goto('/#/your-wish')
  await page.route('**/data/recipient-wishes.json', route => route.abort('failed'))
  await lookup(page)
  await expect(page.getByRole('alert')).toContainText('Chưa tải được danh sách lời chúc')
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.getByLabel(code, { exact: true })).toHaveValue(testStudentCode)
  await page.unroute('**/data/recipient-wishes.json')
  await mockRecipients(page)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.wish-notice')).toContainText('2 lời chúc')
})

test('ignores a late data response after leaving the wish page', async ({ page }) => {
  await page.goto('/#/your-wish')
  let release: (() => void) | undefined
  await page.route('**/data/recipient-wishes.json', async route => {
    await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: [fixtureRecipient()] })
  })
  await lookup(page)
  await expect.poll(() => typeof release).toBe('function')
  await page.locator('nav a[href="#/our-memories"]').click()
  release?.()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.getByLabel(name)).toBeEnabled()
  await expect(page.locator('.greeting-card,.wish-selection')).toHaveCount(0)
})

test('shows a zero-wish notice without a blank greeting card', async ({ page }) => {
  await page.route('**/data/recipient-wishes.json', route => route.fulfill({ json: [{ ...fixtureRecipient(), wishes: [] }] }))
  await page.goto('/#/your-wish')
  await lookup(page)
  await expect(page.locator('.wish-notice')).toContainText('0 lời chúc')
  await expect(page.locator('.wish-empty')).toContainText('đang được chuẩn bị')
  await expect(page.locator('.greeting-card,.wish-choice-list button')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu thiệp của mình' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Nhập lại tên và mã sinh viên' }).click()
  await expect(page.getByLabel(name)).toBeVisible()
})
