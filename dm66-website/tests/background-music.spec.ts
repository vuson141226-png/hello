import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  },
})

type AudioMode = 'reject' | 'play' | 'defer'
type AudioProbe = {
  mode: AudioMode
  plays: number
  pauses: number
  pending: number
  startPending(): void
  finishPending(): void
  releaseVideo?: () => void
}

type ProbeWindow = Window & { audioProbe: AudioProbe }

/** Control the native element's asynchronous play contract without outside media. */
async function instrumentAudio(page: Page, initialMode: AudioMode) {
  await page.route('**/audio/in-love-instrumental.mp3', route => route.fulfill({ status: 204, body: '' }))
  await page.addInitScript(mode => {
    const audioStates = new WeakMap<HTMLMediaElement, boolean>()
    const requests: { audio: HTMLMediaElement; resolve: () => void }[] = []
    const isMusic = (audio: HTMLMediaElement) => audio instanceof HTMLAudioElement && audio.classList.contains('background-music-audio')
    const markPlaying = (audio: HTMLMediaElement) => {
      audioStates.set(audio, false)
      audio.dispatchEvent(new Event('playing'))
    }
    const probe = {
      mode,
      plays: 0,
      pauses: 0,
      get pending() { return requests.length },
      startPending() { if (requests.at(-1)) markPlaying(requests.at(-1)!.audio) },
      finishPending() {
        for (const request of requests.splice(0)) {
          markPlaying(request.audio)
          request.resolve()
        }
      },
    }
    const originalPlay = HTMLMediaElement.prototype.play
    const originalPause = HTMLMediaElement.prototype.pause
    const paused = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused')!
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get() { return isMusic(this) ? (audioStates.get(this) ?? true) : paused.get!.call(this) },
    })
    HTMLMediaElement.prototype.play = function () {
      if (!isMusic(this)) return originalPlay.call(this)
      probe.plays += 1
      if (probe.mode === 'reject') return Promise.reject(new DOMException('Autoplay needs a user gesture', 'NotAllowedError'))
      if (probe.mode === 'defer') return new Promise<void>(resolve => requests.push({ audio: this, resolve }))
      markPlaying(this)
      return Promise.resolve()
    }
    HTMLMediaElement.prototype.pause = function () {
      if (!isMusic(this)) return originalPause.call(this)
      probe.pauses += 1
      audioStates.set(this, true)
      this.dispatchEvent(new Event('pause'))
    }
    // The 204 fixture cannot decode. Ignore only real media events; our explicit
    // callbacks above let each test exercise one native event/promise ordering.
    for (const event of ['error', 'pause', 'playing', 'ended']) {
      document.addEventListener(event, event => {
        if (event.isTrusted && event.target instanceof HTMLMediaElement && isMusic(event.target)) event.stopImmediatePropagation()
      }, true)
    }
    Object.assign(window, { audioProbe: probe })
  }, initialMode)
}

async function videoActivity(page: Page, active: boolean) {
  await page.evaluate(async active => {
    const probe = (window as ProbeWindow).audioProbe
    if (active) {
      const modulePath = '/src/lib/mediaActivity.ts'
      const { beginVideoPlayback } = await import(/* @vite-ignore */ modulePath)
      probe.releaseVideo = beginVideoPlayback()
    } else {
      probe.releaseVideo?.()
      probe.releaseVideo = undefined
    }
  }, active)
}

async function playCount(page: Page) {
  return page.evaluate(() => (window as ProbeWindow).audioProbe.plays)
}

async function expectSimpleMusic(page: Page) {
  const audio = page.locator('audio.background-music-audio')
  await expect(audio).toHaveCount(1)
  await expect(audio).toHaveAttribute('src', '/audio/in-love-instrumental.mp3')
  await expect(audio).toHaveAttribute('loop', '')
  await expect(audio).toHaveAttribute('autoplay', '')
  await expect(audio).toHaveAttribute('preload', 'auto')
  await expect(page.locator('.music-toggle')).toHaveText('Một chút nhạc')
  await expect(page.locator('.music-widget iframe, .music-popover, .background-music-panel, .music-widget a')).toHaveCount(0)
}

