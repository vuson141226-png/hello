import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type CameraProbe = {
  calls: number
  stops: number
  rejectNext: boolean
  deferNext: boolean
  resolvePending?: () => void
  canvas?: HTMLCanvasElement
  track?: CanvasCaptureMediaStreamTrack
  videoCaptures: number
  paintedText: string[]
}

type ProbeWindow = Window & { photoboothProbe: CameraProbe }

async function mockCamera(page: Page, mode: 'ready' | 'denied' | 'pending' = 'ready') {
  await page.addInitScript(initialMode => {
    const state = { calls: 0, stops: 0, videoCaptures: 0, rejectNext: initialMode === 'denied', deferNext: initialMode === 'pending', paintedText: [] as string[] } as CameraProbe
    ;(window as ProbeWindow).photoboothProbe = state
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      state.paintedText.push(text)
      if (maxWidth === undefined) return fillText.call(this, text, x, y)
      return fillText.call(this, text, x, y, maxWidth)
    }
    const drawImage = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (...args: Parameters<CanvasRenderingContext2D['drawImage']>) {
      if (args[0] instanceof HTMLVideoElement) state.videoCaptures += 1
      return drawImage.apply(this, args)
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        state.calls += 1
        if (state.rejectNext) {
          state.rejectNext = false
          throw new DOMException('Camera permission denied in test', 'NotAllowedError')
        }
        if (state.deferNext) {
          state.deferNext = false
          await new Promise<void>(resolve => { state.resolvePending = resolve })
        }
        const canvas = document.createElement('canvas')
        canvas.width = 960
        canvas.height = 720
        const context = canvas.getContext('2d')!
        context.fillStyle = '#e02030'
        context.fillRect(0, 0, canvas.width, canvas.height)
        const stream = canvas.captureStream(30)
        const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
        const stop = track.stop.bind(track)
        track.stop = () => { state.stops += 1; stop() }
        state.canvas = canvas
        state.track = track
        return stream
      },
    })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
  }, mode)
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const { calls, stops, paintedText, track, videoCaptures } = (window as ProbeWindow).photoboothProbe
    return { calls, stops, paintedText, videoCaptures, trackState: track?.readyState }
  })
}

async function cameraReady(page: Page) {
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click()
  await expect.poll(() => page.getByTestId('photobooth-camera').evaluate(element => {
    const video = element as HTMLVideoElement
    return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
  })).toBe(true)
  await expect(page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true })).toBeEnabled()
}

async function uploadPhotos(page: Page) {
  const photos = await page.evaluate(() => ['#e02030', '#20b050', '#2040d0'].map((color, index) => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const context = canvas.getContext('2d')!
    context.fillStyle = color
    context.fillRect(0, 0, canvas.width, canvas.height)
    return { name: `pose-${index + 1}.png`, data: canvas.toDataURL('image/png').split(',')[1] }
  }))
  await page.getByLabel('Chọn 3 ảnh có sẵn', { exact: true }).setInputFiles(photos.map(photo => ({ name: photo.name, mimeType: 'image/png', buffer: Buffer.from(photo.data, 'base64') })))
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeEnabled()
}

async function readPng(page: Page, png: Buffer) {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return page.evaluate(async base64 => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const bands: number[][] = []
    for (let y = 0; y < canvas.height; y += 8) {
      const pixel = Array.from(context.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data)
      bands.push([y, ...pixel])
    }
    return { width: canvas.width, height: canvas.height, bands }
  }, png.toString('base64'))
}

async function downloadPng(page: Page) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.png$/i)
  expect(await download.failure()).toBeNull()
  const path = await download.path()
  expect(path).not.toBeNull()
  return readFile(path!)
}

function colorBands(png: Awaited<ReturnType<typeof readPng>>, color: number[]) {
  return png.bands.filter(pixel => color.every((channel, index) => Math.abs(pixel[index + 1] - channel) < 10)).map(pixel => pixel[0])
}

