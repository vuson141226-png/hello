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
    await expect(card.getByRole('link', { name: 'Mở video riêng trên Drive', exact: true })).toHaveAttribute('href', driveView)
    await expect(page.locator('.memories-media-group.has-video .memories-video-card')).toHaveCount(1)
    const captionBounds = (await page.locator('.memories-caption').boundingBox())!
    const photosBounds = (await page.locator('.memories-photo').boundingBox())!
    const cardBounds = (await card.boundingBox())!
    const mediaBounds = (await page.locator('.memories-media-group').boundingBox())!
    expect(cardBounds.width).toBeLessThan(mediaBounds.width * 0.6)
    expect(cardBounds.y + cardBounds.height).toBeLessThanOrEqual(captionBounds.y + 1)
    expect(cardBounds.y).toBeLessThan(photosBounds.y + photosBounds.height)
    expect(cardBounds.y + cardBounds.height).toBeGreaterThan(photosBounds.y)
    await expect(player).toHaveClass(/is-sideways/)
    const rotation = await player.evaluate(element => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
      return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d }
    })
    expect(rotation.a).toBeCloseTo(0)
    expect(rotation.b).toBeCloseTo(1)
    expect(rotation.c).toBeCloseTo(-1)
    expect(rotation.d).toBeCloseTo(0)
    const bounds = await player.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    expect(bounds!.width).toBeGreaterThan(bounds!.height * 1.5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.getByRole('button', { name: 'Xem kỷ niệm 12: 08/03/2026', exact: true }).click()
    await expect(page.locator('.memories-video-card, .memories-video-embed')).toHaveCount(0)
    await expect(page.locator('.memories-caption h2')).toHaveText('08/03/2026')
  })
}

test('turns the video inside its landscape frame without reloading the player', async ({ page }) => {
  await page.goto('/#/our-memories')
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  const player = page.locator('.memories-video-embed')
  await player.scrollIntoViewIfNeeded()
  await page.frameLocator('.memories-video-embed').getByRole('button', { name: 'Điều khiển video thử' }).waitFor()
  await page.frameLocator('.memories-video-embed').locator('body').evaluate(element => { element.dataset.keepPlayback = 'same-player' })
  const turn = page.getByRole('button', { name: 'Xoay video thêm 90 độ', exact: true })
  for (const angle of [180, 270, 0, 90]) {
    await turn.click()
    await expect.poll(() => player.evaluate(element => {
      const value = new DOMMatrixReadOnly(getComputedStyle(element).transform)
      return [value.a, value.b].map(coefficient => Math.round(coefficient * 1000) || 0)
    })).toEqual([Math.cos(angle * Math.PI / 180), Math.sin(angle * Math.PI / 180)].map(coefficient => Math.round(coefficient * 1000) || 0))
    await expect(player).toHaveAttribute('src', drivePreview)
    await expect(page.frameLocator('.memories-video-embed').locator('body')).toHaveAttribute('data-keep-playback', 'same-player')
  }
})

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
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Xem kỷ niệm 12: 08/03/2026', exact: true }).click()
  await expect(player).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem kỷ niệm 13: Boy Day 2026', exact: true }).click()
  await expect(player).toHaveCount(1)
  await page.locator('nav a[href="#/your-wish"]').click()
  await expect(page.locator('.memories-video-card, .memories-video-embed')).toHaveCount(0)
})
