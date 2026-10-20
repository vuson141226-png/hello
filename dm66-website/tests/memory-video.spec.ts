import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const drivePreview = 'https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/preview'
const driveView = drivePreview.replace('/preview', '/view')
const driveDownload = 'https://drive.usercontent.google.com/download?id=1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC&export=download&confirm=t'
const drivePoster = 'https://drive.google.com/thumbnail?id=1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC&sz=w640'
const triggerName = 'Xem video kỷ niệm Boy Day 2026'
const dialogName = 'Video kỷ niệm Boy Day 2026'

// Original synthetic 12-second H264 test card (4.4 KB), not the private Drive video.
// Generated once with ffmpeg's color/drawbox filters; ffmpeg is not needed by tests.
const previewFixture = readFileSync(new URL('./fixtures/memory-preview.mp4', import.meta.url))

async function showBoyDay(page: Page) {
  await page.goto('/#/our-memories', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.memories-video-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  await expect(page.locator('.memories-caption h2')).toHaveText('Boy Day 2026')
  await expect(page.getByRole('button', { name: triggerName, exact: true })).toBeVisible()
}

async function openViewer(page: Page) {
  await page.getByRole('button', { name: triggerName, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: dialogName, exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('iframe')).toHaveCount(1)
  return dialog
}

test.beforeEach(async ({ page }) => {
  // Real browser decoding/short-loop tests use synthetic MP4 bytes. The iframe
  // stub exercises wiring, focus and lifecycle, not Google's remote playback.
  await page.route(driveDownload, route => {
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Number(range[2]) : previewFixture.length - 1
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: 'video/mp4',
      headers: {
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${previewFixture.length}` } : {}),
      },
      body: previewFixture.subarray(start, end + 1),
    })
  })
  await page.route(drivePoster, route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#ffc9de"/></svg>',
  }))
  await page.route(drivePreview, route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>Video frame fixture</title><body style="margin:0;background:#332132;color:white"><button>Điều khiển video thử</button></body>',
  }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`keeps a small preview by both photos and opens an uncropped viewer at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await showBoyDay(page)
    await expect(page.locator('.memories-image-frame img')).toHaveCount(2)
    await expect(page.locator('.memories-video-embed')).toHaveCount(0)
    const card = page.locator('.memories-video-card')
    const preview = card.locator('video.memories-video-preview')
    await expect(preview).toHaveAttribute('src', driveDownload)
    await expect(page.locator('.memories-media-group.has-video .memories-video-card')).toHaveCount(1)
    const [caption, photos, tile, media] = await Promise.all([
      page.locator('.memories-caption').boundingBox(),
      page.locator('.memories-photo').boundingBox(),
      card.boundingBox(),
      page.locator('.memories-media-group').boundingBox(),
    ])
    expect(tile!.width).toBeLessThan(media!.width * 0.6)
    expect(tile!.y + tile!.height).toBeLessThanOrEqual(caption!.y + 1)
    expect(tile!.y).toBeLessThan(photos!.y + photos!.height)
    expect(tile!.y + tile!.height).toBeGreaterThan(photos!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)

    const dialog = await openViewer(page)
    const player = dialog.locator('iframe.memories-video-embed')
    await expect(player).toHaveAttribute('src', drivePreview)
    await expect(player).toHaveAttribute('title', dialogName)
    await expect(player).toHaveAttribute('allowfullscreen', '')
    await expect(dialog.getByRole('link', { name: 'Mở video riêng trên Drive', exact: true })).toHaveAttribute('href', driveView)
    const [dialogBounds, playerBounds] = await Promise.all([dialog.boundingBox(), player.boundingBox()])
    expect(dialogBounds!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBounds!.y).toBeGreaterThanOrEqual(0)
    expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(viewport.height + 1)
    expect(playerBounds!.width).toBeGreaterThan(tile!.width * 1.5)
    expect(playerBounds!.height).toBeGreaterThan(100)
    expect(playerBounds!.x).toBeGreaterThanOrEqual(dialogBounds!.x)
    expect(playerBounds!.y).toBeGreaterThanOrEqual(dialogBounds!.y)
    expect(playerBounds!.x + playerBounds!.width).toBeLessThanOrEqual(dialogBounds!.x + dialogBounds!.width + 1)
    expect(playerBounds!.y + playerBounds!.height).toBeLessThanOrEqual(dialogBounds!.y + dialogBounds!.height + 1)
    // Rotating a cross-origin iframe caused half the video to disappear. Keep
    // the complete embed untransformed and all four corners directly visible.
    expect(await player.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const points = [
        [bounds.left + 12, bounds.top + 12],
        [bounds.right - 12, bounds.top + 12],
        [bounds.left + 12, bounds.bottom - 12],
        [bounds.right - 12, bounds.bottom - 12],
      ]
      return {
        transform: getComputedStyle(element).transform,
        cornersVisible: points.every(([x, y]) => document.elementFromPoint(x, y) === element),
      }
    })).toEqual({ transform: 'none', cornersVisible: true })
    await page.getByRole('button', { name: 'Đóng video kỷ niệm', exact: true }).click()
    await expect(page.locator('.memories-video-embed')).toHaveCount(0)
    await expect(page.getByRole('button', { name: triggerName, exact: true })).toBeFocused()
    await expect(page.locator('.memories-caption h2')).toHaveText('Boy Day 2026')
  })
}

test('decodes a muted inline preview, repeats only its short segment and pauses outside the view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 568 })
  await showBoyDay(page)
  const preview = page.locator('video.memories-video-preview')
  await preview.scrollIntoViewIfNeeded()
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => ({
    ready: video.readyState >= 2,
    width: video.videoWidth,
    muted: video.muted,
    inline: video.playsInline,
    loop: video.loop,
    playing: !video.paused,
  }))).toEqual({ ready: true, width: 160, muted: true, inline: true, loop: true, playing: true })
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(2)
  // Seek near the segment's end; let real media playback cross the boundary.
  await preview.evaluate((video: HTMLVideoElement) => { video.currentTime = 7.8 })
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime), { timeout: 5_000 }).toBeLessThan(3)
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(2)
  await openViewer(page)
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.memories-video-embed')).toHaveCount(0)
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => !video.paused)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => preview.evaluate(video => {
    const bounds = video.getBoundingClientRect()
    return bounds.bottom <= 0 || bounds.top >= innerHeight
  })).toBe(true)
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true)
})

