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

async function openWish(page: Page, query = 'ABE') {
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

async function expectUpdatedClassName(page: Page) {
  await expect(page.getByRole('link', { name: 'DM66D With Love — Trang chủ', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(/· DM66D$/)
  const visibleText = await page.locator('body').innerText()
  expect(visibleText).toMatch(/DM66D/)
  expect(visibleText).not.toMatch(/\bDM66\b|Digital\s*Marketing\s*66(?!D)/i)
  const accessibleLabels = await page.locator('[aria-label]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')).join('\n'))
  expect(accessibleLabels).not.toMatch(/\bDM66\b|Digital\s*Marketing\s*66(?!D)/i)
}

test('opens the gift and lets visitors explore the gallery and next chapter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gửi cậu')
  const gift = page.getByRole('button', { name: 'Mở món quà của chúng tớ' })
  await gift.click()
  await expect(page.getByRole('button', { name: 'Đang mở điều bất ngờ...' })).toBeDisabled()
  await expect(page).toHaveURL(/#\/our-girls$/)
  await expect(page.locator('.gallery-count')).toHaveText('01 / 05')
  await expect(page.locator('.girl-introduction h2')).toHaveText('ABE')
  await expect(page.locator('.girl-introduction > p').first()).toHaveText('assssssssssssssss')
  await expect(page.locator('.selected-polaroid img')).toHaveAttribute('src', '/images/girls/ban1.png')
  await expect(page.locator('.sample-sticker,.sample-note')).toHaveCount(0)
  expect(await page.locator('.gallery-dots button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')))).toEqual([
    'Xem ABE', 'Xem ABA', 'Xem ABZ', 'Xem ABQ', 'Xem ABD',
  ])
  await page.getByRole('button', { name: 'Bạn tiếp theo', exact: true }).click()
  await expect(page.locator('.gallery-count')).toHaveText('02 / 05')
  await expect(page.locator('.girl-introduction h2')).toHaveText('ABA')
  await expect(page.locator('.girl-introduction > p').first()).toHaveText('aaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  for (const [position, name] of [[3, 'ABZ'], [4, 'ABQ'], [5, 'ABD']] as const) {
    const dot = page.getByRole('button', { name: `Xem ${name}`, exact: true })
    await dot.click()
    await expect(page.locator('.gallery-count')).toHaveText(`0${position} / 05`)
    await expect(page.locator('.girl-introduction h2')).toHaveText(name)
    await expect(dot).toHaveAttribute('aria-pressed', 'true')
  }
  await page.getByRole('button', { name: 'Bạn tiếp theo', exact: true }).click()
  await expect(page.locator('.gallery-count')).toHaveText('01 / 05')
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
  await input.fill('AB')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
  for (const excludedExample of ['ABC', 'VI DU', 'Trần Thu Phương']) {
    await input.fill(excludedExample)
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
    await expect(page.locator('.greeting-card')).toHaveCount(0)
  }
  await input.fill('  aBE  ')
  await submit.click()
  await expect(page.locator('.greeting-card')).toBeVisible()
  await expect(page.locator('.card-dear')).toHaveText('Dear 1,')
  await expect(page.locator('.card-letter')).toHaveText('cảm ớndsa')
  await expect(page.locator('.greeting-card')).not.toContainText('Lời chúc riêng của cậu đang được chuẩn bị.')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})

