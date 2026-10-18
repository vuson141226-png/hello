import { readFile } from 'node:fs/promises'
import { expect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'
import { memories } from '../src/data/memories'

// These mocked responses verify UI behavior and protocol handling only.
// Database persistence and authorization are covered by backend integration tests.
const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await use()
    expect(errors).toEqual([])
  }, { auto: true }],
})

type Submission = { senderName: string; message: string; submissionId: string; website: string }
const testLetters = [
  { id: 'msg-first', senderName: 'Một cô gái DM66D', message: 'Cảm ơn các bạn nam vì món quà rất đáng yêu! 🌷', createdAt: '2026-10-16T01:30:00.000Z', status: 'saved' },
  { id: 'msg-second', senderName: 'Bạn thứ hai', message: 'Một lời nhắn thứ hai, có xuống dòng.\nChúc mọi người luôn vui vẻ! 💗', createdAt: '2026-10-16T02:30:00.000Z', status: 'saved' },
]

const senderInput = (page: Page) => page.getByLabel(/Tên của cậu là gì/)
const messageInput = (page: Page) => page.getByLabel(/Cậu có điều gì muốn gửi đến các bạn nam/)
const submitButton = (page: Page) => page.getByRole('button', { name: /Gửi lời nhắn của tớ/ })
const successTitle = (page: Page) => page.getByRole('heading', { name: /Your Letter Has Been Sent/ })

async function expectFitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

async function mockAdminSession(page: Page, authenticated = true) {
  await page.route('**/api/admin/session', route => route.fulfill({
    status: authenticated ? 200 : 401,
    json: authenticated ? { authenticated: true, email: 'admin@example.test' } : { error: 'unauthorized' },
  }))
}

async function expectMemory(page: Page, index: number) {
  const memory = memories[index]
  await expect(page.locator('.memories-count')).toHaveText(`${String(index + 1).padStart(2, '0')}/15`)
  await expect(page.locator('.memories-slide')).toHaveCount(1)
  await expect(page.locator('.memories-caption h2')).toHaveText(memory.title)
  const description = page.locator('.memories-description')
  if (memory.description) await expect(description).toHaveText(memory.description)
  else await expect(description).toHaveCount(0)
  await expect(page.locator('.memories-live')).toHaveText(`Kỷ niệm ${index + 1} trên 15: ${memory.title}`)
  await expect(page.locator('.memories-dots button').nth(index)).toHaveAttribute('aria-current', 'true')
}

async function expectMemoryPhotos(page: Page, index: number) {
  const images = memories[index].images.filter(image => !image.isPlaceholder)
  const photos = page.locator('.memories-image-frame img')
  await expect(page.locator('.memories-paper')).toHaveCount(2)
  await expect(photos).toHaveCount(images.length)
  await expect(page.locator('.memories-photo-unavailable')).toHaveCount(2 - images.length)
  for (const [imageIndex, image] of images.entries()) {
    const photo = photos.nth(imageIndex)
    await expect(photo).toHaveAttribute('src', image.src)
    await expect(photo).toHaveAttribute('alt', image.altText)
    await expect(photo).toHaveCSS('object-fit', 'contain')
    await expect.poll(() => photo.evaluate(element => {
      const image = element as HTMLImageElement
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
    }), { message: `The uploaded photo should load: ${image.src}` }).toBe(true)
  }
}

async function expectCaptionUnclipped(page: Page) {
  for (const copy of await page.locator('.memories-caption h2, .memories-description').all()) {
    await expect(copy).toBeVisible()
    expect(await copy.evaluate(element => ({
      fits: element.scrollHeight <= element.clientHeight + 1,
      ellipsis: getComputedStyle(element).textOverflow === 'ellipsis',
    }))).toEqual({ fits: true, ellipsis: false })
  }
}