test('asks for camera only on a tap, captures three real video frames and downloads a decorated PNG', async ({ page }) => {
  await mockCamera(page)
  await page.goto('/#/photobooth')
  await expect(page.getByRole('heading', { level: 1, name: 'Photobooth của chúng mình' })).toBeVisible()
  expect((await probe(page)).calls).toBe(0)
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeDisabled()
  await cameraReady(page)
  await page.clock.install()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await expect(page.getByTestId('photobooth-countdown')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hủy lượt chụp', exact: true })).toBeVisible()
  const capture = page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true })
  if (await capture.count()) await expect(capture).toBeDisabled()
  await page.clock.runFor(10_000)
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Chụp lại', exact: true })).toBeVisible()
  const png = await readPng(page, await downloadPng(page))
  expect(png.width).toBe(1080)
  expect(png.height).toBe(1920)
  const red = colorBands(png, [224, 32, 48])
  expect(red.length).toBeGreaterThan(120)
  expect(red.filter((y, index) => index === 0 || y - red[index - 1] > 8)).toHaveLength(3)
  const paintedText = (await probe(page)).paintedText
  expect(paintedText).toContain('Digimar 66D')
  expect(paintedText).not.toContain('giữ lại những khoảnh khắc đáng yêu')
  expect((await probe(page)).calls).toBe(1)
  expect((await probe(page)).videoCaptures).toBe(3)
  await page.getByRole('button', { name: 'Tắt camera', exact: true }).click()
  expect((await probe(page)).trackState).toBe('ended')
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeEnabled()
})

test('retries denied camera access and stops a camera request that resolves after leaving the page', async ({ page }) => {
  await mockCamera(page, 'denied')
  await page.goto('/#/photobooth')
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await cameraReady(page)
  expect((await probe(page)).calls).toBe(2)
  await page.locator('nav a[href="#/our-memories"]').click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  expect((await probe(page)).trackState).toBe('ended')
  await page.locator('nav a[href="#/photobooth"]').click()
  await page.evaluate(() => { (window as ProbeWindow).photoboothProbe.deferNext = true })
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tắt camera', exact: true })).toBeVisible()
  await page.locator('nav a[href="#/our-memories"]').click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  await page.evaluate(() => { (window as ProbeWindow).photoboothProbe.resolvePending!() })
  await expect.poll(async () => (await probe(page)).stops).toBe(2)
  expect((await probe(page)).trackState).toBe('ended')
})

test('cancels a countdown and stops camera resources when the page is hidden', async ({ page }) => {
  await mockCamera(page)
  await page.goto('/#/photobooth')
  await cameraReady(page)
  await page.clock.install()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await page.clock.runFor(3500)
  expect((await probe(page)).videoCaptures).toBe(1)
  await page.getByRole('button', { name: 'Hủy lượt chụp', exact: true }).click()
  await page.clock.runFor(10_000)
  expect((await probe(page)).videoCaptures).toBe(1)
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true })).toBeEnabled()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  expect((await probe(page)).trackState).toBe('ended')
  await expect(page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Bật camera', exact: true })).toBeVisible()
})

test('preserves the order of three uploaded photos in the saved strip without opening the camera', async ({ page }) => {
  await mockCamera(page)
  await page.goto('/#/photobooth')
  await page.getByLabel('Chọn 3 ảnh có sẵn', { exact: true }).setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeDisabled()
  await uploadPhotos(page)
  const png = await readPng(page, await downloadPng(page))
  expect(png.width).toBe(1080)
  expect(png.height).toBe(1920)
  const red = colorBands(png, [224, 32, 48])
  const green = colorBands(png, [32, 176, 80])
  const blue = colorBands(png, [32, 64, 208])
  for (const band of [red, green, blue]) expect(band.length).toBeGreaterThan(50)
  expect(Math.max(...red)).toBeLessThan(Math.min(...green))
  expect(Math.max(...green)).toBeLessThan(Math.min(...blue))
  expect((await probe(page)).calls).toBe(0)
})