test('opens the only supplied profile named 1 and excludes the row without a photo', async ({ page }) => {
  await page.goto('/#/your-wish')
  const input = page.getByLabel('Tên của cậu là gì?')
  const submit = page.getByRole('button', { name: 'Nhận lời chúc của mình' })
  await input.fill('1')
  await submit.click()
  await expect(page.locator('.card-dear')).toHaveText('Dear 1,')
  await expect(page.locator('.card-letter')).toHaveText('cảm ớndsa')
  await expect(page.locator('.card-photo img')).toHaveAttribute('src', '/images/girls/ban1.png')
  await expect(page.locator('.match-list')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tìm một lời chúc khác' }).click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await input.fill('ABC')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
  await expect(page.locator('.greeting-card')).toHaveCount(0)
  await expect(page.locator('.match-list')).toHaveCount(0)
})

test('pairs all five supplied photos with their original names and literal workbook wishes', async ({ page }) => {
  const expectedProfiles = [
    { name: 'ABE', shortName: '1', image: '/images/girls/ban1.png', width: 853, wish: 'cảm ớndsa' },
    { name: 'ABA', shortName: '3', image: '/images/girls/ban2.jpg', width: 1381, wish: 'ádsvfdffds' },
    { name: 'ABZ', shortName: '4', image: '/images/girls/ban3.jpg', width: 1276, wish: 'ádsssssssssssssssss' },
    { name: 'ABQ', shortName: '5', image: '/images/girls/ban4.jpg', width: 1627, wish: 'dấdaasdada' },
    { name: 'ABD', shortName: '6', image: '/images/girls/ban5.png', width: 853, wish: 'ffffffffffffffffffffffff' },
  ]
  for (const profile of expectedProfiles) {
    await openWish(page, profile.name)
    const image = page.locator('.greeting-card .card-photo img')
    await expect(image).toHaveAttribute('alt', `Ảnh ${profile.name}`)
    const naturalWidth = await image.evaluate(async element => {
      const photo = element as HTMLImageElement
      await photo.decode()
      return photo.naturalWidth
    })
    await expect(image).toHaveAttribute('src', profile.image)
    expect(naturalWidth, `${profile.name} should display the expected photo instead of a fallback`).toBe(profile.width)
    await expect(page.locator('.card-dear')).toHaveText(`Dear ${profile.shortName},`)
    await expect(page.locator('.card-letter')).toHaveText(profile.wish)
    await expect(page.locator('.sample-sticker,.card-placeholder-note,.demo-hint')).toHaveCount(0)
    await page.getByRole('button', { name: 'Tìm một lời chúc khác' }).click()
    await expect(page.getByLabel('Tên của cậu là gì?')).toHaveValue('')
  }
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
  await expect(page.locator('.demo-hint')).toHaveCount(0)
  await input.fill('ABA')
  await expect(input).toHaveValue('ABA')
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.card-dear')).toHaveText('Dear 3,')
  await expect(page.locator('.card-letter')).toHaveText('ádsvfdffds')
})

test('downloads a real, high resolution PNG for the selected recipient', async ({ page }) => {
  await openWish(page)
  await expect(page.locator('.card-letter p')).toHaveCSS('opacity', '1')
  const cardSize = await page.locator('.greeting-card').evaluate(element => ({
    width: element.clientWidth,
  }))
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Lưu thiệp của mình' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('DM66D-20-10-dm66-002.png')
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  expect(png.toString('ascii', 12, 16)).toBe('IHDR')
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(Math.max(1000, cardSize.width) * 3)
  expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(900)
  expect(png.readUInt32BE(16) / png.readUInt32BE(20)).toBeGreaterThan(1.2)
  expect(png.length).toBeGreaterThan(10_000)
  await expect(page.getByRole('status')).toContainText('Thiệp đã được tạo')
})

test('uses a large left portrait on wide screens, stacks on phones and always exports a landscape card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openWish(page)
  const card = page.locator('.result-layout > .greeting-card')
  const photo = card.locator('.card-body > .card-portrait-panel > .card-photo')
  const message = card.locator('.card-body > .card-message')
  await expect(photo).toBeVisible()
  await expect(message.locator('.card-dear')).toHaveText('Dear 1,')
  await expect(message.locator('h2')).toBeVisible()
  await expect(message.locator('.card-letter')).toHaveText('cảm ớndsa')
  await expect(message.locator('.card-signature')).toContainText('DM66D Boys')
  await expect(card.locator('.card-topline')).toContainText('DIGITAL MARKETING 66D')
  let photoBox = (await photo.boundingBox())!
  let messageBox = (await message.boundingBox())!
  expect(photoBox.width).toBeGreaterThanOrEqual(290)
  expect(photoBox.x + photoBox.width).toBeLessThanOrEqual(messageBox.x + 1)
  expect(photoBox.y).toBeLessThan(messageBox.y + messageBox.height)
  expect(messageBox.y).toBeLessThan(photoBox.y + photoBox.height)
  await expectUpdatedClassName(page)

  await page.setViewportSize({ width: 820, height: 1000 })
  photoBox = (await photo.boundingBox())!
  messageBox = (await message.boundingBox())!
  expect(photoBox.x + photoBox.width).toBeLessThanOrEqual(messageBox.x + 1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.setViewportSize({ width: 390, height: 844 })
  photoBox = (await photo.boundingBox())!
  messageBox = (await message.boundingBox())!
  expect(photoBox.width).toBeGreaterThanOrEqual(240)
  expect(photoBox.y + photoBox.height).toBeLessThanOrEqual(messageBox.y + 1)
  await expectNoHorizontalOverflow(page)
  await expectUpdatedClassName(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Lưu thiệp của mình' }).click(),
  ])
  expect(await download.failure()).toBeNull()
  expect(download.suggestedFilename()).toBe('DM66D-20-10-dm66-002.png')
  const path = await download.path()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(3000)
  expect(png.readUInt32BE(16) / png.readUInt32BE(20)).toBeGreaterThan(1.2)
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
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
  expect(download.suggestedFilename()).toBe('DM66D-20-10-dm66-002.png')
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
    ['/#/our-girls', 'Những cô gái của DM66D'],
    ['/#/your-wish', 'Lời chúc dành riêng cho cậu'],
  ]) {
    await page.goto(route)
    await expect(page).toHaveTitle(new RegExp(title))
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', route.slice(1))
    await expectUpdatedClassName(page)
  }
  await page.locator('nav a[href="#/our-girls"]').click()
  await expect(page.locator('.gallery-count')).toHaveText('01 / 05')
  await page.goBack()
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeVisible()
  await page.goForward()
  await expect(page.locator('.gallery-count')).toHaveText('01 / 05')
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
  const gallery = page.getByRole('region', { name: 'Những cô gái Digital Marketing 66D' })
  await gallery.dispatchEvent('pointerdown', { clientX: 290, clientY: 450, pointerType: 'touch', pointerId: 1 })
  await gallery.dispatchEvent('pointerup', { clientX: 90, clientY: 450, pointerType: 'touch', pointerId: 1 })
  await expect(page.locator('.gallery-count')).toHaveText('02 / 05')
  await expect(page.locator('.girl-introduction h2')).toHaveText('ABA')
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
  await expect(page.locator('.gallery-count')).toHaveText('03 / 05')
  await page.locator('nav a[href="#/your-wish"]').click()
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByLabel('Tên của cậu là gì?').fill('  abe  ')
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
  await page.getByLabel('Tên của cậu là gì?').fill('ABE')
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('.card-dear')).toHaveText('Dear 1,')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
  await page.getByRole('button', { name: 'Gửi một trái tim' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn cậu!')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
})
