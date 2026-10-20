import { readFile, writeFile } from 'node:fs/promises'
import { expect, test as base } from '@playwright/test'
import type { Download, Page } from '@playwright/test'
import { mockRecipients, profiles, testStudentCode } from './helpers/recipientFixture'
import { memories } from '../src/data/memories'

const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await use()
    expect(errors, 'The gift journey should not throw browser runtime errors').toEqual([])
  }, { auto: true }],
})

test.beforeEach(async ({ page }) => { await mockRecipients(page) })

async function openWish(page: Page, query = profiles[0].fullName) {
  await page.goto('/#/your-wish')
  await page.getByLabel('Tên của cậu là gì?').fill(query)
  await page.getByLabel('Mã sinh viên của cậu', { exact: true }).fill(testStudentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('main .greeting-card')).toBeVisible()
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

async function disableSavePicker(page: Page) {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined }))
}

async function readySaveButton(page: Page) {
  const button = page.getByRole('button', { name: /^Lưu thiệp của mình/ })
  await expect(button).toBeEnabled({ timeout: 20_000 })
  return button
}

async function downloadedPng(download: Download) {
  expect(download.suggestedFilename()).toBe('DM66D-20-10-fixture-01.png')
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  expect(png.toString('ascii', 12, 16)).toBe('IHDR')
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(3000)
  expect(png.readUInt32BE(16) / png.readUInt32BE(20)).toBeGreaterThan(1.2)
  return png
}

async function inspectPngPixels(page: Page, png: Buffer) {
  return page.evaluate(async base64 => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const edgeColors = {
      left: [220, 0, 0], right: [0, 0, 220],
      top: [0, 170, 0], bottom: [230, 180, 0],
    }
    const edges = Object.fromEntries(Object.keys(edgeColors).map(edge => [edge, {
      count: 0, minX: canvas.width, minY: canvas.height, maxX: 0, maxY: 0,
    }])) as Record<keyof typeof edgeColors, { count: number; minX: number; minY: number; maxX: number; maxY: number }>
    let darkPhotoPixels = 0
    // Sample the actual decoded PNG, rather than trusting a valid file header
    // or the on-screen DOM, which both passed when phone exports lost the photo.
    for (let y = 0; y < canvas.height; y += 3) {
      for (let x = 0; x < canvas.width; x += 3) {
        const index = (y * canvas.width + x) * 4
        const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]]
        if (x > canvas.width * .05 && x < canvas.width * .45 && y > canvas.height * .18 && y < canvas.height * .9 && rgb.every(channel => channel < 90)) darkPhotoPixels += 1
        for (const [edge, color] of Object.entries(edgeColors)) {
          if (!rgb.every((channel, channelIndex) => Math.abs(channel - color[channelIndex]) < 8)) continue
          const stats = edges[edge as keyof typeof edges]
          stats.count += 1
          stats.minX = Math.min(stats.minX, x)
          stats.minY = Math.min(stats.minY, y)
          stats.maxX = Math.max(stats.maxX, x)
          stats.maxY = Math.max(stats.maxY, y)
        }
      }
    }
    return { width: canvas.width, height: canvas.height, darkPhotoPixels, edges }
  }, png.toString('base64'))
}

type NativeSaveMode = 'picker' | 'picker-abort' | 'share' | 'share-abort' | 'share-failed' | 'mobile-unsupported'
type NativeSaveProbe = {
  calls: number
  activeGestures: boolean[]
  invokedDuringClick: boolean[]
  inClick: boolean
  pickerOptions: Record<string, unknown>[]
  files: { name: string; type: string; size: number; signature: number[]; width: number; height: number }[]
  closes: number
}