test('passes a prepared PNG to the native picker during the save click', async ({ page }) => {
  await mockCamera(page)
  await page.addInitScript(() => {
    const state = { inClick: false, invokedInClick: false, calls: 0, fileName: '', fileType: '', bytes: 0, closed: false }
    Object.assign(window, { photoboothSaveProbe: state })
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
      return removeListener.call(this, type, type === 'click' && listener && !capture ? wrappedListeners.get(listener) || listener : listener, options)
    }
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: () => {
      state.calls += 1
      state.invokedInClick = state.inClick
      return Promise.resolve({ createWritable: async () => ({
        write: async (file: File) => { state.fileName = file.name; state.fileType = file.type; state.bytes = file.size },
        close: async () => { state.closed = true },
      }) })
    } })
  })
  await page.goto('/#/photobooth')
  await uploadPhotos(page)
  await page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { photoboothSaveProbe: { closed: boolean } }).photoboothSaveProbe.closed)).toBe(true)
  const saved = await page.evaluate(() => (window as unknown as { photoboothSaveProbe: { calls: number; invokedInClick: boolean; fileName: string; fileType: string; bytes: number } }).photoboothSaveProbe)
  expect(saved.calls).toBe(1)
  expect(saved.invokedInClick).toBe(true)
  expect(saved.fileName).toMatch(/\.png$/i)
  expect(saved.fileType).toBe('image/png')
  expect(saved.bytes).toBeGreaterThan(10_000)
})

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test(`fits the whole saved PNG and download fallback on a ${viewport.width}px phone without file sharing`, async ({ page }) => {
    await mockCamera(page)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' })
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    })
    await page.setViewportSize(viewport)
    await page.goto('/#/photobooth')
    await uploadPhotos(page)
    await page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const image = dialog.locator('img')
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1080)
    await expect(dialog).toContainText(/giữ|lưu ảnh/i)
    const fit = await image.evaluate(element => {
      const photo = element as HTMLImageElement
      const bounds = photo.getBoundingClientRect()
      const dialogBounds = photo.closest('dialog')!.getBoundingClientRect()
      return {
        top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
        width: bounds.width, height: bounds.height,
        ratio: photo.naturalWidth / photo.naturalHeight, objectFit: getComputedStyle(photo).objectFit,
        dialogTop: dialogBounds.top, dialogBottom: dialogBounds.bottom, viewportHeight: innerHeight,
      }
    })
    expect(fit.ratio).toBeCloseTo(9 / 16, 3)
    expect(fit.objectFit).toBe('contain')
    expect(fit.top).toBeGreaterThanOrEqual(fit.dialogTop)
    expect(fit.bottom).toBeLessThanOrEqual(fit.dialogBottom + 1)
    expect(fit.top).toBeGreaterThanOrEqual(0)
    expect(fit.bottom).toBeLessThanOrEqual(fit.viewportHeight + 1)
    expect(fit.left).toBeGreaterThanOrEqual(0)
    expect(fit.right).toBeLessThanOrEqual(viewport.width + 1)
    expect(fit.width).toBeGreaterThan(100)
    expect(fit.height).toBeGreaterThan(150)
    await expect(dialog.getByRole('button', { name: 'Tải ảnh PNG', exact: true })).toBeInViewport()
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Tải ảnh PNG', exact: true }).click()
    const download = await downloadPromise
    expect(await download.failure()).toBeNull()
    expect(download.suggestedFilename()).toBe('Digimar66D-photobooth.png')
  })
}

for (const width of [320, 390, 1440]) {
  test(`keeps the three-photo frame and controls usable at ${width}px`, async ({ page }, testInfo) => {
    await mockCamera(page)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/photobooth')
    await expect(page.locator('nav a[href="#/photobooth"]')).toContainText('05')
    await uploadPhotos(page)
    const preview = page.locator('.photobooth-preview-image')
    await expect(preview).toBeVisible()
    await expect.poll(() => preview.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1080)
    const bounds = await preview.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(-1)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    const dimensions = await preview.evaluate(element => {
      const image = element as HTMLImageElement
      return { width: image.naturalWidth, height: image.naturalHeight, objectFit: getComputedStyle(image).objectFit }
    })
    expect(dimensions).toEqual({ width: 1080, height: 1920, objectFit: 'contain' })
    expect(bounds!.height).toBeLessThan(900 - 100)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`photobooth-${width}.png`), fullPage: true })
  })
}