test('keeps real event titles, full captions and both photos synchronized with arrows, dots and keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/our-memories')
  const carousel = page.getByRole('region', { name: 'Album kỷ niệm lớp Digital Marketing 66D' })
  expect(memories).toHaveLength(15)
  await expect(page.locator('.memories-dots button')).toHaveCount(15)
  await expect(page.locator('.memories-caption h2')).toHaveText('Gặp gỡ đầu năm')
  await expect(page.locator('.memories-description')).toContainText('Đây là lần gặp chính thức đầu tiên của lớp mình')
  await expectMemory(page, 0)
  await expectMemoryPhotos(page, 0)
  await carousel.focus()
  await page.keyboard.press('ArrowLeft')
  await expectMemory(page, 14)
  await expect(page.locator('.memories-caption h2')).toHaveText('Lẩu Phann')
  await expectMemoryPhotos(page, 14)
  await page.keyboard.press('Home')
  await expectMemory(page, 0)
  await page.keyboard.press('ArrowRight')
  await expectMemory(page, 1)
  await expect(page.locator('.memories-caption h2')).toHaveText('First 20/10')
  await page.keyboard.press('End')
  await expectMemory(page, 14)
  await page.getByRole('button', { name: /Xem kỷ niệm trước/ }).click()
  await expectMemory(page, 13)
  await page.getByRole('button', { name: /Xem kỷ niệm 1:/ }).click()
  await expectMemory(page, 0)
  await expectFitsViewport(page)
})