test.describe('real local MP3 playback', () => {
  test('decodes and autoplays the provided MP3, preserves playback across routes, loops and toggles', async ({ page }) => {
    const outsideRequests: string[] = []
    page.on('request', request => {
      if (/youtube|youtu\.be/.test(request.url())) outsideRequests.push(request.url())
    })
    await page.goto('/#/')
    await expectSimpleMusic(page)
    const audio = page.locator('audio.background-music-audio')
    await expect.poll(() => audio.evaluate(element => {
      const track = element as HTMLAudioElement
      return Number.isFinite(track.duration) && track.duration > 1 && track.readyState >= 2 && track.currentTime > 0.1 && !track.paused && !track.muted && track.error === null
    })).toBe(true)
    await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const original = await audio.elementHandle()
    const before = await audio.evaluate(element => (element as HTMLAudioElement).currentTime)
    for (const route of ['our-memories', 'your-wish', 'letters-to-boys', 'photobooth', '']) {
      await page.evaluate(route => { window.location.hash = `#/${route}` }, route)
      await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', `#/${route}`)
      expect(await audio.evaluate((element, original) => element === original, original)).toBe(true)
      await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'true')
    }
    expect(await audio.evaluate(element => (element as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(before)
    await audio.evaluate(element => { const track = element as HTMLAudioElement; track.currentTime = track.duration - 0.15 })
    await expect.poll(() => audio.evaluate(element => {
      const track = element as HTMLAudioElement
      return track.currentTime < 2 && !track.paused
    })).toBe(true)
    await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
    await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).paused)).toBe(true)
    await expect(page.getByRole('button', { name: 'Bật nhạc', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('Shift')
    expect(await audio.evaluate(element => (element as HTMLAudioElement).paused)).toBe(true)
    await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
    await expect.poll(() => audio.evaluate(element => !(element as HTMLAudioElement).paused)).toBe(true)
    expect(outsideRequests).toEqual([])
  })
})

for (const gesture of ['pointer', 'keyboard'] as const) {
  test(`retries blocked autoplay on the first trusted ${gesture} interaction`, async ({ page }) => {
    await instrumentAudio(page, 'reject')
    await page.goto('/#/')
    await expectSimpleMusic(page)
    await expect.poll(() => playCount(page)).toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: 'Bật nhạc', exact: true })).toHaveAttribute('aria-pressed', 'false')
    const rejected = await playCount(page)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
      window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(await playCount(page)).toBe(rejected)
    await page.evaluate(() => { (window as ProbeWindow).audioProbe.mode = 'play' })
    if (gesture === 'pointer') await page.getByRole('heading', { level: 1 }).click()
    else await page.keyboard.press('Shift')
    await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await playCount(page)).toBeGreaterThan(rejected)
    await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
    const stopped = await playCount(page)
    await page.getByRole('heading', { level: 1 }).click()
    await page.keyboard.press('Shift')
    await videoActivity(page, true)
    await videoActivity(page, false)
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'))
      window.dispatchEvent(new PageTransitionEvent('pageshow'))
    })
    expect(await playCount(page)).toBe(stopped)
    await expect(page.getByRole('button', { name: 'Bật nhạc', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })
}

test('the blocked music button retries playback instead of turning its intent off', async ({ page }) => {
  await instrumentAudio(page, 'reject')
  await page.goto('/#/')
  await expect.poll(() => playCount(page)).toBeGreaterThan(0)
  const rejected = await playCount(page)
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  expect(await playCount(page)).toBeGreaterThan(rejected)
  await page.evaluate(() => { (window as ProbeWindow).audioProbe.mode = 'play' })
  await page.keyboard.press('Shift')
  await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('the real Boy Day viewer pauses native music and resumes the same element after closing', async ({ page }) => {
  await instrumentAudio(page, 'play')
  await page.route('https://drive.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Drive viewer fixture</title>' }))
  await page.route('https://drive.usercontent.google.com/**', route => route.abort('blockedbyclient'))
  await page.goto('/#/our-memories')
  await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const audio = await page.locator('audio.background-music-audio').elementHandle()
  const playing = await playCount(page)
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  await page.getByRole('button', { name: 'Xem video kỷ niệm Boy Day 2026', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Video kỷ niệm Boy Day 2026' })).toBeVisible()
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.locator('audio.background-music-audio').evaluate(element => (element as HTMLAudioElement).paused)).toBe(true)
  await page.getByRole('button', { name: 'Đóng video kỷ niệm', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await playCount(page)).toBeGreaterThan(playing)
  expect(await page.locator('audio.background-music-audio').evaluate((element, original) => element === original, audio)).toBe(true)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'false')
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')))
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'true')
})

test('late play promises and playing events cannot overlap a video or override an explicit stop', async ({ page }) => {
  await instrumentAudio(page, 'defer')
  await page.goto('/#/')
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).audioProbe.pending)).toBeGreaterThan(0)
  await videoActivity(page, true)
  await page.evaluate(() => (window as ProbeWindow).audioProbe.finishPending())
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.locator('audio.background-music-audio').evaluate(element => (element as HTMLAudioElement).paused)).toBe(true)
  const blocked = await playCount(page)
  await videoActivity(page, false)
  await expect.poll(() => playCount(page)).toBeGreaterThan(blocked)
  // Playback can begin before its promise settles. Stop it in that interval,
  // then deliver a stale playing callback and promise resolution afterwards.
  await page.evaluate(() => (window as ProbeWindow).audioProbe.startPending())
  await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
  const stopped = await playCount(page)
  await page.evaluate(() => (window as ProbeWindow).audioProbe.finishPending())
  await videoActivity(page, true)
  await videoActivity(page, false)
  await expect(page.locator('.music-toggle')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.locator('audio.background-music-audio').evaluate(element => (element as HTMLAudioElement).paused)).toBe(true)
  expect(await playCount(page)).toBe(stopped)
})