async function installNativeSaveMock(page: Page, mode: NativeSaveMode) {
  await page.addInitScript((mode: NativeSaveMode) => {
    const state: NativeSaveProbe = { calls: 0, activeGestures: [], invokedDuringClick: [], inClick: false, pickerOptions: [], files: [], closes: 0 }
    Object.assign(window, { nativeSaveProbe: state })
    // Guard the actual bubbling callback. A separate capture listener's
    // microtask runs before React receives the same click in Chromium.
    const addListener = EventTarget.prototype.addEventListener
    const removeListener = EventTarget.prototype.removeEventListener
    const wrappedListeners = new WeakMap<EventListenerOrEventListenerObject, EventListener>()
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture
      if (type === 'click' && listener && !capture) {
        const wrapped: EventListener = function (event) {
          state.inClick = true
          queueMicrotask(() => { state.inClick = false })
          if (typeof listener === 'function') listener.call(this, event)
          else listener.handleEvent(event)
        }
        wrappedListeners.set(listener, wrapped)
        return addListener.call(this, type, wrapped, options)
      }
      return addListener.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture
      const wrapped = type === 'click' && listener && !capture ? wrappedListeners.get(listener) : undefined
      return removeListener.call(this, type, wrapped || listener, options)
    }
    const recordInvocation = () => {
      state.calls += 1
      state.activeGestures.push(navigator.userActivation.isActive)
      state.invokedDuringClick.push(state.inClick)
    }
    const recordFile = async (file: File) => {
      const buffer = await file.arrayBuffer()
      const view = new DataView(buffer)
      state.files.push({ name: file.name, type: file.type, size: file.size, signature: Array.from(new Uint8Array(buffer, 0, 8)), width: view.getUint32(16), height: view.getUint32(20) })
    }
    const mobile = mode.startsWith('share') || mode === 'mobile-unsupported'
    if (mobile) {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' })
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    }
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: mode.startsWith('picker') ? (options: Record<string, unknown>) => {
      recordInvocation()
      state.pickerOptions.push(options)
      if (mode === 'picker-abort') return Promise.reject(new DOMException('The user cancelled the picker', 'AbortError'))
      return Promise.resolve({ createWritable: async () => ({
        write: async (file: File) => { await recordFile(file) },
        close: async () => { state.closes += 1 },
      }) })
    } : undefined })
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: mode.startsWith('share') ? (data: ShareData) => !!data.files?.length && data.files.every(file => file instanceof File && file.type === 'image/png' && file.size > 0) : undefined })
    Object.defineProperty(navigator, 'share', { configurable: true, value: mode.startsWith('share') ? (data: ShareData) => {
      recordInvocation()
      if (mode === 'share-abort') return Promise.reject(new DOMException('The user cancelled sharing', 'AbortError'))
      if (mode === 'share-failed') return Promise.reject(new DOMException('Sharing is unavailable', 'NotAllowedError'))
      return Promise.all(data.files!.map(file => recordFile(file))).then(() => undefined)
    } : undefined })
  }, mode)
}

async function nativeSaveProbe(page: Page) {
  return page.evaluate(() => (window as unknown as { nativeSaveProbe: NativeSaveProbe }).nativeSaveProbe)
}

function expectNativePng(file: NativeSaveProbe['files'][number]) {
  expect(file.name).toBe('DM66D-20-10-fixture-01.png')
  expect(file.type).toBe('image/png')
  expect(file.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(file.size).toBeGreaterThan(10_000)
  expect(file.width).toBeGreaterThanOrEqual(3000)
  expect(file.width / file.height).toBeGreaterThan(1.2)
}

test('opens the unchanged gift into the class photo-pair album and the next chapter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gửi cậu')
  await page.getByRole('button', { name: /Mở món quà của chúng tớ/ }).click()
  await expect(page.getByRole('button', { name: /Đang mở điều bất ngờ/ })).toBeDisabled()
  await expect(page).toHaveURL(/#\/our-memories$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  await expect(page.locator('.memories-count')).toHaveText('01/15')
  await expect(page.locator('.memories-slide')).toHaveCount(1)
  await expect(page.locator('.memories-paper')).toHaveCount(2)
  await expect(page.locator('.memories-slide img')).toHaveCount(2)
  await expect(page.locator('.memories-slide img').first()).toHaveAttribute('src', memories[0].images[0].src)
  await expect(page.locator('.memories-caption h2')).toHaveText('Gặp gỡ đầu năm')
  await expect(page.locator('.gallery,.girl-introduction')).toHaveCount(0)
  await page.getByRole('button', { name: /Xem kỷ niệm tiếp theo/ }).click()
  await expect(page.locator('.memories-caption h2')).toHaveText('First 20/10')
  await expect(page.locator('.memories-count')).toHaveText('02/15')
  await page.getByRole('button', { name: /Xem kỷ niệm 3:/ }).click()
  await expect(page.locator('.memories-caption h2')).toHaveText('Ngày hội vui vẻ')
  await expect(page.locator('.memories-description')).toContainText('giải Tập Thể Lớp Xuất Sắc Nhất')
  await expect(page.getByRole('button', { name: /Xem kỷ niệm 3:/ })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: /Xem kỷ niệm 15:/ }).click()
  await expect(page.locator('.memories-count')).toHaveText('15/15')
  await page.getByRole('button', { name: /Xem kỷ niệm tiếp theo/ }).click()
  await expect(page.locator('.memories-count')).toHaveText('01/15')
  await page.getByRole('button', { name: /Khám phá lời chúc dành riêng cho cậu/ }).click()
  await expect(page).toHaveURL(/#\/your-wish$/)
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeVisible()
})