for (const width of [320, 390, 1440]) {
  test(`slightly overlaps both uploaded photos and shows unclipped event copy at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 })
    await page.goto('/#/our-memories')
    await expectMemory(page, 0)
    await expectMemoryPhotos(page, 0)
    await expect(page.locator('.memories-slide')).toHaveCSS('opacity', '1')
    const [first, second] = await page.locator('.memories-paper').all()
    const firstBox = (await first.boundingBox())!
    const secondBox = (await second.boundingBox())!
    const intersectionWidth = Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) - Math.max(firstBox.x, secondBox.x)
    const intersectionHeight = Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) - Math.max(firstBox.y, secondBox.y)
    expect(intersectionWidth, 'The two photo papers should slightly overlap').toBeGreaterThan(0)
    expect(intersectionHeight).toBeGreaterThan(0)
    const overlapRatio = intersectionWidth * intersectionHeight / Math.min(firstBox.width * firstBox.height, secondBox.width * secondBox.height)
    expect(overlapRatio, 'Both photos should remain mostly visible').toBeLessThan(0.6)
    await expectCaptionUnclipped(page)
    await expectFitsViewport(page)
    await page.screenshot({ path: testInfo.outputPath(`memories-${width}px.png`), fullPage: true })
    const longestTitle = memories.reduce((longest, memory, index) => memory.title.length > memories[longest].title.length ? index : longest, 0)
    const longestDescription = memories.reduce((longest, memory, index) => memory.description.length > memories[longest].description.length ? index : longest, 0)
    for (const index of new Set([longestTitle, longestDescription])) {
      await page.locator('.memories-dots button').nth(index).click()
      await expectMemory(page, index)
      await expectCaptionUnclipped(page)
      await expectFitsViewport(page)
    }
  })
}

test('loads every uploaded event photo and preserves events whose images or descriptions are missing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/our-memories')
  expect(memories.flatMap(memory => memory.images).filter(image => !image.isPlaceholder)).toHaveLength(28)
  for (const [index] of memories.entries()) {
    await page.locator('.memories-dots button').nth(index).click()
    await expectMemory(page, index)
    await expectMemoryPhotos(page, index)
    await expectFitsViewport(page)
  }
  await expect(page.locator('.memories-photo-unavailable')).toHaveCount(2)
  await expect(page.locator('.memories-caption h2')).toHaveText('Lẩu Phann')
})

test('keeps the other photo and complete event caption when an uploaded photo fails to load', async ({ page }) => {
  await page.route(`**${memories[0].images[0].src}`, route => route.abort('failed'))
  await page.goto('/#/our-memories')
  await expectMemory(page, 0)
  await expect(page.locator('.memories-paper')).toHaveCount(2)
  await expect(page.locator('.memories-photo-unavailable')).toHaveCount(1)
  const remainingPhoto = page.locator('.memories-image-frame img')
  await expect(remainingPhoto).toHaveCount(1)
  await expect(remainingPhoto).toHaveAttribute('src', memories[0].images[1].src)
  await expect.poll(() => remainingPhoto.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.getByRole('button', { name: /Xem kỷ niệm tiếp theo/ }).click()
  await expectMemory(page, 1)
  await expectMemoryPhotos(page, 1)
})

test('validates letter limits, counts Unicode characters and expands the paper on a phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let submissions = 0
  await page.route('**/api/letters', route => { submissions += 1; return route.fulfill({ status: 503, json: {} }) })
  await page.goto('/#/letters-to-boys')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Letters To Our DM66D Boys')
  await submitButton(page).click()
  await expect(messageInput(page)).toBeFocused()
  await expect(messageInput(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#letter-message-error')).toContainText('ít nhất 5 ký tự')
  await messageInput(page).fill('💗🌷abc')
  await expect(page.locator('#letter-count')).toHaveText('5 / 2.000 ký tự')
  const initialHeight = await messageInput(page).evaluate(element => element.getBoundingClientRect().height)
  await messageInput(page).fill('Một lời nhắn rất dài gửi tới cả lớp.\n'.repeat(30))
  expect(await messageInput(page).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(initialHeight + 100)
  await senderInput(page).fill('a'.repeat(101))
  await submitButton(page).click()
  await expect(senderInput(page)).toBeFocused()
  await expect(page.locator('#letter-name-error')).toContainText('tối đa 100 ký tự')
  await senderInput(page).fill('')
  await messageInput(page).fill('💗'.repeat(2001))
  await expect(page.locator('#letter-count')).toHaveText('2.001 / 2.000 ký tự')
  await submitButton(page).click()
  await expect(page.locator('#letter-message-error')).toContainText('2.000 ký tự')
  expect(submissions).toBe(0)
  await messageInput(page).fill('Cảm ơn các bạn nam vì món quà rất đáng yêu! 💗')
  await expectFitsViewport(page)
  await page.screenshot({ path: testInfo.outputPath('letters-phone.png'), fullPage: true })
})

test('waits for confirmed server save and prevents duplicate clicks during submission', async ({ page }) => {
  let release: (() => void) | undefined
  const pendingResponse = new Promise<void>(resolve => { release = resolve })
  const received: Submission[] = []
  await page.route('**/api/letters', async route => {
    const body = route.request().postDataJSON() as Submission
    received.push(body)
    await pendingResponse
    await route.fulfill({ status: 201, json: { letter: { ...testLetters[0], senderName: body.senderName, message: body.message } } })
  })
  await page.goto('/#/letters-to-boys')
  await senderInput(page).fill('Người gửi thử')
  await messageInput(page).fill(testLetters[0].message)
  await submitButton(page).click()
  const sending = page.getByRole('button', { name: /Đang gửi lời nhắn/ })
  await expect(sending).toBeDisabled()
  await expect(senderInput(page)).toBeDisabled()
  await expect(messageInput(page)).toBeDisabled()
  await expect(successTitle(page)).toHaveCount(0)
  await expect.poll(() => received.length).toBe(1)
  expect(received[0]).toMatchObject({ senderName: 'Người gửi thử', message: testLetters[0].message, website: '' })
  expect(received[0].submissionId).toMatch(/^[0-9a-f-]{36}$/)
  release!()
  await expect(successTitle(page)).toBeVisible()
  await expect(successTitle(page)).toBeFocused()
  await expect(messageInput(page)).toHaveCount(0)
  expect(received).toHaveLength(1)
  await page.getByRole('button', { name: /Viết thêm một lời nhắn/ }).click()
  await expect(messageInput(page)).toHaveValue('')
  await expect(messageInput(page)).toBeFocused()
  await expect(senderInput(page)).toHaveValue('Người gửi thử')
  await page.getByRole('checkbox', { name: 'Gửi ẩn danh' }).check()
  await expect(senderInput(page)).toBeDisabled()
  await messageInput(page).fill(testLetters[1].message)
  await submitButton(page).click()
  await expect(successTitle(page)).toBeVisible()
  expect(received).toHaveLength(2)
  expect(received[1].senderName).toBe('Một cô gái DM66D')
  expect(received[1].submissionId).not.toBe(received[0].submissionId)
  await page.getByRole('button', { name: /Quay về trang đầu/ }).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gửi cậu')
})

test('retains a failed letter, retries the same submission ID and never fakes a save acknowledgment', async ({ page }) => {
  const received: Submission[] = []
  await page.route('**/api/letters', route => {
    const body = route.request().postDataJSON() as Submission
    received.push(body)
    if (received.length === 1) return route.fulfill({ status: 503, json: { error: 'unconfigured' } })
    if (received.length === 2) return route.fulfill({ status: 200, json: { id: 'not-saved', status: 'pending' } })
    return route.fulfill({ status: 201, json: { letter: { ...testLetters[0], senderName: body.senderName, message: body.message } } })
  })
  await page.goto('/#/letters-to-boys')
  await messageInput(page).fill('  Lời nhắn phải được giữ sau lỗi. 💗  ')
  await submitButton(page).click()
  await expect(page.getByRole('alert')).toContainText('chưa kết nối')
  await expect(messageInput(page)).toHaveValue('  Lời nhắn phải được giữ sau lỗi. 💗  ')
  await expect(successTitle(page)).toHaveCount(0)
  await submitButton(page).click()
  await expect(page.getByRole('alert')).toContainText('chưa xác nhận đã lưu')
  await expect(successTitle(page)).toHaveCount(0)
  await submitButton(page).click()
  await expect(successTitle(page)).toBeVisible()
  expect(received).toHaveLength(3)
  expect(new Set(received.map(body => body.submissionId)).size).toBe(1)
  expect(received[0].message).toBe('Lời nhắn phải được giữ sau lỗi. 💗')
  expect(received[0].senderName).toBe('Một cô gái DM66D')
})

test('displays rate limits and network errors without clearing the unsent letter', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/letters', route => {
    attempts += 1
    return attempts === 1 ? route.fulfill({ status: 429, json: {} }) : route.abort('failed')
  })
  await page.goto('/#/letters-to-boys')
  await senderInput(page).fill('Một bạn nữ')
  await messageInput(page).fill('Nội dung không được mất khi gửi lỗi.')
  await submitButton(page).click()
  await expect(page.getByRole('alert')).toContainText('gửi nhiều lần liên tiếp')
  await submitButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được với máy chủ')
  await expect(senderInput(page)).toHaveValue('Một bạn nữ')
  await expect(messageInput(page)).toHaveValue('Nội dung không được mất khi gửi lỗi.')
  await expect(successTitle(page)).toHaveCount(0)
})

test('keeps private letters hidden until login and downloads every row as CSV and JSON', async ({ page }) => {
  await mockAdminSession(page, false)
  let signedIn = false
  let listCalls = 0
  let loginCalls = 0
  const listOrders: string[] = []
  await page.route('**/api/admin/login', route => {
    loginCalls += 1
    expect(route.request().postDataJSON()).toEqual({ email: 'admin@example.test', password: loginCalls === 1 ? 'wrong-test-password' : 'correct-test-password' })
    if (loginCalls === 1) return route.fulfill({ status: 401, json: {} })
    signedIn = true
    return route.fulfill({ json: { authenticated: true, email: 'admin@example.test' } })
  })
  await page.route('**/api/admin/letters?*', route => {
    expect(signedIn).toBe(true)
    listCalls += 1
    const order = new URL(route.request().url()).searchParams.get('order')!
    listOrders.push(order)
    return route.fulfill({ json: { letters: order === 'oldest' ? testLetters : [...testLetters].reverse(), total: 2 } })
  })
  await page.route('**/api/admin/export?*', route => {
    expect(signedIn).toBe(true)
    const format = new URL(route.request().url()).searchParams.get('format')
    if (format === 'json') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(testLetters) })
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
    const csv = '\uFEFFid,senderName,message,createdAt,status\r\n' + testLetters.map(letter => [letter.id, letter.senderName, letter.message, letter.createdAt, letter.status].map(quote).join(',')).join('\r\n')
    return route.fulfill({ contentType: 'text/csv;charset=utf-8', body: csv })
  })
  await page.route('**/api/admin/logout', route => {
    signedIn = false
    return route.fulfill({ json: { success: true } })
  })
  await page.goto('/#/admin')
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  await expect(page.locator('.admin-letter')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Tải CSV/ })).toHaveCount(0)
  expect(listCalls).toBe(0)
  await page.getByLabel('Email quản trị').fill('admin@example.test')
  await page.getByLabel('Mật khẩu', { exact: true }).fill('wrong-test-password')
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await expect(page.getByRole('alert')).toContainText('đăng nhập')
  expect(listCalls).toBe(0)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('correct-test-password')
  await page.getByRole('button', { name: /^Đăng nhập/ }).click()
  await expect(page.locator('.admin-letter')).toHaveCount(2)
  await expect(page.locator('.admin-inbox-total strong')).toHaveText('2')
  await expect(page.locator('.admin-letter h2').first()).toHaveText('Bạn thứ hai')
  await expect(page.locator('.admin-letter time').first()).toContainText('09:30')
  await expect(page.locator('.admin-letter p').first()).toHaveCSS('white-space', 'pre-wrap')
  await page.getByLabel('Sắp xếp').selectOption('oldest')
  await expect(page.locator('.admin-letter h2').first()).toHaveText('Một cô gái DM66D')
  expect(listOrders).toEqual(['newest', 'oldest'])
  for (const format of ['csv', 'json'] as const) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: new RegExp(`Tải ${format.toUpperCase()}`) }).click(),
    ])
    expect(download.suggestedFilename()).toBe(`DM66_Loi_Nhan_20_10.${format}`)
    const text = await readFile((await download.path())!, 'utf8')
    if (format === 'json') expect(JSON.parse(text)).toEqual(testLetters)
    else {
      expect(text.charCodeAt(0)).toBe(0xfeff)
      for (const letter of testLetters) expect(text).toContain(letter.message)
      expect(text).toContain('id,senderName,message,createdAt,status')
    }
    await expect(page.getByRole('status')).toContainText(format.toUpperCase())
  }
  await page.getByRole('button', { name: /Đăng xuất/ }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  await expect(page.locator('.admin-letter')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Tải JSON/ })).toHaveCount(0)
  expect(signedIn).toBe(false)
})

test('reloads server-provided inbox data and clears it when the admin session expires', async ({ page }) => {
  await mockAdminSession(page)
  let listCalls = 0
  await page.route('**/api/admin/letters?*', route => {
    listCalls += 1
    return route.fulfill({ json: { letters: testLetters, total: 2 } })
  })
  await page.route('**/api/admin/export?*', route => route.fulfill({ status: 401, json: { error: 'expired' } }))
  await page.goto('/#/admin')
  await expect(page.locator('.admin-letter')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('.admin-letter')).toHaveCount(2)
  expect(listCalls).toBe(2)
  await page.getByRole('button', { name: /Tải CSV/ }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Phiên quản trị đã hết hạn')
  await expect(page.locator('.admin-letter')).toHaveCount(0)
  await expect(page.getByLabel('Email quản trị')).toBeFocused()
})

test('renders user input as text and fits a long private inbox on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockAdminSession(page)
  const dangerous = '<img src=x onerror="window.letterScriptRan=true">'
  await page.route('**/api/admin/letters?*', route => route.fulfill({ json: { letters: [{ ...testLetters[0], senderName: dangerous, message: `<script>window.letterScriptRan=true</script>\n${'x'.repeat(2000)}` }], total: 1 } }))
  await page.goto('/#/admin')
  await expect(page.locator('.admin-letter h2')).toHaveText(dangerous)
  await expect(page.locator('.admin-letter img,.admin-letter script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { letterScriptRan?: boolean }).letterScriptRan)).toBeUndefined()
  await expectFitsViewport(page)
  await page.screenshot({ path: testInfo.outputPath('admin-phone.png'), fullPage: true })
})
