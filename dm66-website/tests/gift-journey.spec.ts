import { readFile } from 'node:fs/promises'
import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await use()
    expect(errors, 'The gift journey should not throw browser runtime errors').toEqual([])
  }, { auto: true }],
})

async function openWish(page: Page, query = 'demo 02') {
  await page.goto('/#/your-wish')
  await page.getByLabel('Tên của cậu là gì?').fill(query)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.greeting-card')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))).toEqual({ content: 390, viewport: 390 })
}

test('opens the gift and lets visitors explore the gallery and next chapter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gửi cậu')
  const gift = page.getByRole('button', { name: 'Mở món quà của chúng tớ' })
  await gift.click()
  await expect(page.getByRole('button', { name: 'Đang mở điều bất ngờ...' })).toBeDisabled()
  await expect(page).toHaveURL(/#\/our-girls$/)
  await expect(page.locator('.gallery-count')).toHaveText('01 / 03')
  await expect(page.locator('.girl-introduction h2')).toHaveText('[Họ và tên bạn nữ 01]')
  await page.getByRole('button', { name: 'Bạn tiếp theo', exact: true }).click()
  await expect(page.locator('.gallery-count')).toHaveText('02 / 03')
  await expect(page.locator('.girl-introduction h2')).toHaveText('[Họ và tên bạn nữ 02]')
  await page.getByRole('button', { name: 'Xem [Tên bạn nữ 03]', exact: true }).click()
  await expect(page.locator('.gallery-count')).toHaveText('03 / 03')
  await expect(page.getByRole('button', { name: 'Xem [Tên bạn nữ 03]', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Bạn tiếp theo', exact: true }).click()
  await expect(page.locator('.gallery-count')).toHaveText('01 / 03')
  await page.getByRole('button', { name: 'Có một lời nhắn dành riêng cho cậu' }).click()
  await expect(page).toHaveURL(/#\/your-wish$/)
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeVisible()
})

test('validates names accessibly and finds one exact normalized recipient', async ({ page }) => {
  await page.goto('/#/your-wish')
  const input = page.getByLabel('Tên của cậu là gì?')
  const submit = page.getByRole('button', { name: 'Nhận lời chúc của mình' })
  await submit.click()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAttribute('aria-describedby', 'name-error')
  await expect(input).toBeFocused()
  await expect(page.getByRole('alert')).toContainText('biết tên trước')
  await input.fill('Người chưa có trong danh sách')
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
  await expect(page.locator('.greeting-card')).toHaveCount(0)
  await input.fill('demo')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
  await input.fill('  DEMO   02 ')
  await submit.click()
  await expect(page.locator('.greeting-card')).toBeVisible()
  await expect(page.locator('.card-dear')).toHaveText('Dear [Tên bạn nữ 02],')
  await expect(page.locator('.card-letter')).toContainText('bạn nữ 02')
  await expect(page.locator('.greeting-card')).not.toContainText('bạn nữ 01')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})

test('replays the letter, sends a heart, dismisses the toast and starts another search', async ({ page }) => {
  await openWish(page)
  const originalLetter = await page.locator('.card-letter').textContent()
  await page.getByRole('button', { name: 'Đọc lại lời chúc' }).click()
  await expect(page.locator('.card-letter')).toHaveText(originalLetter || '')
  await expect(page.locator('.card-letter p')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Gửi một trái tim' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn cậu!')
  await page.getByRole('button', { name: 'Đóng thông báo' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tìm một lời chúc khác' }).click()
  const input = page.getByLabel('Tên của cậu là gì?')
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.locator('.greeting-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'demo 03', exact: true }).click()
  await expect(input).toHaveValue('demo 03')
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.card-dear')).toHaveText('Dear [Tên bạn nữ 03],')
})

test('downloads a real, high resolution PNG for the selected recipient', async ({ page }) => {
  await openWish(page)
  await expect(page.locator('.card-letter p')).toHaveCSS('opacity', '1')
  const cardSize = await page.locator('.greeting-card').evaluate(element => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }))
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Lưu thiệp của mình' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('DM66-20-10-placeholder-02.png')
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  expect(png.toString('ascii', 12, 16)).toBe('IHDR')
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(cardSize.width * 3)
  expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(cardSize.height * 3)
  expect(png.length).toBeGreaterThan(10_000)
  await expect(page.getByRole('status')).toContainText('Thiệp đã được tạo')
})

test('exports every letter paragraph fully visible when saved immediately during replay', async ({ page }) => {
  await openWish(page)
  await expect(page.locator('.card-letter p')).toHaveCSS('opacity', '1')
  await page.evaluate(() => {
    const exportOpacities: string[][] = []
    Object.assign(window, { exportOpacities })
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          const card = node.matches('[data-card-export="true"]') ? node : node.querySelector('[data-card-export="true"]')
          if (card) exportOpacities.push(Array.from(card.querySelectorAll('.card-letter p'), paragraph => getComputedStyle(paragraph).opacity))
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(async () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.card-actions button'))
      const previousLetter = document.querySelector('.result-layout > .greeting-card .card-letter')!
      const replayCommitted = new Promise<void>(resolve => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('.result-layout > .greeting-card .card-letter') !== previousLetter) {
            observer.disconnect()
            resolve()
          }
        })
        observer.observe(previousLetter.parentElement!, { childList: true })
      })
      buttons.find(button => button.textContent?.includes('Đọc lại lời chúc'))!.click()
      await replayCommitted
      buttons.find(button => button.textContent?.includes('Lưu thiệp của mình'))!.click()
    }),
  ])
  expect(await download.failure()).toBeNull()
  expect(download.suggestedFilename()).toBe('DM66-20-10-placeholder-02.png')
  const path = await download.path()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  const exportedParagraphs = await page.evaluate(() => (window as Window & { exportOpacities: string[][] }).exportOpacities)
  expect(exportedParagraphs.length).toBeGreaterThan(0)
  for (const opacities of exportedParagraphs) {
    expect(opacities.length).toBeGreaterThan(0)
    expect(opacities.every(opacity => opacity === '1')).toBe(true)
  }
  await expect(page.getByRole('status')).toContainText('Thiệp đã được tạo')
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
})

