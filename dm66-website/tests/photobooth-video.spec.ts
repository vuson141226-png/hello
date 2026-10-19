import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type RecordingProbe = {
  cameraTrack?: MediaStreamTrack
  recordings: { recorder: MediaRecorder; tracks: MediaStreamTrack[]; bytes: number }[]
  native: { inClick: boolean; invokedInClick: boolean; calls: number; name: string; type: string; bytes: number; closed: boolean }
}
type RecordingWindow = Window & { photoboothRecordingProbe: RecordingProbe }

async function mockRealCamera(page: Page, supported = true) {
  await page.addInitScript(recordingSupported => {
    const probe: RecordingProbe = {
      recordings: [],
      native: { inClick: false, invokedInClick: false, calls: 0, name: '', type: '', bytes: 0, closed: false },
    }
    ;(window as RecordingWindow).photoboothRecordingProbe = probe
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      // Real MediaStream and MediaRecorder, with a repeatable camera instead of physical hardware.
      const canvas = document.createElement('canvas')
      canvas.width = 960
      canvas.height = 720
      const context = canvas.getContext('2d')!
      context.fillStyle = '#e02030'
      context.fillRect(0, 0, canvas.width, canvas.height)
      const stream = canvas.captureStream(30)
      probe.cameraTrack = stream.getVideoTracks()[0]
      return stream
    } })
    if (recordingSupported) {
      const NativeRecorder = window.MediaRecorder
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: new Proxy(NativeRecorder, {
        construct(target, args) {
          const recorder = Reflect.construct(target, args) as MediaRecorder
          const entry = { recorder, tracks: recorder.stream.getTracks(), bytes: 0 }
          recorder.addEventListener('dataavailable', event => { entry.bytes += event.data.size })
          probe.recordings.push(entry)
          return recorder
        },
      }) })
    } else Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: undefined })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined })
    // Detect a prepared File being passed synchronously during the React click handler.
    const addListener = EventTarget.prototype.addEventListener
    const removeListener = EventTarget.prototype.removeEventListener
    const wrappedListeners = new WeakMap<EventListenerOrEventListenerObject, EventListener>()
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture
      if (type === 'click' && listener && !capture) {
        const wrapped: EventListener = function (event) {
          probe.native.inClick = true
          queueMicrotask(() => { probe.native.inClick = false })
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
  }, supported)
}

async function readyCamera(page: Page) {
  await page.goto('/#/photobooth')
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true })).toBeEnabled()
}

async function recordingState(page: Page) {
  return page.evaluate(() => {
    const probe = (window as RecordingWindow).photoboothRecordingProbe
    return {
      camera: probe.cameraTrack?.readyState,
      recordings: probe.recordings.map(entry => ({
        state: entry.recorder.state, mime: entry.recorder.mimeType, bytes: entry.bytes,
        tracks: entry.tracks.map(track => track.readyState),
      })),
      native: probe.native,
    }
  })
}