test('uses an actual-video poster if the inline preview fails and still opens the full viewer', async ({ page }) => {
  await page.route(driveDownload, route => route.abort())
  await showBoyDay(page)
  await expect(page.locator('.memories-video-poster')).toHaveAttribute('src', drivePoster)
  await expect(page.locator('.memories-video-poster')).toBeVisible()
  await expect(page.locator('.memories-video-embed')).toHaveCount(0)
  await openViewer(page)
  await expect(page.locator('.memories-video-embed')).toHaveAttribute('src', drivePreview)
})

test('keeps keyboard controls inside the viewer and restores thumbnail focus on Escape', async ({ page }) => {
  await showBoyDay(page)
  await openViewer(page)
  const control = page.frameLocator('.memories-video-embed').getByRole('button', { name: 'Điều khiển video thử' })
  await control.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Home')
  await expect(page.locator('.memories-caption h2')).toHaveText('Boy Day 2026')
  // The remote player owns keys within its browsing context. Return focus to
  // the dialog before testing its native Escape close action.
  await page.getByRole('button', { name: 'Đóng video kỷ niệm', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: dialogName, exact: true })).toBeHidden()
  await expect(page.locator('.memories-video-embed')).toHaveCount(0)
  await expect(page.getByRole('button', { name: triggerName, exact: true })).toBeFocused()
})

test('unloads the full player on page hide, event changes and route navigation', async ({ page }) => {
  await showBoyDay(page)
  await openViewer(page)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect(page.locator('.memories-video-embed')).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await expect(page.locator('.memories-video-embed')).toHaveCount(0)
  await openViewer(page)
  // Modal background is deliberately inert. A programmatic event change still
  // exercises cleanup if the parent carousel changes the active memory.
  await page.getByRole('button', { name: 'Xem kỷ niệm 12: 08/03/2026', exact: true }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('.memories-video-card, .memories-video-embed')).toHaveCount(0)
  await expect(page.locator('.memories-caption h2')).toHaveText('08/03/2026')
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  await openViewer(page)
  await page.evaluate(() => { location.hash = '#/your-wish' })
  await expect(page.locator('.memories-video-card, .memories-video-embed')).toHaveCount(0)
})
