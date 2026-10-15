import { readFile } from 'node:fs/promises'
import { expect, test as base } from '@playwright/test'
import type { Download, Page } from '@playwright/test'

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
  expect(download.suggestedFilename()).toBe('DM66D-20-10-dm66-002.png')
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
  expect(file.name).toBe('DM66D-20-10-dm66-002.png')
  expect(file.type).toBe('image/png')
  expect(file.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(file.size).toBeGreaterThan(10_000)
  expect(file.width).toBeGreaterThanOrEqual(3000)
  expect(file.width / file.height).toBeGreaterThan(1.2)
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
  await expect(page.locator('main .greeting-card')).toHaveCount(0)
  await input.fill('AB')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
  for (const excludedExample of ['ABC', 'VI DU', 'Trần Thu Phương']) {
    await input.fill(excludedExample)
    await submit.click()
    await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
    await expect(page.locator('main .greeting-card')).toHaveCount(0)
  }
  await input.fill('  aBE  ')
  await submit.click()
  await expect(page.locator('main .greeting-card')).toBeVisible()
  await expect(page.locator('main .card-dear')).toHaveText('Dear 1,')
  await expect(page.locator('main .card-letter')).toHaveText('cảm ớndsa')
  await expect(page.locator('main .greeting-card')).not.toContainText('Lời chúc riêng của cậu đang được chuẩn bị.')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})

test('opens the only supplied profile named 1 and excludes the row without a photo', async ({ page }) => {
  await page.goto('/#/your-wish')
  const input = page.getByLabel('Tên của cậu là gì?')
  const submit = page.getByRole('button', { name: 'Nhận lời chúc của mình' })
  await input.fill('1')
  await submit.click()
  await expect(page.locator('main .card-dear')).toHaveText('Dear 1,')
  await expect(page.locator('main .card-letter')).toHaveText('cảm ớndsa')
  await expect(page.locator('main .card-photo img')).toHaveAttribute('src', '/images/girls/ban1.png')
  await expect(page.locator('.match-list')).toHaveCount(0)
  await page.getByRole('button', { name: 'Tìm một lời chúc khác' }).click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await input.fill('ABC')
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('chưa tìm thấy tên')
  await expect(page.locator('main .greeting-card')).toHaveCount(0)
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
    const image = page.locator('main .greeting-card .card-photo img')
    await expect(image).toHaveAttribute('alt', `Ảnh ${profile.name}`)
    const naturalWidth = await image.evaluate(async element => {
      const photo = element as HTMLImageElement
      await photo.decode()
      return photo.naturalWidth
    })
    await expect(image).toHaveAttribute('src', profile.image)
    expect(naturalWidth, `${profile.name} should display the expected photo instead of a fallback`).toBe(profile.width)
    await expect(page.locator('main .card-dear')).toHaveText(`Dear ${profile.shortName},`)
    await expect(page.locator('main .card-letter')).toHaveText(profile.wish)
    await expect(page.locator('.sample-sticker,.card-placeholder-note,.demo-hint')).toHaveCount(0)
    await page.getByRole('button', { name: 'Tìm một lời chúc khác' }).click()
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
  await page.getByRole('button', { name: 'Tìm một lời chúc khác' }).click()
  const input = page.getByLabel('Tên của cậu là gì?')
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.locator('main .greeting-card')).toHaveCount(0)
  await expect(page.locator('.demo-hint')).toHaveCount(0)
  await input.fill('ABA')
  await expect(input).toHaveValue('ABA')
  await page.getByRole('button', { name: 'Nhận lời chúc của mình' }).click()
  await expect(page.locator('main .card-dear')).toHaveText('Dear 3,')
  await expect(page.locator('main .card-letter')).toHaveText('ádsvfdffds')
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
})

test('uses a large left portrait on wide screens, stacks on phones and always exports a landscape card', async ({ page }) => {
  await disableSavePicker(page)
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

  const save = await readySaveButton(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    save.click(),
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

test('prepares fully visible letter content once and reuses the cached PNG after replay', async ({ page }) => {
  await disableSavePicker(page)
  await page.addInitScript(() => {
    const snapshots: { opacities: string[]; text: string }[] = []
    Object.assign(window, { preparedCardSnapshots: snapshots })
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        const card = node.matches('[data-card-export="true"]') ? node : node.querySelector('[data-card-export="true"]')
        if (card) snapshots.push({
          opacities: Array.from(card.querySelectorAll('.card-letter p'), paragraph => getComputedStyle(paragraph).opacity),
          text: card.querySelector('.card-letter')?.textContent?.trim() || '',
        })
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await openWish(page)
  const save = await readySaveButton(page)
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
  const beforeReplay = await page.evaluate(() => (window as unknown as { preparedCardSnapshots: { opacities: string[]; text: string }[] }).preparedCardSnapshots)
  expect(beforeReplay.length).toBeGreaterThan(0)
  for (const snapshot of beforeReplay) {
    expect(snapshot.opacities.length).toBeGreaterThan(0)
    expect(snapshot.opacities.every(opacity => opacity === '1')).toBe(true)
    expect(snapshot.text).toBe('cảm ớndsa')
  }
  const [firstDownload] = await Promise.all([page.waitForEvent('download'), save.click()])
  const firstPng = await downloadedPng(firstDownload)
  await page.getByRole('button', { name: 'Đọc lại lời chúc' }).click()
  await expect(page.locator('main .card-letter')).toHaveText('cảm ớndsa')
  await expect(page.locator('main .card-letter p')).toHaveCSS('opacity', '1')
  await expect(save).toBeEnabled()
  const [secondDownload] = await Promise.all([page.waitForEvent('download'), save.click()])
  const secondPng = await downloadedPng(secondDownload)
  expect(secondPng.equals(firstPng)).toBe(true)
  const afterReplay = await page.evaluate(() => (window as unknown as { preparedCardSnapshots: unknown[] }).preparedCardSnapshots.length)
  expect(afterReplay).toBe(beforeReplay.length)
  await expect(page.locator('[data-card-export="true"]')).toHaveCount(0)
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
  expect(probe.pickerOptions).toMatchObject([{ suggestedName: 'DM66D-20-10-dm66-002.png', types: [{ accept: { 'image/png': ['.png'] } }] }])
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
  await expect(page.locator('main .greeting-card')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await readySaveButton(page)
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
  await expect(page.locator('main .card-dear')).toHaveText('Dear 1,')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
  await page.getByRole('button', { name: 'Gửi một trái tim' }).click()
  await expect(page.getByRole('status')).toContainText('Cảm ơn cậu!')
  await expect(page.locator('.heart-burst > span')).toHaveCount(0)
})
