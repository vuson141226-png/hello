import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// These tests exercise commands and callbacks of the official iframe API contract.
// The fake iframe never contacts YouTube; live track playback needs an allowed network.
type MusicProbe = {
  commands: { action: string; instance: number; value?: number }[]
  instances: number
  options: { videoId: string; playerVars: Record<string, number | string> }[]
  installAPI(): void
  ready(index?: number): void
  state(value: number, index?: number): void
  error(index?: number): void
  autoplayBlocked(): void
  releaseVideo?: () => void
}

async function fakeYouTube(page: Page, options: { autoReady?: boolean; apiAvailable?: boolean } = {}) {
  await page.route('**/__youtube_test_player', route => route.fulfill({ contentType: 'text/html', body: '<title>Fake player</title>' }))
  await page.addInitScript(({ autoReady, apiAvailable }) => {
    type FakeEvents = {
      onReady(event: { target: FakePlayer; data: number }): void
      onStateChange(event: { target: FakePlayer; data: number }): void
      onError(event: { target: FakePlayer; data: number }): void
      onAutoplayBlocked(event: { target: FakePlayer; data: number }): void
    }
    const players: FakePlayer[] = []
    const probe = {
      commands: [] as { action: string; instance: number; value?: number }[],
      instances: 0,
      options: [] as { videoId: string; playerVars: Record<string, number | string> }[],
      installAPI: () => { Object.assign(window, { YT: { Player: FakePlayer } }) },
      ready: (index = players.length - 1) => players[index]?.events.onReady({ target: players[index], data: 0 }),
      state: (value: number, index = players.length - 1) => players[index]?.events.onStateChange({ target: players[index], data: value }),
      error: (index = players.length - 1) => players[index]?.events.onError({ target: players[index], data: 153 }),
      autoplayBlocked: () => players.at(-1)?.events.onAutoplayBlocked({ target: players.at(-1)!, data: 0 }),
    }
    class FakePlayer {
      index: number
      iframe: HTMLIFrameElement
      events: FakeEvents
      constructor(element: HTMLElement, settings: { events: FakeEvents; videoId: string; playerVars: Record<string, number | string> }) {
        this.index = players.length
        this.events = settings.events
        this.iframe = document.createElement('iframe')
        this.iframe.src = '/__youtube_test_player'
        this.iframe.dataset.playerId = String(this.index)
        element.replaceWith(this.iframe)
        players.push(this)
        probe.instances += 1
        probe.options.push({ videoId: settings.videoId, playerVars: settings.playerVars })
        if (autoReady) queueMicrotask(() => probe.ready(this.index))
      }
      playVideo() { probe.commands.push({ action: 'play', instance: this.index }) }
      pauseVideo() { probe.commands.push({ action: 'pause', instance: this.index }) }
      seekTo(value: number) { probe.commands.push({ action: 'seek', instance: this.index, value }) }
      setVolume(value: number) { probe.commands.push({ action: 'volume', instance: this.index, value }) }
      destroy() {
        probe.commands.push({ action: 'destroy', instance: this.index })
        this.iframe.remove()
      }
    }
    Object.assign(window, { musicProbe: probe })
    if (apiAvailable) probe.installAPI()
  }, { autoReady: options.autoReady ?? true, apiAvailable: options.apiAvailable ?? true })
}

async function commandCount(page: Page, action: string) {
  return page.evaluate(action => (window as unknown as { musicProbe: MusicProbe }).musicProbe.commands.filter(command => command.action === action).length, action)
}

async function videoActivity(page: Page, active: boolean) {
  await page.evaluate(async active => {
    const probe = (window as unknown as { musicProbe: MusicProbe }).musicProbe
    if (active) {
      // Use the same shared subscription as the real memory modal.
      const modulePath = '/src/lib/mediaActivity.ts'
      const { beginVideoPlayback } = await import(/* @vite-ignore */ modulePath)
      probe.releaseVideo = beginVideoPlayback()
    } else {
      probe.releaseVideo?.()
      probe.releaseVideo = undefined
    }
  }, active)
}

test('starts on request, reports actual playback, keeps one player across every route and loops', async ({ page }) => {
  await fakeYouTube(page)
  await page.goto('/#/')
  await expect(page.locator('.background-music-player iframe')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Bật nhạc', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  await expect(page.locator('.background-music-status')).toContainText('Đang kết nối')
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await expect(page.locator('.music-toggle')).toHaveClass(/is-playing/)
  await expect(page.locator('.background-music-status')).toContainText('Nhạc đang phát')

  for (const route of ['our-memories', 'your-wish', 'letters-to-boys', 'photobooth', '']) {
    await page.evaluate(route => { window.location.hash = `#/${route}` }, route)
    await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute('href', `#/${route}`)
    await expect(page.locator('.background-music-player iframe')).toHaveAttribute('data-player-id', '0')
    await expect(page.locator('.music-toggle')).toHaveClass(/is-playing/)
  }
  expect(await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.instances)).toBe(1)
  expect(await commandCount(page, 'play')).toBe(1)
  const options = await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.options[0])
  expect(options.videoId).toBe('oahyzTO6VFw')
  expect(options.playerVars).toMatchObject({ loop: 1, playlist: 'oahyzTO6VFw', playsinline: 1, controls: 1 })
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(0))
  await expect.poll(() => commandCount(page, 'play')).toBe(2)
  expect(await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.commands.find(command => command.action === 'seek'))).toMatchObject({ value: 0 })
  await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
  await expect.poll(() => commandCount(page, 'pause')).toBeGreaterThan(0)
  await expect(page.locator('.music-popover')).toBeHidden()
})

