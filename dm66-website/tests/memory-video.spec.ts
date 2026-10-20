import { expect, test } from '@playwright/test'

const drivePreview = 'https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/preview'
const driveView = drivePreview.replace('/preview', '/view')

test.beforeEach(async ({ page }) => {
  // Exercise the surrounding app independently of Google access/sharing settings.
  // This stub validates embed wiring and lifecycle, not the remote video's playback.
  await page.route(drivePreview, route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>Video frame fixture</title><button>Điều khiển video thử</button>',
  }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const width of [320, 390, 1440]) {
  test(`fits the supplied Boy Day video frame at ${width}px without changing photos or captions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/our-memories')
    await expect(page.locator('.memories-video-card')).toHaveCount(0)
    await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
    await expect(page.locator('.memories-caption h2')).toHaveText('Boy Day 2026')
    await expect(page.locator('.memories-image-frame img')).toHaveCount(2)
    const card = page.getByRole('region', { name: 'Video kỷ niệm Boy Day 2026', exact: true })
    await expect(card).toBeVisible()
    const player = card.locator('iframe')
    await expect(player).toHaveAttribute('src', drivePreview)
    await expect(player).toHaveAttribute('title', 'Video kỷ niệm Boy Day 2026')
    await expect(player).toHaveAttribute('allowfullscreen', '')
    await expect(card.getByRole('link', { name: 'Mở video riêng trên Drive ↗' })).toHaveAttribute('href', driveView)
    const bounds = await player.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.getByRole('button', { name: 'Xem kỷ niệm 12: 08/03/2026', exact: true }).click()
    await expect(page.locator('.memories-video-card, .memories-video-embed')).toHaveCount(0)
    await expect(page.locator('.memories-caption h2')).toHaveText('08/03/2026')
  })
}

test('keeps keyboard controls inside the player and unloads it on page hide or navigation', async ({ page }) => {
  await page.goto('/#/our-memories')
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  const player = page.locator('.memories-video-embed')
  await player.scrollIntoViewIfNeeded()
  const control = page.frameLocator('.memories-video-embed').getByRole('button', { name: 'Điều khiển video thử' })
  await control.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Home')
  await expect(page.locator('.memories-caption h2')).toHaveText('Boy Day 2026')
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect(player).toHaveAttribute('src', 'about:blank')
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  await expect(player).toHaveAttribute('src', drivePreview)
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.locator('.memories-video-card, .memories-video-embed')).toHaveCount(0)
})
