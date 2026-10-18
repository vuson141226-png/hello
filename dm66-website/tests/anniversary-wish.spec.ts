import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { WishRecipient } from '../src/lib/recipientLookup'
import { mockRecipients } from './helpers/recipientFixture'

const fullName = 'Người yêu thử'
const studentCode = 'ANNIVERSARY-TEST-ONLY'
const letter = [
  Array.from({ length: 8 }, (_, index) => `Kỷ niệm thử ${index + 1}: Cảm ơn em đã cùng anh giữ những niềm vui nhỏ và những ngày đáng nhớ.`).join(' '),
  Array.from({ length: 8 }, (_, index) => `Điều ước thử ${index + 1}: Mong chúng mình luôn biết lắng nghe, mỉm cười và trân trọng thời gian ở bên nhau.`).join(' '),
  'Đây là đoạn cuối của lá thư kiểm thử. Chúc em ngày 20/10 thật vui và mong chúng mình sẽ còn thật nhiều kỷ niệm đẹp phía trước. Hết lá thư thử.',
]
const photos = Array.from({ length: 11 }, (_, index) => ({
  src: `/test-anniversary/photo-${index + 1}.svg`,
  altText: `Khung hình thử ${index + 1}`,
}))
const specialRecipient: WishRecipient = {
  id: 'anniversary-fixture', fullName, displayName: 'Phương', studentCode,
  image: photos[0].src, introduction: '', personality: '',
  wishes: [{ id: 'anniversary-letter', title: 'Lá thư kỷ niệm thử', senderName: 'Người gửi thử', message: letter.join('\n\n'), image: photos[0].src }],
  anniversary: { kind: 'one-month', images: photos },
}

async function lookup(page: Page, name = fullName, code = studentCode) {
  await page.getByLabel('Tên của cậu là gì?').fill(name)
  await page.getByLabel('Mã sinh viên của cậu', { exact: true }).fill(code)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
}

test.beforeEach(async ({ page }) => {
  await mockRecipients(page)
  await page.route('**/data/special-recipients.json', route => route.fulfill({ json: [specialRecipient] }))
  await page.route('**/test-anniversary/*.svg', route => {
    const index = photos.findIndex(photo => route.request().url().endsWith(photo.src))
    const [width, height] = [[800, 1200], [1200, 800], [1000, 1000]][Math.max(0, index) % 3]
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ecd5dd"/><circle cx="${width / 2}" cy="${height / 2}" r="180" fill="#ac597b"/></svg>` })
  })
})

test('opens the special celebration immediately and exports the entire anniversary letter', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    const paintedText: string[] = []
    Object.assign(window, { anniversaryPaintedText: paintedText })
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (value, x, y, maxWidth) {
      paintedText.push(value)
      if (maxWidth === undefined) return original.call(this, value, x, y)
      return original.call(this, value, x, y, maxWidth)
    }
  })
  await page.goto('/#/your-wish')
  await lookup(page, '  NGUOI YEU THU ', ' anniversary-test-only ')
  await expect(page.getByRole('heading', { level: 1, name: 'Chúc mừng 1 tháng yêu nhau' })).toBeVisible()
  await expect(page.locator('.wish-selection,.wish-choice-list')).toHaveCount(0)
  await expect(page.locator('.greeting-card')).toBeVisible()
  await expect(page.locator('.card-dear')).toHaveText('Dear Phương,')
  await expect(page.locator('.greeting-card h2')).toHaveText('Chúc mừng 1 tháng yêu nhau!')
  await expect(page.locator('.anniversary-letter-note')).toContainText('20/10')
  await expect(page.locator('.card-letter p')).toHaveText(letter)
  await expect(page.locator('.anniversary-photo-wall img')).toHaveCount(11)
  const save = page.getByRole('button', { name: 'Lưu thiệp của mình' })
  await expect(save).toBeEnabled()
  const paintedText = await page.evaluate(() => (window as unknown as { anniversaryPaintedText: string[] }).anniversaryPaintedText.join(' '))
  expect(paintedText).toContain('Dear Phương,')
  expect(paintedText).toContain('Chúc mừng')
  expect(paintedText).toContain('1 tháng yêu nhau!')
  for (const paragraph of letter) expect(paintedText).toContain(paragraph)
  const downloadPromise = page.waitForEvent('download')
  await save.click()
  const download = await downloadPromise
  expect(await download.failure()).toBeNull()
  expect(download.suggestedFilename()).toMatch(/anniversary-fixture\.png$/)
  const filePath = await download.path()
  expect(filePath).not.toBeNull()
  const png = await readFile(filePath!)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
})

test('enlarges gallery photos, navigates them, and restores focus after closing', async ({ page }) => {
  await page.goto('/#/your-wish')
  await lookup(page)
  const opener = page.getByRole('button', { name: 'Xem ảnh kỷ niệm 3: Khung hình thử 3', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAccessibleName('Kỷ niệm 03 / 11')
  const enlargedPhoto = dialog.getByRole('img', { name: /^Khung hình thử / })
  await expect(enlargedPhoto).toHaveAttribute('src', photos[2].src)
  await expect(dialog.getByRole('button', { name: 'Đóng ảnh kỷ niệm' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Ảnh tiếp' }).click()
  await expect(enlargedPhoto).toHaveAttribute('src', photos[3].src)
  await page.keyboard.press('ArrowLeft')
  await expect(enlargedPhoto).toHaveAttribute('src', photos[2].src)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
  await page.getByRole('button', { name: 'Đóng ảnh kỷ niệm' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('requires the correct name and code and clears the special view on reset or navigation', async ({ page }) => {
  await page.goto('/#/your-wish')
  for (const [name, code] of [[fullName, 'WRONG'], ['Người khác', studentCode]]) {
    await lookup(page, name, code)
    await expect(page.getByRole('alert')).toContainText('Tên hoặc mã sinh viên chưa đúng')
    await expect(page.locator('.anniversary-hero,.greeting-card')).toHaveCount(0)
  }
  await lookup(page)
  await expect(page.locator('.anniversary-hero')).toBeVisible()
  await page.getByRole('button', { name: 'Nhập lại tên và mã sinh viên' }).click()
  await expect(page.getByLabel('Tên của cậu là gì?')).toHaveValue('')
  await expect(page.getByLabel('Mã sinh viên của cậu', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeFocused()
  await expect(page.locator('.anniversary-hero,.anniversary-gallery,.greeting-card')).toHaveCount(0)
  await lookup(page)
  await page.locator('nav a[href="#/our-memories"]').click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  await expect(page.locator('.anniversary-hero,.anniversary-gallery')).toHaveCount(0)
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.getByLabel('Tên của cậu là gì?')).toHaveValue('')
  await expect(page.getByLabel('Mã sinh viên của cậu', { exact: true })).toHaveValue('')
})

for (const width of [320, 390, 1440]) {
  test(`keeps all photos readable without cropping or horizontal overflow at ${width}px with reduced motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/your-wish')
    await lookup(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Chúc mừng 1 tháng yêu nhau' })).toBeVisible()
    await expect(page.locator('.anniversary-celebration')).toBeHidden()
    expect(await page.locator('.anniversary-confetti').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none'))).toBe(true)
    const images = page.locator('.anniversary-photo-wall img')
    await expect(images).toHaveCount(11)
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await expect(image).toHaveCSS('object-fit', 'contain')
      const bounds = await image.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`anniversary-${width}.png`), fullPage: true })
  })
}