test('supports direct hash routes, navigation history and the optional music explanation', async ({ page }) => {
  for (const [route, title] of [
    ['/#/', 'Gửi cậu'],
    ['/#/our-girls', 'Những cô gái của DM66'],
    ['/#/your-wish', 'Lời chúc dành riêng cho cậu'],
  ]) {
    await page.goto(route)
    await expect(page).toHaveTitle(new RegExp(title))
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', route.slice(1))
  }
  await page.locator('nav a[href="#/our-girls"]').click()
  await expect(page.locator('.gallery-count')).toHaveText('01 / 03')
  await page.goBack()
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeVisible()
  await page.goForward()
  await expect(page.locator('.gallery-count')).toHaveText('01 / 03')
  const music = page.getByRole('button', { name: 'Bật nhạc', exact: true })
  await expect(music).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('audio')).toHaveCount(0)
  await music.click()
  await expect(page.locator('.music-popover')).toContainText('đang được chuẩn bị')
  await page.getByRole('button', { name: 'Đóng thông tin nhạc' }).click()
  await expect(page.locator('.music-popover')).toHaveCount(0)
})

test('fits mobile routes, supports swiping and keeps errors and the result usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ['/#/', '/#/our-girls', '/#/your-wish']) {
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  await page.goto('/#/our-girls')
  const gallery = page.getByRole('region', { name: 'Những cô gái Digital Marketing 66' })
  await gallery.dispatchEvent('pointerdown', { clientX: 290, clientY: 450, pointerType: 'touch', pointerId: 1 })
  await gallery.dispatchEvent('pointerup', { clientX: 90, clientY: 450, pointerType: 'touch', pointerId: 1 })
  await expect(page.locator('.gallery-count')).toHaveText('02 / 03')
  await expect(page.locator('.girl-introduction h2')).toHaveText('[Họ và tên bạn nữ 02]')
  await expectNoHorizontalOverflow(page)
  const sidePhoto = page.getByRole('button', { name: 'Xem bạn tiếp theo', exact: true })
  await sidePhoto.scrollIntoViewIfNeeded()
  const photoBox = (await sidePhoto.boundingBox())!
  const startX = Math.min(380, photoBox.x + photoBox.width - 15)
  const dragY = photoBox.y + photoBox.height * 0.3
  await page.mouse.move(startX, dragY)
  await page.mouse.down()
  await page.mouse.move(startX - 60, dragY, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator('.gallery-count')).toHaveText('03 / 03')
  await page.locator('nav a[href="#/your-wish"]').click()
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByLabel('Tên của cậu là gì?').fill('  demo 02  ')
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.greeting-card')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page.getByRole('button', { name: 'Lưu thiệp của mình' })).toBeVisible()
})

test('honors reduced motion while retaining the complete gift interaction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.ambient-heart').first()).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Mở món quà của chúng tớ' }).click()
  await expect(page).toHaveURL(/#\/our-girls$/)
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
  await page.getByRole('button', { name: 'Có một lời nhắn dành riêng cho cậu' }).click()
  await page.getByLabel('Tên của cậu là gì?').fill('demo 01')
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.card-dear')).toHaveText('Dear [Tên bạn nữ 01],')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
  await page.getByRole('button', { name: 'Gửi một trái tim' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn cậu!')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
})