async function decodeVideo(page: Page, data: Buffer, type: string) {
  return page.evaluate(async ({ base64, mime }) => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Video ${event} timed out`)), 5000)
      video.addEventListener(event, () => { clearTimeout(timer); resolve() }, { once: true })
      video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Recorded video cannot decode')) }, { once: true })
    })
    try {
      const loaded = waitFor('loadeddata')
      video.src = url
      await loaded
      const width = video.videoWidth
      const height = video.videoHeight
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!
      const sample = async (time: number) => {
        const seeked = waitFor('seeked')
        video.currentTime = time
        await seeked
        context.drawImage(video, 0, 0)
        // This point lies inside the live camera, away from countdown text and decorations.
        return Array.from(context.getImageData(100, 350, 1, 1).data)
      }
      const baseline = await sample(2)
      const flashes: number[][][] = []
      for (const shutter of [3, 6, 9]) {
        const samples: number[][] = []
        for (const offset of [0.06, 0.12, 0.18, 0.24, 0.32]) samples.push(await sample(shutter + offset))
        flashes.push(samples)
      }
      return { width, height, duration: Number.isFinite(video.duration) ? video.duration : null, baseline, flashes }
    } finally {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
  }, { base64: data.toString('base64'), mime: type })
}

test('records only when selected, encodes all three shutter effects and saves a real playable video', async ({ page }) => {
  test.setTimeout(45_000)
  await mockRealCamera(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await readyCamera(page)
  const choice = page.getByRole('checkbox', { name: 'Ghi video cùng lượt chụp', exact: true })
  await expect(choice).not.toBeChecked()
  expect((await recordingState(page)).recordings).toHaveLength(0)
  await choice.check()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await expect(page.getByTestId('photobooth-video-status')).toBeVisible()
  const save = page.getByRole('button', { name: 'Lưu video', exact: true })
  await expect(save).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeEnabled()
  const state = await recordingState(page)
  expect(state.recordings).toHaveLength(1)
  expect(state.recordings[0].state).toBe('inactive')
  expect(state.recordings[0].tracks).toEqual(['ended'])
  expect(state.recordings[0].bytes).toBeGreaterThan(10_000)
  expect(state.camera).toBe('live')
  const downloadPromise = page.waitForEvent('download')
  await save.click()
  const download = await downloadPromise
  expect(await download.failure()).toBeNull()
  const mime = state.recordings[0].mime
  expect(mime).toMatch(/^video\/(mp4|webm)/)
  expect(download.suggestedFilename()).toMatch(mime.startsWith('video/mp4') ? /\.mp4$/ : /\.webm$/)
  const bytes = await readFile((await download.path())!)
  expect(bytes.length).toBeGreaterThan(10_000)
  const decoded = await decodeVideo(page, bytes, mime)
  expect(decoded.width).toBe(720)
  expect(decoded.height).toBe(1280)
  if (decoded.duration !== null) expect(decoded.duration).toBeGreaterThan(9)
  expect(decoded.baseline[0]).toBeGreaterThan(180)
  expect(decoded.baseline[1]).toBeLessThan(80)
  // A flash must be present in the encoded camera pixels after every shutter,
  // not merely in an HTML overlay that disappears from the saved video.
  for (const flash of decoded.flashes) expect(Math.max(...flash.map(pixel => pixel[1]))).toBeGreaterThan(decoded.baseline[1] + 35)
  await page.getByRole('button', { name: 'Xem video', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Video photobooth của cậu', exact: true })
  await expect(dialog).toBeVisible()
  const preview = page.getByTestId('photobooth-video-preview')
  await expect(preview).toHaveAttribute('controls', '')
  await expect(preview).toHaveAttribute('playsinline', '')
  const bounds = await preview.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.y).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.evaluate(() => {
    const state = (window as RecordingWindow).photoboothRecordingProbe.native
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: () => {
      state.calls += 1
      state.invokedInClick = state.inClick
      return Promise.resolve({ createWritable: async () => ({
        write: async (file: File) => { state.name = file.name; state.type = file.type; state.bytes = file.size },
        close: async () => { state.closed = true },
      }) })
    } })
  })
  await save.click()
  await expect.poll(async () => (await recordingState(page)).native.closed).toBe(true)
  const native = (await recordingState(page)).native
  expect(native.calls).toBe(1)
  expect(native.invokedInClick).toBe(true)
  expect(native.name).toBe(download.suggestedFilename())
  expect(native.type).toMatch(/^video\/(mp4|webm)/)
  expect(native.bytes).toBe(bytes.length)
  await page.getByRole('button', { name: 'Chụp lại', exact: true }).click()
  await expect(save).toHaveCount(0)
})

test('takes a complete photo session without starting a recorder unless selected', async ({ page }) => {
  await mockRealCamera(page)
  await readyCamera(page)
  await expect(page.getByRole('checkbox', { name: 'Ghi video cùng lượt chụp', exact: true })).not.toBeChecked()
  await page.clock.install()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await page.clock.runFor(10_000)
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeEnabled()
  expect((await recordingState(page)).recordings).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Lưu video', exact: true })).toHaveCount(0)
})

test('still produces photos without MediaRecorder support', async ({ page }) => {
  await mockRealCamera(page, false)
  await readyCamera(page)
  const choice = page.getByRole('checkbox', { name: 'Ghi video cùng lượt chụp', exact: true })
  await expect(choice).not.toBeChecked()
  await expect(choice).toBeDisabled()
  await page.clock.install()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await page.clock.runFor(10_000)
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Lưu video', exact: true })).toHaveCount(0)
  expect((await recordingState(page)).recordings).toHaveLength(0)
})

test('discards cancelled video and stops recorder tracks on cancellation and navigation', async ({ page }) => {
  await mockRealCamera(page)
  await readyCamera(page)
  await page.getByRole('checkbox', { name: 'Ghi video cùng lượt chụp', exact: true }).check()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await expect.poll(async () => (await recordingState(page)).recordings[0]?.state).toBe('recording')
  // MP4 may buffer chunks until stop; wait for a photographed pose instead.
  await expect(page.locator('.photobooth-progress')).toHaveAttribute('aria-label', 'Đã có 1 trên 3 ảnh', { timeout: 6000 })
  await page.getByRole('button', { name: 'Hủy lượt chụp', exact: true }).click()
  await expect.poll(async () => (await recordingState(page)).recordings[0]?.state).toBe('inactive')
  expect((await recordingState(page)).recordings[0].tracks).toEqual(['ended'])
  expect((await recordingState(page)).camera).toBe('live')
  await expect(page.getByRole('button', { name: 'Lưu video', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Lưu ảnh vào máy', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Chụp 3 kiểu ảnh', exact: true }).click()
  await expect.poll(async () => (await recordingState(page)).recordings[1]?.state).toBe('recording')
  await page.locator('nav a[href="#/our-memories"]').click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Our Little Memories')
  const stopped = await recordingState(page)
  expect(stopped.camera).toBe('ended')
  for (const recording of stopped.recordings) {
    expect(recording.state).toBe('inactive')
    expect(recording.tracks).toEqual(['ended'])
  }
  await page.locator('nav a[href="#/photobooth"]').click()
  await expect(page.getByRole('button', { name: 'Lưu video', exact: true })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Ghi video cùng lượt chụp', exact: true })).not.toBeChecked()
})