test('validates name and student code accessibly before looking up the spreadsheet', async ({ page }) => {
  await page.goto('/#/your-wish')
  const input = page.getByLabel('Tên của cậu là gì?')
  const code = page.getByLabel('Mã sinh viên của cậu', { exact: true })
  const submit = page.getByRole('button', { name: 'Nhận lời chúc của mình' })
  await submit.click()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAttribute('aria-describedby', 'name-error')
  await expect(input).toBeFocused()
  await expect(page.getByRole('alert')).toContainText('biết tên trước')
  await input.fill(profiles[0].fullName)
  await submit.click()
  await expect(code).toBeFocused()
  await expect(page.getByRole('alert')).toContainText('nhập mã sinh viên')
  await code.fill('WRONG-TEST-CODE')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('Tên hoặc mã sinh viên chưa đúng')
  await expect(code).toHaveValue('WRONG-TEST-CODE')
  await expect(page.locator('main .greeting-card')).toHaveCount(0)
  await code.fill(testStudentCode)
  await submit.click()
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('main .card-dear')).toHaveText('Dear Bạn mẫu 1,')
  await expect(page.locator('main .card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})

test('pairs synthetic spreadsheet profiles with the right portraits and wishes', async ({ page }) => {
  for (const profile of profiles) {
    await openWish(page, profile.fullName)
    const image = page.locator('main .greeting-card .card-photo img')
    await expect(image).toHaveAttribute('alt', `Ảnh ${profile.fullName}`)
    const naturalWidth = await image.evaluate(async element => {
      const photo = element as HTMLImageElement
      await photo.decode()
      return photo.naturalWidth
    })
    await expect(image).toHaveAttribute('src', profile.image)
    expect(naturalWidth).toBe(profile.width)
    await expect(page.locator('main .card-dear')).toHaveText(`Dear ${profile.displayName},`)
    await expect(page.locator('main .card-letter')).toHaveText(profile.wish)
    await expect(page.locator('.sample-sticker,.card-placeholder-note,.demo-hint')).toHaveCount(0)
    await page.getByRole('button', { name: 'Nhập lại tên và mã sinh viên' }).click()
    await expect(page.getByLabel('Tên của cậu là gì?')).toBeEnabled()
    await expect(page.getByLabel('Tên của cậu là gì?')).toHaveValue('')
  }
})

test('replays the letter, sends a heart, dismisses the toast and starts another search', async ({ page }) => {
  await openWish(page)
  const originalLetter = await page.locator('main .card-letter').textContent()
  await page.getByRole('button', { name: 'Đọc lại lời chúc' }).click()
  await expect(page.locator('main .card-letter')).toHaveText(originalLetter || '')
  await expect(page.locator('main .card-letter p')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Gửi một trái tim' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn cậu!')
  await page.getByRole('button', { name: 'Đóng thông báo' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Nhập lại tên và mã sinh viên' }).click()
  const input = page.getByLabel('Tên của cậu là gì?')
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.locator('main .greeting-card')).toHaveCount(0)
  await expect(page.locator('.demo-hint')).toHaveCount(0)
  await input.fill(profiles[1].fullName)
  await page.getByLabel('Mã sinh viên của cậu', { exact: true }).fill(testStudentCode)
  await expect(input).toHaveValue(profiles[1].fullName)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('main .card-dear')).toHaveText('Dear Bạn mẫu 2,')
  await expect(page.locator('main .card-letter')).toHaveText('Lời chúc kiểm thử số 2.')
})

test('downloads a real, high resolution PNG for the selected recipient', async ({ page }) => {
  await disableSavePicker(page)
  await openWish(page)
  await expect(page.locator('main .card-letter p')).toHaveCSS('opacity', '1')
  const cardSize = await page.locator('main .greeting-card').evaluate(element => ({
    width: element.clientWidth,
  }))
  const save = await readySaveButton(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    save.click(),
  ])
  expect(download.suggestedFilename()).toBe('DM66D-20-10-fixture-01.png')
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
  const pixels = await inspectPngPixels(page, png)
  expect(pixels.darkPhotoPixels, 'The saved PNG must include the supplied photo, including its dark synthetic background').toBeGreaterThan(1_000)
})

test('uses a large left portrait on wide screens, stacks on phones and always exports a landscape card', async ({ page }) => {
  await disableSavePicker(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openWish(page)
  const card = page.locator('.result-layout > .greeting-card')
  const photo = card.locator('.card-body > .card-portrait-panel > .card-photo')
  const message = card.locator('.card-body > .card-message')
  await expect(photo).toBeVisible()
  await expect(message.locator('.card-dear')).toHaveText('Dear Bạn mẫu 1,')
  await expect(message.locator('h2')).toBeVisible()
  await expect(message.locator('.card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
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

  const save = await readySaveButton(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    save.click(),
  ])
  expect(await download.failure()).toBeNull()
  expect(download.suggestedFilename()).toBe('DM66D-20-10-fixture-01.png')
  const path = await download.path()
  const png = await readFile(path!)
  expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true)
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(3000)
  expect(png.readUInt32BE(16) / png.readUInt32BE(20)).toBeGreaterThan(1.2)
  const pixels = await inspectPngPixels(page, png)
  expect(pixels.darkPhotoPixels, 'The phone PNG must include the photo as well as the text').toBeGreaterThan(1_000)
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('prepares the full letter and reuses the identical cached PNG after replay', async ({ page }) => {
  await disableSavePicker(page)
  await openWish(page)
  const save = await readySaveButton(page)
  await expect(page.locator('main .card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
  const [firstDownload] = await Promise.all([page.waitForEvent('download'), save.click()])
  const firstPng = await downloadedPng(firstDownload)
  await page.getByRole('button', { name: 'Đọc lại lời chúc' }).click()
  await expect(page.locator('main .card-letter')).toHaveText('Lời chúc kiểm thử số 1.')
  await expect(page.locator('main .card-letter p')).toHaveCSS('opacity', '1')
  await expect(save).toBeEnabled()
  const [secondDownload] = await Promise.all([page.waitForEvent('download'), save.click()])
  const secondPng = await downloadedPng(secondDownload)
  expect(secondPng.equals(firstPng)).toBe(true)
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
})

test('keeps every edge of portrait and landscape photos visible in the phone PNG', async ({ page }, testInfo) => {
  await disableSavePicker(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const [orientation, width, height] of [
    ['portrait', 180, 360], ['landscape', 360, 180],
  ] as const) {
    const fixture = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#e9e1d8"/><path fill="rgb(220,0,0)" d="M0 8h8v84H0z"/><path fill="rgb(0,0,220)" d="M92 8h8v84h-8z"/><path fill="rgb(0,170,0)" d="M0 0h100v8H0z"/><path fill="rgb(230,180,0)" d="M0 92h100v8H0z"/></svg>`
    await page.route('**/test-portraits/recipient-01.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: fixture }))
    await openWish(page)
    const save = await readySaveButton(page)
    const [download] = await Promise.all([page.waitForEvent('download'), save.click()])
    const png = await downloadedPng(download)
    const pixels = await inspectPngPixels(page, png)
    for (const [edge, stats] of Object.entries(pixels.edges)) {
      expect(stats.count, `${orientation}: the saved image must retain the ${edge} edge instead of cropping or omitting the photo`).toBeGreaterThan(100)
      expect(stats.maxX, `${orientation}: the full photo should remain in the left side of the card`).toBeLessThan(pixels.width / 2)
    }
    expect(pixels.edges.left.minX).toBeLessThan(pixels.edges.right.minX)
    expect(pixels.edges.top.minY).toBeLessThan(pixels.edges.bottom.minY)
    const proofPath = testInfo.outputPath(`phone-${orientation}-whole-photo.png`)
    await writeFile(proofPath, png)
    await testInfo.attach(`phone-${orientation}-whole-photo.png`, { path: proofPath, contentType: 'image/png' })
    await page.unroute('**/test-portraits/recipient-01.svg')
    await page.getByRole('button', { name: 'Nhập lại tên và mã sinh viên' }).click()
  }
})

test('exports a long Vietnamese wish without overlapping text or losing paragraphs', async ({ page }, testInfo) => {
  await disableSavePicker(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openWish(page)
  const save = await readySaveButton(page)
  const [shortDownload] = await Promise.all([page.waitForEvent('download'), save.click()])
  const shortPng = await downloadedPng(shortDownload)
  const paragraphs = [
    'Chúc cậu một ngày 20/10 thật nhiều niềm vui, luôn tự tin với những điều mình lựa chọn và giữ mãi nụ cười rạng rỡ. Mong mọi cố gắng của cậu đều được đền đáp bằng những kết quả thật xứng đáng.',
    'Cảm ơn cậu vì những buổi học, những lần cùng nhau hoàn thành bài tập và những kỷ niệm đáng nhớ của lớp Digital Marketing 66D. Chúc cậu luôn có những người bạn tốt bên cạnh, được yêu thương và sống hết mình với ước mơ.',
    'Dù hành trình phía trước có nhiều thử thách, hy vọng cậu vẫn luôn mạnh mẽ, hạnh phúc và biết trân trọng bản thân. Chúng tớ mong rằng mỗi ngày của cậu đều có một điều đáng yêu để nhớ, một điều mới mẻ để học và một lý do để mỉm cười.',
  ]
  const exported = await page.evaluate(async paragraphs => {
    const card = document.querySelector<HTMLDivElement>('main .greeting-card')!
    card.querySelector('.card-letter')!.replaceChildren(...paragraphs.map(text => {
      const paragraph = document.createElement('p')
      paragraph.textContent = text
      return paragraph
    }))
    const paintedText: { text: string; left: number; top: number; right: number; bottom: number; baseline: number }[] = []
    const originalFillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      const metrics = this.measureText(text)
      const transform = this.getTransform()
      const corners = [
        new DOMPoint(x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent),
        new DOMPoint(x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent),
      ].map(point => point.matrixTransform(transform))
      paintedText.push({
        text, left: Math.min(...corners.map(point => point.x)), top: Math.min(...corners.map(point => point.y)),
        right: Math.max(...corners.map(point => point.x)), bottom: Math.max(...corners.map(point => point.y)),
        baseline: new DOMPoint(x, y).matrixTransform(transform).y,
      })
      if (maxWidth === undefined) return originalFillText.call(this, text, x, y)
      return originalFillText.call(this, text, x, y, maxWidth)
    }
    try {
      const modulePath = '/src/lib/cardImage.ts'
      const { createCardImage } = await import(modulePath)
      const file: File = await createCardImage(card, 'long-wish-fixture')
      const png = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      return { png, paintedText }
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText
    }
  }, paragraphs)
  const png = Buffer.from(exported.png, 'base64')
  expect(png.readUInt32BE(16)).toBe(shortPng.readUInt32BE(16))
  expect(png.readUInt32BE(20), 'The card should grow to fit a long wish instead of squeezing lines together').toBeGreaterThan(shortPng.readUInt32BE(20) + 100)
  const paintedWords = exported.paintedText.map(line => line.text).join(' ').replace(/\s+/g, ' ')
  expect(paintedWords).toContain(paragraphs.join(' '))
  for (let index = 0; index < exported.paintedText.length; index += 1) {
    const first = exported.paintedText[index]
    for (const second of exported.paintedText.slice(index + 1)) {
      if (Math.abs(first.baseline - second.baseline) < 2) continue // Inline title fragments share a baseline.
      const horizontalOverlap = Math.min(first.right, second.right) - Math.max(first.left, second.left)
      const verticalOverlap = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top)
      expect(horizontalOverlap > 1 && verticalOverlap > 1, `Saved text must not overlap: “${first.text}” / “${second.text}”`).toBe(false)
    }
  }
  const proofPath = testInfo.outputPath('phone-long-vietnamese-wish.png')
  await writeFile(proofPath, png)
  await testInfo.attach('phone-long-vietnamese-wish.png', { path: proofPath, contentType: 'image/png' })
})

test('opens the desktop file picker during the click and writes and closes a valid PNG', async ({ page }) => {
  await installNativeSaveMock(page, 'picker')
  await openWish(page)
  await (await readySaveButton(page)).click()
  await expect.poll(async () => (await nativeSaveProbe(page)).closes).toBe(1)
  const probe = await nativeSaveProbe(page)
  expect(probe.calls).toBe(1)
  expect(probe.activeGestures).toEqual([true])
  expect(probe.invokedDuringClick).toEqual([true])
  expect(probe.pickerOptions).toMatchObject([{ suggestedName: 'DM66D-20-10-fixture-01.png', types: [{ accept: { 'image/png': ['.png'] } }] }])
  expect(probe.files).toHaveLength(1)
  expectNativePng(probe.files[0])
  await expect(page.getByRole('dialog', { name: 'Lưu thiệp vào máy' })).not.toBeVisible()
})

test('shares the prepared mobile PNG while the original tap activation is still active', async ({ page }) => {
  await installNativeSaveMock(page, 'share')
  await page.setViewportSize({ width: 390, height: 844 })
  await openWish(page)
  await (await readySaveButton(page)).click()
  await expect.poll(async () => (await nativeSaveProbe(page)).files.length).toBe(1)
  const probe = await nativeSaveProbe(page)
  expect(probe.calls).toBe(1)
  expect(probe.activeGestures).toEqual([true])
  expect(probe.invokedDuringClick).toEqual([true])
  expectNativePng(probe.files[0])
  const dialog = page.getByRole('dialog', { name: 'Lưu thiệp vào máy' })
  await expect(dialog).not.toBeVisible()
  const manualShortcut = page.getByRole('button', { name: 'Mở ảnh để lưu vào máy' })
  await manualShortcut.click()
  await expect(dialog).toBeVisible()
  expect((await nativeSaveProbe(page)).calls).toBe(1)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(manualShortcut).toBeFocused()
})

for (const mode of ['picker-abort', 'share-abort'] as const) {
  test(`keeps ${mode === 'picker-abort' ? 'desktop picker' : 'mobile sharing'} cancellation quiet`, async ({ page }) => {
    await installNativeSaveMock(page, mode)
    const downloads: Download[] = []
    page.on('download', download => downloads.push(download))
    await openWish(page)
    const save = await readySaveButton(page)
    await save.click()
    await expect.poll(async () => (await nativeSaveProbe(page)).calls).toBe(1)
    await expect(save).toBeEnabled()
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Lưu thiệp vào máy' })).not.toBeVisible()
    expect(downloads).toHaveLength(0)
  })
}

for (const mode of ['mobile-unsupported', 'share-failed'] as const) {
  test(`offers full-size image saving when mobile sharing is ${mode === 'mobile-unsupported' ? 'unsupported' : 'rejected'}`, async ({ page }) => {
    await installNativeSaveMock(page, mode)
    await page.setViewportSize({ width: 390, height: 844 })
    await openWish(page)
    const save = await readySaveButton(page)
    await save.click()
    const dialog = page.getByRole('dialog', { name: 'Lưu thiệp vào máy', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Nhấn giữ ảnh')
    const imageSize = await dialog.locator('img').evaluate(async image => {
      await (image as HTMLImageElement).decode()
      return { width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight }
    })
    expect(imageSize.width).toBeGreaterThanOrEqual(3000)
    expect(imageSize.width / imageSize.height).toBeGreaterThan(1.2)
    expect((await nativeSaveProbe(page)).calls).toBe(mode === 'share-failed' ? 1 : 0)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Tải ảnh PNG' }).click(),
    ])
    await downloadedPng(download)
    await dialog.getByRole('button', { name: 'Đóng ảnh thiệp' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(save).toBeFocused()
    const manualShortcut = page.getByRole('button', { name: 'Mở ảnh để lưu vào máy' })
    await manualShortcut.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(manualShortcut).toBeFocused()
    await expectNoHorizontalOverflow(page)
  })
}

test('keeps saving disabled during preparation and can retry a failed PNG encoder', async ({ page }) => {
  await disableSavePicker(page)
  await page.addInitScript(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob
    let calls = 0
    HTMLCanvasElement.prototype.toBlob = function (callback, ...options) {
      calls += 1
      Object.assign(window, { pngEncoderCalls: calls })
      if (calls === 1) {
        Object.assign(window, { failFirstPngEncoding: () => callback(null) })
        return
      }
      return originalToBlob.call(this, callback, ...options)
    }
  })
  await openWish(page)
  const preparing = page.getByRole('button', { name: /^Đang chuẩn bị ảnh/ })
  await expect(preparing).toBeDisabled()
  await expect(preparing).toHaveAttribute('aria-busy', 'true')
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { failFirstPngEncoding?: () => void }).failFirstPngEncoding)).toBe('function')
  await page.evaluate(() => (window as unknown as { failFirstPngEncoding: () => void }).failFirstPngEncoding())
  await expect(page.getByRole('alert')).toContainText('Chưa tạo được ảnh thiệp')
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: /^Thử tạo ảnh lại/ }).click()
  const save = await readySaveButton(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()])
  await downloadedPng(download)
  expect(await page.evaluate(() => (window as unknown as { pngEncoderCalls: number }).pngEncoderCalls)).toBe(2)
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
})

test('supports five public routes, legacy memory links, navigation history and music explanation', async ({ page }) => {
  for (const [route, title] of [
    ['/#/', 'Gửi cậu'],
    ['/#/our-memories', 'Kỷ niệm của chúng mình'],
    ['/#/your-wish', 'Lời chúc dành riêng cho cậu'],
    ['/#/letters-to-boys', 'Thư gửi các bạn nam'],
    ['/#/photobooth', 'Photobooth'],
  ]) {
    await page.goto(route)
    await expect(page).toHaveTitle(new RegExp(title))
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', route.slice(1))
    await expectUpdatedClassName(page)
  }
  await page.goto('/#/our-girls')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', '#/our-memories')
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.memories-count')).toHaveText('01/15')
  await page.goForward()
  await expect(page.getByLabel('Tên của cậu là gì?')).toBeVisible()
  const music = page.getByRole('button', { name: 'Bật nhạc', exact: true })
  await expect(music).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('audio')).toHaveCount(0)
  await music.click()
  await expect(page.locator('.music-popover')).toContainText('nhạc sẽ theo cậu qua các trang')
  await expect(page.getByRole('link', { name: 'Nghe trên YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=oahyzTO6VFw')
  await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
  await expect(page.locator('.music-popover')).toBeHidden()
})

test('fits every mobile route, swipes memories and keeps errors and personalized card usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/admin/session', route => route.fulfill({ status: 401, json: { error: 'unauthorized' } }))
  for (const route of ['/#/', '/#/our-memories', '/#/your-wish', '/#/letters-to-boys', '/#/photobooth', '/#/admin']) {
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
  await page.goto('/#/our-memories')
  const album = page.locator('.memories-scrapbook')
  await album.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 290, clientY: 450 }] })
  await album.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 90, clientY: 450 }] })
  await expect(page.locator('.memories-count')).toHaveText('02/15')
  await expect(page.locator('.memories-caption h2')).toHaveText('First 20/10')
  await expectNoHorizontalOverflow(page)
  // A mostly vertical gesture must scroll instead of changing the memory.
  await album.dispatchEvent('touchstart', { touches: [{ identifier: 2, clientX: 240, clientY: 350 }] })
  await album.dispatchEvent('touchend', { changedTouches: [{ identifier: 2, clientX: 200, clientY: 550 }] })
  await expect(page.locator('.memories-count')).toHaveText('02/15')
  await page.getByRole('button', { name: /Khám phá lời chúc dành riêng cho cậu/ }).click()
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByLabel('Tên của cậu là gì?').fill(profiles[0].fullName)
  await page.getByLabel('Mã sinh viên của cậu', { exact: true }).fill(testStudentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('main .greeting-card')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await readySaveButton(page)
  await page.getByRole('button', { name: /Gửi lời nhắn đến các bạn nam/ }).click()
  await expect(page).toHaveURL(/#\/letters-to-boys$/)
  await expect(page.getByLabel(/Tên của cậu là gì/)).toHaveValue(profiles[0].fullName)
  await expectNoHorizontalOverflow(page)
})

test('honors reduced motion while retaining the complete gift interaction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.ambient-heart').first()).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Mở món quà của chúng tớ' }).click()
  await expect(page).toHaveURL(/#\/our-memories$/)
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
  await expect(page.locator('.memories-floating-heart')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: /Khám phá lời chúc dành riêng cho cậu/ }).click()
  await page.getByLabel('Tên của cậu là gì?').fill(profiles[0].fullName)
  await page.getByLabel('Mã sinh viên của cậu', { exact: true }).fill(testStudentCode)
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await page.getByRole('button', { name: /^Đọc lời chúc 1/ }).click()
  await expect(page.locator('main .card-dear')).toHaveText('Dear Bạn mẫu 1,')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
  await page.getByRole('button', { name: 'Gửi một trái tim' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn cậu!')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
})