test('pauses during the large video and resumes only while the user still wants music', async ({ page }) => {
  await fakeYouTube(page)
  await page.goto('/#/our-memories')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await videoActivity(page, true)
  await expect(page.locator('.background-music-video-status')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tắt nhạc', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.music-popover')).toBeHidden()
  expect(await commandCount(page, 'pause')).toBe(1)
  // Even a late PLAYING callback must not restart music over the video.
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  expect(await commandCount(page, 'pause')).toBe(2)
  await videoActivity(page, false)
  await expect.poll(() => commandCount(page, 'play')).toBe(2)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await expect(page.locator('.music-toggle')).toHaveClass(/is-playing/)

  await videoActivity(page, true)
  await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
  await videoActivity(page, false)
  expect(await commandCount(page, 'play')).toBe(2)
  await expect(page.getByRole('button', { name: 'Bật nhạc', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

test('the real Boy Day viewer pauses music and closing it resumes the same song', async ({ page }) => {
  await fakeYouTube(page)
  await page.route('https://drive.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Drive viewer fixture</title>' }))
  await page.route('https://drive.usercontent.google.com/**', route => route.abort('blockedbyclient'))
  await page.goto('/#/our-memories')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  await page.getByRole('button', { name: 'Xem video kỷ niệm Boy Day 2026', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Video kỷ niệm Boy Day 2026' })).toBeVisible()
  expect(await commandCount(page, 'pause')).toBe(1)
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  await page.getByRole('button', { name: 'Đóng video kỷ niệm', exact: true }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(2)
  await expect(page.locator('.background-music-player iframe')).toHaveAttribute('data-player-id', '0')
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await expect(page.locator('.music-toggle')).toHaveClass(/is-playing/)
})

test('late API and player readiness respect an already opened video', async ({ page }) => {
  await fakeYouTube(page, { autoReady: false, apiAvailable: false })
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'text/javascript', body: '/* fake API will become ready later */' }))
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await videoActivity(page, true)
  await page.evaluate(() => {
    const target = window as unknown as { musicProbe: MusicProbe; onYouTubeIframeAPIReady?: () => void }
    target.musicProbe.installAPI()
    target.onYouTubeIframeAPIReady?.()
  })
  await expect.poll(() => page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.instances)).toBe(1)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.ready())
  expect(await commandCount(page, 'play')).toBe(0)
  expect(await commandCount(page, 'pause')).toBe(1)
  await videoActivity(page, false)
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
})

test('cancelled initialization ignores stale callbacks and can be enabled again', async ({ page }) => {
  await fakeYouTube(page, { autoReady: false })
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect(page.locator('.background-music-player iframe')).toHaveCount(1)
  await page.getByRole('button', { name: 'Tắt nhạc', exact: true }).click()
  await page.evaluate(() => {
    const probe = (window as unknown as { musicProbe: MusicProbe }).musicProbe
    probe.ready(0)
    probe.state(1, 0)
  })
  expect(await commandCount(page, 'play')).toBe(0)
  await expect(page.locator('.background-music-player iframe')).toHaveCount(0)
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.instances)).toBe(2)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.ready(1))
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
})

test('reports API/network failure honestly and retries without a page reload', async ({ page }) => {
  await fakeYouTube(page, { apiAvailable: false })
  await page.route('https://www.youtube.com/iframe_api', route => route.abort('blockedbyclient'))
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect(page.locator('.background-music-status')).toContainText('Chưa kết nối được YouTube')
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  await expect(page.getByRole('link', { name: 'Nghe trên YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=oahyzTO6VFw')
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.installAPI())
  await page.getByRole('button', { name: 'Thử kết nối lại' }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.error())
  await expect(page.locator('.background-music-status')).toContainText('Chưa kết nối được YouTube')
  await expect(page.locator('.background-music-player iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Thử kết nối lại' }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(2)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1))
  await expect(page.locator('.music-toggle')).toHaveClass(/is-playing/)
})

test('handles browser autoplay blocking and pauses across page lifecycle events', async ({ page }) => {
  await fakeYouTube(page)
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Bật nhạc', exact: true }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(1)
  await page.evaluate(() => (window as unknown as { musicProbe: MusicProbe }).musicProbe.autoplayBlocked())
  await expect(page.locator('.background-music-status')).toContainText('trình duyệt cho phép')
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  await page.getByRole('button', { name: 'Phát nhạc', exact: true }).click()
  await expect.poll(() => commandCount(page, 'play')).toBe(2)
  await page.evaluate(() => {
    (window as unknown as { musicProbe: MusicProbe }).musicProbe.state(1)
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
  })
  expect(await commandCount(page, 'pause')).toBe(1)
  await expect(page.locator('.music-toggle')).not.toHaveClass(/is-playing/)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')))
  await expect.poll(() => commandCount(page, 'play')).toBe(3)
})
